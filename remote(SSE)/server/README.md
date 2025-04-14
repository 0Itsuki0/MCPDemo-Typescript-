# Remote MCP Server with SSE

An MCP server that is able to connect to multiple client with `SSEServerTransport`.

## Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [endpoint url](./server/src/index.ts). By default, the endpoint for connection will be `/connect`, and that for messaging will be `/messages`.
2. Run `npm run build` to build the project
3. Start server by running `node build/index.js`. This will start a localhost listenining to port 3000.
