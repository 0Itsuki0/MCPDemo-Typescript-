import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { initProject } from "./helper.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

// Create server instance
const server = new Server({
    name: "create-mcp-app",
    version: "1.0.0"
}, {
    capabilities: {
        tools: {}
    }
})

const TOOL_NAME = "create-mcp-server-app"
const TOOL_DESCRIPTION = `
Initialize a new project for creating MCP server with sample code in the desktop.
Parameters:
- 'name': name of the project.
`

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [{
            name: TOOL_NAME,
            description: TOOL_DESCRIPTION,
            inputSchema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                },
                required: ["name"]
            }
        }]
    }
})

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === TOOL_NAME && request.params.arguments !== undefined) {

        let {name} = request.params.arguments
        if (typeof(name) !== "string") {
            throw new Error("Bad project name.")
        }

        try {
            await initProject(name)
            return {
                content: [ {
                    type: "text",
                    text: `New starter project: ${name} for creating an MCP server is created.`
                }]
            }

        } catch(err) {
            let errorMessage = "Error occured while creating the project."
            if (err instanceof Error) {
                errorMessage += err.message
            }
            return {
                content: [{
                    type: "text",
                    text: errorMessage
                }]
            }
        }
    }

    throw new Error("Tool not found")
})

// Start the server
async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error("Create-MCP-Project Server running on stdio.")
}

main().catch((error) => {
    console.error("Fatal error while running server:", error)
    process.exit(1)
})