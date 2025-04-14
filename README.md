# Demo of Model Context Protocol


For more details, please refer to my article:
- [Get Start with Model Context Protocol](https://medium.com/gitconnected/get-start-with-model-context-protocol-671ebf3fe62d).
- [MCP Server and Client with SSE & The New Streamable HTTP](https://medium.com/@itsuki.enjoy/mcp-server-and-client-with-sse-the-new-streamable-http-d860850d9d9d)


## Table of Contents
- [MCP with stdio](#local-mcp-with-stdio)
    - [server](#local-mcp-server)
    - [host with clients](#local-host-with-mcp-clients)
- [MCP with SSE](#remote-mcp-with-sse)
    - [server](#remote-mcp-server-with-sse)
    - [client](#mcp-client-for-remote-server-with-sse)
- [MCP with Streamable HTTP](#remote-mcp-with-streamable-http)
    - [server](#remote-mcp-server-with-streamable-http)
    - [client](#mcp-client-for-remote-server-with-streamable-http)



## Local MCP with [stdio](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#stdio)


### Local MCP Server

<br>

An MCP server that exposes a `create-mcp-server-app` tool to MCP hosts.
<br><br>
By running this tool, either with Claude for Desktop or some other host, a new project for creating an MCP server with necessary set ups and sample code will be created in the desktop folder.
<br><br>
Sample Code will include the following.
- creating a server instance
- defining available tools
- handling tools execution
- starting the server


#### Set Up
1. Run `npm install` to install necessary dependency
2. Run `npm run build` to build the project
3. `build/index.js` will the server path to set up in the MCP host


#### Test with Claude for desktop
1. Download [Claude for Desktop](https://claude.ai/download)
2. Open the configuration file at `~/Library/Application Support/Claude/claude_desktop_config.json`
    - If the file does not exist, create one with the same name
3. Add server configuration
```
{
    "mcpServers": {
        "create-mcp-app": {
            "command": "node",
            "args": [
                "/absolute-path-to/build/index.js"
            ]
        }
    }
}
```
4. Save the file and restart Claude for Desktop.
5. Enter the prompt **create a new mcp server project**. You should see a sample MCP Server project created at  desktop directory with some responses indicating the success.



### Local Host with MCP Clients

An OpenAI-chatbot host that uses MCP clients to connect to MCP servers.

#### Set up
1. Set up `OPENAI_API_KEY` in `.env`.
2. Add MCP server configurations to connect the host in `server-config.json`.
```
{
    "some-server-name-1": {
        "command": "node",
        "args": [
            "/absolut-path-to-local-server-folder-1/build/index.js"
        ]
    },
    "some-server-name-2": {
        "command": "uv",
        "args": [
             "--directory",
            "/absolut-path-to-local-server-folder-2",
            "run",
            "main.py"
        ]
    }
}
```
3. Run `npm install` to install necessary dependency
4. Run `npm run build` to build the project
5. Start client by running `node build/index.js`



## Remote MCP with [SSE](https://modelcontextprotocol.io/specification/2024-11-05/basic/transports#http-with-sse)

### Remote MCP Server with SSE

An MCP server that is able to connect to multiple client with `SSEServerTransport`.

#### Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [endpoint url](./server/src/index.ts). By default, the endpoint for connection will be `/connect`, and that for messaging will be `/messages`.
2. Run `npm run build` to build the project
3. Start server by running `node build/index.js`. This will start a localhost listenining to port 3000.


### MCP Client for remote Server with SSE

An MCP client connect to remote server with `SSEClientTransport`.

#### Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [server url](./client/src/index.ts). By default, it will use `http://localhost:3000/connect`.
3. Run `npm run build` to build the project
4. Start client by running `node build/index.js`.



## Remote MCP with [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http)

### Common set up
By the time this demo is created, typescript SDK with StreamableHTTP is not available through `npm install` yet. Do the following to set the project up.

1. Download the [typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) and replace the `typescript-sdk` folder with it.
2. Open `tsconfig`.json and remove `dist` from `exclude` to enable type checking, ie: it should become `"exclude": ["node_modules"]`.
3. `npm install` and `npm run build`
4. Use this as the dependency instead, ie: `"@modelcontextprotocol/sdk": "file:../typescript-sdk"` in the `package.json` for both the server and the client


### Remote MCP Server with Streamable HTTP

An MCP server that is able to connect to multiple client with `StreamableHTTPServerTransport`.

#### Features
This server supports:
- Basic functionalities, ie: Client establishing connections and sneding messages (or requests such as list tools, list resources, call tools and etc.) to the server and server responding.
- Standalone SSE to open an SSE stream to support server-initiated messgaes
- Tools
    - A regular tool that return a single response
    - A tool that sends multiple messages back to the client with notifications



#### Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [endpoint url](./server/src/index.ts). By default, the endpoint will be `/mcp`.
3. Run `npm run build` to build the project
4. Start server by running `node build/index.js`. This will start a localhost listenining to port 3000.

### MCP Client for remote Server with Streamable Http

An MCP client connect to remote server with `SSEClientTransport`.

#### Features
Upon start, the client will
1. Connect to the server
2. Set up notifications to receive update on Logging messages and tool changes
3. List tools and call tools


#### Set up
1. Run `npm install` to install necessary dependency
2. (Optional) Change the [server url](./client/src/index.ts). By default, it will use `http://localhost:3000/mcp`.
3. Run `npm run build` to build the project
4. Start client by running `node build/index.js`.