# mcp-performance-win
A Gemini CLI extension and MCP server to analyze web page performance. This is a fork of [mcclatchy/mcp-performance](https://github.com/mcclatchy/mcp-performance) optimized for Windows.

## Gemini CLI Extension

This project is intended to be installed as a Gemini CLI extension. This will include both the MCP server and commands for consistent AI responses. To install it, use the following command:

```bash
gemini extensions install https://github.com/Superstos/mcp-performance-win
```

After installing, you will have access to a performance MCP server as well as commands that we have created to assist you. Commands begin with the `/` character, such as `/performance-analysis`, and will be visible in the client. These commands will automatically pull performance data using the MCP server. If you would like to pull performance data for a different conversation, you can initiate the MCP tool directly in a prompt. This direct invocation pattern works consistently but is not strictly necessary when using the Gemini CLI commands:

```
`performance-entries` --url="https://www.coralspringsflnews.com" --mark="flex first rendered"
```

## MCP Server

This project can also be run as a standalone MCP server. This is useful for developers who want to use this tool with other MCP clients, such as [mcp-inspector](https://modelcontextprotocol.to/docs/tools/inspector), or other LLM clients like Claude. To run the server for these clients, use the following command:

```
npx github:Superstos/mcp-performance-win
```

For local development and testing with the Gemini CLI, please refer to the "Local Development" section and use `npm start`.

*Note: you do not need to use the `npx` command if using Gemini CLI.*

## Local Development

For developers working on the `mcp-performance` project, follow these steps:

### Installation

This project requires Node.js and npm. To install the development dependencies, run the following command:

```bash
npm install
```

### Running the MCP Server Locally

To run the MCP server for local development, use the following command:

```bash
npm start
```

This will start the MCP server and make it available for testing with the Gemini CLI or other MCP clients.

### Using Performance Marks

The `performance-entries` tool can wait for a specific `performance.mark` to be set on the page before collecting performance metrics. This is particularly useful for measuring custom events or ensuring that a specific part of the application has loaded or executed.

To use this feature, provide the `mark` parameter with the name of the performance mark you wish to wait for. For example, if your webpage sets a mark like `performance.mark('myCustomEvent')`, you can instruct the tool to wait for it.

Example (when used with Gemini CLI):

```bash
gemini performance-entries --url "https://example.com" --mark "myCustomEvent"
```

