# Local MCP Server Demo

An MCP server that exposes a `create-mcp-server-app` tool to MCP hosts.
<br><br>
By running this tool, either with Claude for Desktop or some other host, a new project for creating an MCP server with necessary set ups and sample code will be created in the desktop folder.
<br><br>
Sample Code will include the following.
- creating a server instance
- defining available tools
- handling tools execution
- starting the server


## Set Up
1. Run `npm install` to install necessary dependency
2. Run `npm run build` to build the project
3. `build/index.js` will the server path to set up in the MCP host