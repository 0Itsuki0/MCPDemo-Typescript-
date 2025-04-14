# Local Host with MCP Clients Demo

An OpenAI-chatbot host that uses MCP clients to connect to MCP servers.

## Set up
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
