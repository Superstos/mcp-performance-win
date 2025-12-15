import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import puppeteerCore from "puppeteer-core";
import { addExtra } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { z } from "zod";
import fs from "fs";
import path from "path";

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

// Function to find the Chrome executable path
function getChromeExecutablePath() {
  // Prioritize PUPPETEER_EXECUTABLE_PATH environment variable
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    console.log(`Using Chrome executable path from environment variable: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  let executablePath;

  switch (process.platform) {
    case 'win32':
      const windowsPaths = [
        path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        path.join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), // Microsoft Edge (Chromium)
        path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe') // Microsoft Edge (Chromium)
      ];
      executablePath = windowsPaths.find(p => fs.existsSync(p));
      break;
    case 'darwin':
      const macPaths = [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', // Microsoft Edge (Chromium)
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
    throw new Error(`Chrome/Chromium executable not found for platform: ${process.platform}. Please ensure Chrome/Chromium is installed or set the PUPPETEER_EXECUTABLE_PATH environment variable.`);
  }
  console.log(`Discovered Chrome executable path: ${executablePath}`);
  return executablePath;
}

// Establish the MCP server
const server = new McpServer({
  name: "performance",
  version: "1.0.1"
});

/**
 * @tool performance-entries
 * @description Loads a webpage and returns the performance entries.
 * This tool is used for automated performance and Lighthouse audits.
 * @param {string} url The full URL of the webpage to audit.
 * @param {string} [mark] Optional. The name of a specific performance mark to wait for before retrieving entries.
 */
server.registerTool(
  "performance-entries",
  {
    title: "Analyze Web Page Performance",
    description: "Loads a URL in a headless browser and returns a detailed timeline of performance metrics as a JSON array of PerformanceEntry objects. Useful for diagnosing performance bottlenecks and measuring key events like First Contentful Paint (FCP). Optionally, it can wait for a specific `performance.mark` to measure custom events.",
    inputSchema: {
      url: z.string().url("Must be a valid URL").refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
        message: "URL must start with http:// or https://"
      }),
      mark: z.string().optional()
    }
  },
  async ({ url, mark }) => {
    const executablePath = getChromeExecutablePath();
    // Start the browser
    const browser = await puppeteer.launch({ 
      headless: false, 
      args: [`--window-size=1400,900`],
      defaultViewport: null,
      executablePath: executablePath
    });

    try {
      // Use the initial page
      const [page] = await browser.pages();
      // Set a common User Agent to help bypass bot detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      const timeout = 10000;

      // Navigate to the URL using 'domcontentloaded'
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 }); 
      
      // Wait for performance mark if defined
      if(mark) {
        await page.waitForFunction((mark) => {
          return performance.getEntriesByName(mark).length > 0
        }, { polling: 1000, timeout }, mark);
      }

      // Performance Measurement Logic
      const entries = await page.evaluate(() => {
        return JSON.stringify(performance.getEntries());
      });

      return {
        content: [{ type: "text", text: entries }]
      };
    } catch (error) {
      throw new Error(`Failed to generate performance report for ${url}. Error: ${error.message}`);
    } finally {
      await browser.close();
    }
  }
);

// Export the server
export default server;
