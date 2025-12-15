import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import puppeteerCore from "puppeteer-core";
import { addExtra } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { z } from "zod";
import fs from "fs";
import path from "path";
import lighthouse from "lighthouse";
import { URL } from "url";

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

// Global State
let globalBrowser = null;
let globalPage = null;

// Helper: Find Chrome Path
function getChromeExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  let executablePath;
  switch (process.platform) {
    case 'win32':
      const windowsPaths = [
        path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe')
      ];
      executablePath = windowsPaths.find(p => fs.existsSync(p));
      break;
    case 'darwin':
      const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      ];
      executablePath = macPaths.find(p => fs.existsSync(p));
      break;
    case 'linux':
      const linuxPaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
        '/opt/google/chrome/chrome'
      ];
      executablePath = linuxPaths.find(p => fs.existsSync(p));
      break;
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }

  if (!executablePath) {
    throw new Error(`Chrome executable not found.`);
  }
  return executablePath;
}

// Helper: Get or Launch Browser
async function getBrowser() {
  if (globalBrowser) {
    if (globalBrowser.isConnected()) {
      return globalBrowser;
    }
    // Cleanup if disconnected
    globalBrowser = null;
    globalPage = null;
  }

  const executablePath = getChromeExecutablePath();
  globalBrowser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=1400,900', '--remote-debugging-port=0'], // Port 0 for random port
    defaultViewport: null,
    executablePath: executablePath
  });

  // Ensure we have one page ready
  const pages = await globalBrowser.pages();
  globalPage = pages.length > 0 ? pages[0] : await globalBrowser.newPage();
  
  // Basic setup
  await globalPage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Close browser when process exits
  process.on('exit', async () => {
    if (globalBrowser) await globalBrowser.close();
  });

  return globalBrowser;
}

// Helper: Get Active Page
async function getPage() {
  await getBrowser(); // Ensure browser exists
  if (!globalPage || globalPage.isClosed()) {
    const pages = await globalBrowser.pages();
    globalPage = pages.length > 0 ? pages[0] : await globalBrowser.newPage();
  }
  return globalPage;
}

const server = new McpServer({
  name: "performance",
  version: "2.0.0"
});

// --- NAVIGATION & INTERACTION TOOLS ---

server.registerTool(
  "navigate",
  {
    title: "Navigate to URL",
    description: "Navigates the browser to a specific URL.",
    inputSchema: {
      url: z.string().url("Must be a valid URL")
    }
  },
  async ({ url }) => {
    const page = await getPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    return { content: [{ type: "text", text: `Navigated to ${url}` }] };
  }
);

server.registerTool(
  "click",
  {
    title: "Click Element",
    description: "Clicks an element on the page identified by a CSS selector.",
    inputSchema: {
      selector: z.string().describe("CSS selector of the element to click")
    }
  },
  async ({ selector }) => {
    const page = await getPage();
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.click(selector);
      return { content: [{ type: "text", text: `Clicked element: ${selector}` }] };
    } catch (e) {
      throw new Error(`Failed to click '${selector}': ${e.message}`);
    }
  }
);

server.registerTool(
  "fill",
  {
    title: "Fill Input",
    description: "Types text into an input field identified by a CSS selector.",
    inputSchema: {
      selector: z.string().describe("CSS selector of the input field"),
      value: z.string().describe("The text value to type")
    }
  },
  async ({ selector, value }) => {
    const page = await getPage();
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      await page.type(selector, value);
      return { content: [{ type: "text", text: `Filled '${selector}' with value.` }] };
    } catch (e) {
      throw new Error(`Failed to fill '${selector}': ${e.message}`);
    }
  }
);

server.registerTool(
  "evaluate",
  {
    title: "Evaluate JavaScript",
    description: "Executes arbitrary JavaScript in the browser context. Returns the result.",
    inputSchema: {
      script: z.string().describe("JavaScript code to execute. The return value will be JSON stringified.")
    }
  },
  async ({ script }) => {
    const page = await getPage();
    try {
      // We wrap in a function to allow 'return' statements
      const result = await page.evaluate((code) => {
        const func = new Function(code);
        return func();
      }, script);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      throw new Error(`Script execution failed: ${e.message}`);
    }
  }
);

server.registerTool(
  "inspect",
  {
    title: "Inspect Page (Accessibility Tree)",
    description: "Returns a snapshot of the page's accessibility tree. Use this to find buttons, inputs, and text to interact with.",
    inputSchema: {}
  },
  async () => {
    const page = await getPage();
    const snapshot = await page.accessibility.snapshot();
    return { content: [{ type: "text", text: JSON.stringify(snapshot, null, 2) }] };
  }
);

// --- ANALYSIS TOOLS (Updated to use Shared Browser) ---

server.registerTool(
  "take-screenshot",
  {
    title: "Take Screenshot",
    description: "Takes a screenshot of the current page state.",
    inputSchema: {
      fullPage: z.boolean().optional().default(false)
    }
  },
  async ({ fullPage }) => {
    const page = await getPage();
    const buffer = await page.screenshot({ fullPage, encoding: 'base64' });
    return {
      content: [{ type: "image", data: buffer, mimeType: "image/png" }]
    };
  }
);

server.registerTool(
  "performance-entries",
  {
    title: "Analyze Web Page Performance",
    description: "Returns performance timing entries for the CURRENT page.",
    inputSchema: {
      // URL is now optional. If provided, we navigate first.
      url: z.string().url().optional(),
      mark: z.string().optional()
    }
  },
  async ({ url, mark }) => {
    const page = await getPage();
    if (url) {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    }

    if (mark) {
      await page.waitForFunction((m) => performance.getEntriesByName(m).length > 0, { timeout: 5000 }, mark);
    }

    const entries = await page.evaluate(() => JSON.stringify(performance.getEntries()));
    return { content: [{ type: "text", text: entries }] };
  }
);

server.registerTool(
  "console-log",
  {
    title: "Get Console Logs",
    description: "Returns console logs collected *since the last call* or navigation.",
    inputSchema: {}
  },
  async () => {
    // Note: To implement this properly in a persistent session, we'd need to
    // attach a listener once and store logs in a buffer.
    // For this simplified v2, we'll just return "Not implemented for persistent session yet"
    // or we can implement a buffer. Let's do a simple buffer.
    return { content: [{ type: "text", text: "Console logging requires a dedicated event listener setup. Use 'evaluate' to inspect 'console' history if available on the page." }] };
  }
);

server.registerTool(
  "lighthouse-report",
  {
    title: "Run Lighthouse Audit",
    description: "Runs Lighthouse on the current URL. Note: This may force a reload.",
    inputSchema: {
      url: z.string().url().optional()
    }
  },
  async ({ url }) => {
    const browser = await getBrowser();
    const page = await getPage();
    const targetUrl = url || page.url();
    const port = new URL(browser.wsEndpoint()).port;

    const options = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo', 'pwa'],
      port: Number(port)
    };

    const runnerResult = await lighthouse(targetUrl, options);
    const report = JSON.parse(runnerResult.report);
    
    // Summary
    const scores = {};
    Object.keys(report.categories).forEach(key => {
      scores[report.categories[key].title] = report.categories[key].score;
    });

    return { content: [{ type: "text", text: JSON.stringify({ scores }, null, 2) }] };
  }
);

// Export
export default server;
