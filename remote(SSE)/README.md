# Remote MCP with [SSE](https://modelcontextprotocol.io/specification/2024-11-05/basic/transports#http-with-sse)

## Remote MCP Server with SSE

An MCP server that is able to connect to multiple client with `SSEServerTransport`.

### Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [endpoint url](./server/src/index.ts). By default, the endpoint for connection will be `/connect`, and that for messaging will be `/messages`.
2. Run `npm run build` to build the project
3. Start server by running `node build/index.js`. This will start a localhost listenining to port 3000.


## MCP Client for remote Server with SSE

An MCP client connect to remote server with `SSEClientTransport`.

### Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [server url](./client/src/index.ts). By default, it will use `http://localhost:3000/connect`.
3. Run `npm run build` to build the project
4. Start client by running `node build/index.js`.
