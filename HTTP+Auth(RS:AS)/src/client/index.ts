import { MCP_ENDPOINT, RESOURCE_SERVER_HOSTNAME, RESOURCE_SERVER_PORT, RESOURCE_SERVER_PROTOCOL } from "../configurationConstants.js"
import { logMessage } from "./helper.js"
import { MCPClient } from "./mcpClient.js"


export async function startClient() {
    logMessage("Starting MCP client.")
    const client = new MCPClient("mcp-server", `${RESOURCE_SERVER_PROTOCOL}//${RESOURCE_SERVER_HOSTNAME}:${RESOURCE_SERVER_PORT}${MCP_ENDPOINT}`)

    try {
        await client.connectToServer()
        await client.listTools()
        for (const tool of client.tools) {
            await client.callTool(tool.name)
        }
    } catch(error) {
        logMessage("Error while running client: ", error)
    }

    await client.cleanup()
    logMessage("MCP client shutting down...")
}


if (process.argv[2] === "startClient") {
    startClient()
}