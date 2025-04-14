# MCP Client for remote Server with SSE

An MCP client connect to remote server with `SSEClientTransport`.

## Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [server url](./src/index.ts). By default, it will use `http://localhost:3000/connect`.
3. Run `npm run build` to build the project
4. Start client by running `node build/index.js`.