/********************************************************/
/******** Simple MCP Client with StreamableHTTP *********/
/********************************************************/

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { URL } from "url"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { LoggingMessageNotificationSchema, ToolListChangedNotificationSchema, TextContentSchema } from "@modelcontextprotocol/sdk/types.js"
import { AuthManager } from "./oauth.js"
import { OAuthClientProvider, UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js"
import { getOAuthClientProvider } from "./oauth.js"
import { logMessage } from "./helper.js"
// import { OpenIdClientAuthManager } from "./oauthOpenidClient.js"


export class MCPClient {

    tools: {name: string, description: string}[] = []

    private client: Client
    private serverURL: string
    private transport: StreamableHTTPClientTransport | undefined = undefined

    // authentication related
    private authManager: AuthManager
    private authorizing = false

    // if to use openid-client instead
    // do note that using 3rd party library will require us to send JSONRPC messages directly by POSTing instead of relying on MCP SDK
    // private openIdAuthManager: OpenIdClientAuthManager

    constructor(serverName: string, serverURL: string) {
        this.client = new Client({ name: `mcp-client-for-${serverName}`, version: "1.0.0" })
        this.serverURL = serverURL
        this.authManager = new AuthManager(async (code, error) => {
            await this.onCallbackReceived(code, error)
        })

        // if to use openid-client instead
        // this.authManager = new OpenIdClientAuthManager(`${RESOURCE_SERVER_PROTOCOL}//${RESOURCE_SERVER_HOSTNAME}:${RESOURCE_SERVER_PORT}${MCP_ENDPOINT}`)
    }

    private async onCallbackReceived(code?: string, error?: string) {
        logMessage("call back received with code: ", code)
        if (code) {
            await this.transport?.finishAuth(code)
            this.authorizing = false
            return
        }
        if (error) {
            logMessage("Error authenticating: ", error)
            this.authorizing = false
            return
        }
    }

    // basic Funcitonalities
    async connectToServer() {
        const url = new URL(this.serverURL)
        const authProvider: OAuthClientProvider = getOAuthClientProvider(this.authManager)
        try {
            this.transport = new StreamableHTTPClientTransport(url, {
                /**
                 * An OAuth client provider to use for authentication.
                 *
                 * When an `authProvider` is specified and the connection is started:
                 * 1. The connection is attempted with any existing access token from the `authProvider`.
                 * 2. If the access token has expired, the `authProvider` is used to refresh the token.
                 * 3. If token refresh fails or no access token exists, and auth is required, `OAuthClientProvider.redirectToAuthorization` is called, and an `UnauthorizedError` will be thrown from `connect`/`start`.
                 *
                 * After the user has finished authorizing via their user agent, and is redirected back to the MCP client application, call `StreamableHTTPClientTransport.finishAuth` with the authorization code before retrying the connection.
                 *
                 * If an `authProvider` is not provided, and auth is required, an `UnauthorizedError` will be thrown.
                 *
                 * `UnauthorizedError` might also be thrown when sending any message over the transport, indicating that the session has expired, and needs to be re-authed and reconnected.
                 */
                authProvider: authProvider // omit this if using OpenIdClientAuthManager
            })

            await this.client.connect(this.transport)

            this.setUpNotifications()
        } catch (error) {
            logMessage("Failed to connect to MCP server: ", error)
            await this.handleError(error, async () => {
                await this.connectToServer()
            })

            // if to use openid-client instead
            // if (error instanceof UnauthorizedError) {
            //     this.openIdAuthManager.authorize()
            //     // access token will become available and we can start calling openIdAuthManager.accessProtectedEndpoint
            // } else {
            //     throw error
            // }
        }
    }

    async listTools() {
        try {
            const toolsResult = await this.client.listTools()
            logMessage('Available tools:', toolsResult.tools)
            this.tools = toolsResult.tools.map((tool) => {
                return {
                    name: tool.name,
                    description: tool.description ?? "",
                }
            })
        } catch (error) {
            logMessage(`Tools not supported by the server (${error})`)
            await this.handleError(error, async () => {
                await this.listTools()
            })

        }
    }

    async callTool(name: string) {
        try {
            logMessage('Calling tool: ', name)

            const result  = await this.client.callTool({
                name: name,
                arguments: { name: "itsuki"},
            })

            const content = result.content as object[]

            logMessage('Tool call results: ')
            content.forEach((item) => {
                const parse = TextContentSchema.safeParse(item)
                if (parse.success) {
                    logMessage(`- ${parse.data.text}`)
                }
            })
        } catch (error) {
            logMessage(`Error calling tool: ${error}`)

            await this.handleError(error, async () => {
                await this.callTool(name)
            })
        }

    }

    // Set up notification handlers for server-initiated messages
    private setUpNotifications() {
        this.client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
            logMessage("LoggingMessageNotificationSchema received: ", notification)
        })
        // will only be triggered after list tools called
        this.client.setNotificationHandler(ToolListChangedNotificationSchema, async (notification) => {
            logMessage("ToolListChangedNotificationSchema received: ", notification)
            await this.listTools()
        })
    }

    private async waitForConnection() {
        while (this.authorizing) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
    }

    private async handleError(error: unknown, retry: () => Promise<void>) {

        if (error instanceof UnauthorizedError) {
            this.authorizing = true
            logMessage("wait for authorization")
            await this.waitForConnection()
            logMessage("authorization finished")
            // retry the previous action that throws the error
            await retry()
        } else {
            throw error
        }
    }

    async cleanup() {
        await this.client.close()
    }
}