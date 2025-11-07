import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import puppeteer from "puppeteer-core";
import { z } from "zod";

// Establish the MCP server
const server = new McpServer({
  name: "performance",
  version: "1.0.0"
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
      url: z.string().url("Must be a valid URL"),
      mark: z.string().optional()
    }
  },
  async ({ url, mark }) => {
    // Start the browser
    const browser = await puppeteer.launch({ 
      headless: false, 
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' 
    });
    const page = await browser.newPage();
    const timeout = 10000;

    try {
      // Set the viewport dimensions
      await page.setViewport({
        width: 1280,
        height: 720,
        deviceScaleFactor: 1 // Optional: defaults to 1
      });

      // Navigate to the URL using 'domcontentloaded'
      await page.goto(url, { waitUntil: 'networkidle2' }); 
      
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
