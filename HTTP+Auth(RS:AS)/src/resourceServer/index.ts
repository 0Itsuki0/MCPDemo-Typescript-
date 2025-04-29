import express, { NextFunction, Request, Response } from "express"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { MCPResourceServer } from "./mcpServer.js"
import { MCP_ENDPOINT, MCP_SCOPE, RESOURCE_SERVER_HOSTNAME, RESOURCE_SERVER_PORT } from "../configurationConstants.js"
import { getProtectedResourceMetadataJson, verifyAccessToken } from "./handler.js"
import { logMessage } from "./helper.js"

const app = express()
app.use(express.json())

const mcpServer = new MCPResourceServer(
    new Server({
        name: "itsuki-mcp-server",
        version: "1.0.0"
    }, {
        capabilities: {
            tools: {},
            logging: {}
        }
    })
)

// mcp handler
app.post(MCP_ENDPOINT, (req: Request, res: Response, next: NextFunction) => {
    verifyAccessToken(req, res, next, [MCP_SCOPE])
}, async (req: Request, res: Response) => {
    await mcpServer.handlePostRequest(req, res)
})

// GET & DELETE not allowed
app.get(MCP_ENDPOINT, async (req: Request, res: Response) => {
    await mcpServer.handleGetDeleteRequest(req, res)
})

app.delete(MCP_ENDPOINT, async (req: Request, res: Response) => {
    await mcpServer.handleGetDeleteRequest(req, res)
})

// protected resource metadata
// specification: https://datatracker.ietf.org/doc/html/rfc9728
export const PROTECTED_RESOURCE_METADATA_ENDPOINT = "/.well-known/oauth-protected-resource"
app.get(PROTECTED_RESOURCE_METADATA_ENDPOINT, async (req: Request, res: Response) => {
    getProtectedResourceMetadataJson(req, res)
})


let expressAppServer: Server | undefined = undefined
export function startResourceServer() {
    app.listen(RESOURCE_SERVER_PORT, RESOURCE_SERVER_HOSTNAME, () => {
        logMessage(`Resource Server listening on ${RESOURCE_SERVER_HOSTNAME}:${RESOURCE_SERVER_PORT}`)
    })

    process.on('SIGINT', async () => {
        logMessage('Shutting down resource server...')
        process.exit(0)
    })
}

export function stopResourceServer() {
    expressAppServer?.close()
    logMessage('Shutting down resource server...')
}


if (process.argv[2] === "startResourceServer") {
    startResourceServer()
}