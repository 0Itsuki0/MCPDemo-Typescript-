# Remote MCP with [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http)

## Remote MCP Server with Streamable HTTP

An MCP server that is able to connect to multiple client with `StreamableHTTPServerTransport`.

### Features
This server supports:
- Basic functionalities, ie: Client establishing connections and sneding messages (or requests such as list tools, list resources, call tools and etc.) to the server and server responding.
- Standalone SSE to open an SSE stream to support server-initiated messgaes
- Tools
    - A regular tool that return a single response
    - A tool that sends multiple messages back to the client with notifications



### Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [endpoint url](./server/src/index.ts). By default, the endpoint will be `/mcp`.
3. Run `npm run build` to build the project
4. Start server by running `node build/index.js`. This will start a localhost listenining to port 3000.


## MCP Client for remote Server with Streamable Http

An MCP client connect to remote server with `SSEClientTransport`.

### Features
Upon start, the client will
1. Connect to the server
2. Set up notifications to receive update on Logging messages and tool changes
3. List tools and call tools


### Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [server url](./client/src/index.ts). By default, it will use `http://localhost:3000/mcp`.
3. Run `npm run build` to build the project
4. Start client by running `node build/index.js`.