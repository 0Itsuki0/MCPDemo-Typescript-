# Remote MCP Server with Streamable HTTP

An MCP server that is able to connect to multiple client with `StreamableHTTPServerTransport`.

## Features
This server supports:
- Basic functionalities, ie: Client establishing connections and sneding messages (or requests such as list tools, list resources, call tools and etc.) to the server and server responding.
- Standalone SSE to open an SSE stream to support server-initiated messgaes
- Tools
    - A regular tool that return a single response
    - A tool that sends multiple messages back to the client with notifications


## Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [endpoint url](./server/src/index.ts). By default, the endpoint will be `/mcp`.
3. Run `npm run build` to build the project
4. Start server by running `node build/index.js`. This will start a localhost listenining to port 3000.
