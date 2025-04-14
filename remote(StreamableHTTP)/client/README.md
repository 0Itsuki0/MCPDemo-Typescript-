# MCP Client for remote Server with Streamable Http

An MCP client connect to remote server with `SSEClientTransport`.

## Features
Upon start, the client will
1. Connect to the server
2. Set up notifications to receive update on Logging messages and tool changes
3. List tools and call tools


## Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [server url](./client/src/index.ts). By default, it will use `http://localhost:3000/mcp`.
3. Run `npm run build` to build the project
4. Start client by running `node build/index.js`.