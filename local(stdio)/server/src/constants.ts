export const PROJECT_NAME = "sample-app"

export const INDEX_TEXT = `
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

// Create server instance
const server = new Server({
    name: "sample-app",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
    },
})

const TOOL_NAME = "sum-calculator"

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [{
            name: TOOL_NAME,
            description: "Add two numbers.",
            inputSchema: {
                type: "object",
                properties: {
                    a: { type: "number" },
                    b: { type: "number" }
                },
                required: ["name"]
            }
        }]
    }
})

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === TOOL_NAME && request.params.arguments !== undefined) {

        const {a, b} = request.params.arguments
        if (typeof(a) !== "number" || typeof(b) !== "number") {
            throw new Error("Bad parameter.")
        }
        return {
            content: [ {
                type: "text",
                text: String(a + b)
            }]
        }
    }

    throw new Error("Tool not found")
})

// Start the server
async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
    console.error("MCP Server running on stdio.")
}

main().catch((error) => {
    console.error("Fatal error while running server:", error)
    process.exit(1)
})
`

export const PACKAGE_JSON = `
{
    "name": "${PROJECT_NAME}",
    "version": "1.0.0",
    "description": "",
    "main": "index.js",
    "type": "module",
    "bin": {
        "${PROJECT_NAME}": "build/index.js"
    },
    "scripts": {
        "build": "tsc && chmod 755 build/index.js"
    },
    "files": [
        "build"
    ],
    "keywords": [],
    "author": "",
    "license": "ISC",
    "dependencies": {
        "@modelcontextprotocol/sdk": "^1.8.0",
        "zod": "^3.24.2"
    },
    "devDependencies": {
        "@types/node": "^22.14.0",
        "typescript": "^5.8.3"
    },
    "directories": {
        "test": "test"
    }
}
`

export const TSCONFIG = `
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "Node16",
        "moduleResolution": "Node16",
        "outDir": "./build",
        "rootDir": "./src",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true
    },
    "include": ["src/**/*"],
    "exclude": ["node_modules"]
}
`
