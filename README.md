# Demo of using Model Context Protocol

For more details, please refer to my article: [Get Start with Model Context Protocol](https://medium.com/gitconnected/get-start-with-model-context-protocol-671ebf3fe62d).

## Local MCP Server

An MCP server that exposes a `create-mcp-server-app` tool to MCP hosts.
<br><br>
By running this tool, either with Claude for Desktop or some other host, a new project for creating an MCP server with necessary set ups and sample code will be created in the desktop folder.
<br><br>
Sample Code will include the following.
- creating a server instance
- defining available tools
- handling tools execution
- starting the server


### Set Up
1. Run `npm install` to install necessary dependency
2. Run `npm run build` to build the project
3. `build/index.js` will the server path to set up in the MCP host


### Test with Claude for desktop
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




## Local Host with MCP Clients

An OpenAI-chatbot host that uses MCP clients to connect to MCP servers.

### Set up
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
