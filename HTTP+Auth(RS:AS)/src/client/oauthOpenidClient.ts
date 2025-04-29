/*******************************************************************/
/******** Authorization Implementations with openid-client *********/
/*******************************************************************/

// managing auth flow seperately from MCP with openid-client *******/
// NOTE: using 3rd party library will require us to send JSONRPC messages directly by POSTing directly to the MCP server instead of relying on MCP SDK

import * as client from 'openid-client'
import express, { Request, Response } from "express"
import puppeteer from 'puppeteer'
import { Server } from 'http'
import { CLIENT_SERVER_CALLBACK_PATH, CLIENT_SERVER_HOSTNAME, CLIENT_SERVER_PORT, CLIENT_SERVER_PROTOCOL } from '../configurationConstants.js'
import { logMessage } from './helper.js'

export class OpenIdClientAuthManager {
    private serverURL: URL
    private expressApp: express.Express
    private expressAppServer: Server | undefined = undefined
    private browser: puppeteer.Browser | undefined = undefined

    private redirectURI: string
    private scope: string | undefined = undefined

    private config: client.Configuration | undefined = undefined
    private codeVerifier: string | undefined = undefined
    private state: string | undefined = undefined

    private token: client.TokenEndpointResponse | undefined = undefined
    private error: string | undefined = undefined

    constructor(url: string) {
        this.serverURL = new URL(url)
        this.redirectURI = `${CLIENT_SERVER_PROTOCOL}//${CLIENT_SERVER_HOSTNAME}:${CLIENT_SERVER_PORT}${CLIENT_SERVER_CALLBACK_PATH}`

        const app = express()

        app.get(CLIENT_SERVER_CALLBACK_PATH, async (req: Request, res: Response) => {
            logMessage("client callback: ", req.url)

            await this.browser?.close()
            this.browser = undefined

            const error = req.query.error as string | undefined
            const code = req.query.code as string | undefined

            if (error) {
                logMessage("error requesting for authorization code: ", error)
                this.error = `error requesting for authorization code: ${error}`
            }

            if (code) {
                try {
                    this.token = await this.exchangeToken(req)
                } catch(error) {
                    logMessage("error exchanging token: ", error)
                    this.error = `error exchanging token: ${error}`
                }
            }

            res.sendStatus(200)

            // shut down the server
            setTimeout(()=> {
                this.expressAppServer?.close()
            }, 200)
        })

        this.expressApp = app
    }

    async authorize() {
        logMessage("try authorize")
        const [resource, authServerURL] = await this.getResourceAuthorizationServerURL()
        const result = await this.initializeAuthClient(authServerURL)

        if (result === false) {
            throw new Error("Failed to discover the server.")
        }

        const authURL = await this.getAuthURL(resource)

        // server started to receive callback
        this.expressAppServer = this.expressApp.listen(CLIENT_SERVER_PORT, () => {
            logMessage(`Client listening on port ${CLIENT_SERVER_PORT}`)
        })

        this.browser = await puppeteer.launch({
            headless: false,
            args: [`--window-size=400,300`]
        })

        const page = await this.browser.newPage()
        await page.goto(authURL.href)

        // wait for authorization to complete
        while (!this.token && !this.error) {
            await new Promise(resolve => setTimeout(resolve, 100))
        }

        if (this.error) {
            throw new Error(this.error)
        }

        return
    }


    async accessProtectedEndpoint(endpointURL: string, method: string, body?: client.FetchBody, headers?: Headers, ): Promise<{[key: string]: string}> {
        if (!this.config) {
            throw new Error("openid client.Configuration is not initialized.")
        }

        if (!this.token) {
            throw new Error("Access token is not exchanged.")
        }

        if (this.token.refresh_token) {
            const newToken = await this.refreshToken(this.token.refresh_token)
            const refresh = newToken.refresh_token ?? this.token.refresh_token
            this.token = {
                ...newToken,
                refresh_token: refresh
            }
        }

        const response = await client.fetchProtectedResource(this.config, this.token.access_token, new URL(endpointURL), method, body, headers)
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}, ${response.statusText}`)
        }
        const jsonResponse =  await response.json()
        return jsonResponse
    }


    private async getResourceAuthorizationServerURL(): Promise<[URL, URL]> {
        const url= new URL("/.well-known/oauth-protected-resource", this.serverURL);
        const response = await fetch(url);

        if (response.status === 404) {
          throw new Error(`Resource server does not implement OAuth 2.0 Protected Resource Metadata.`);
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} trying to load well-known OAuth protected resource metadata.`,);
        }
        // authorization_servers
        const body = await response.json()
        const authServerURLs = body.authorization_servers as string[] | undefined
        if (!authServerURLs || !this.isStringArray(authServerURLs) || authServerURLs.length === 0) {
            throw new Error("failed to get authorization_servers from protected resource metadata")
        }
        const resource = body.resource as string | undefined
        if (!resource) {
            throw new Error("failed to get resource from protected resource metadata")
        }

        return [new URL(resource), new URL(authServerURLs[0])]
    }


    isStringArray(value: any): boolean {
        return Array.isArray(value) && value.every(item => typeof item === 'string')
    }


    private async initializeAuthClient(authServerURL: URL): Promise<boolean> {

        try {
            this.config = await client.dynamicClientRegistration(
                authServerURL, {
                    redirect_uris: [this.redirectURI],
                    token_endpoint_auth_method: "client_secret_basic"
                }, undefined, {
                    // for protected registration, pass in the initialAccessToken here
                    initialAccessToken: undefined,
                    // Disable the HTTPS-only restriction for the discovery call
                    // Marked as deprecated only to make it stand out
                    execute: [client.allowInsecureRequests],
                    // Given the Issuer Identifier is https://example.com
                    // - oidc  => https://example.com/.well-known/openid-configuration
                    // - oauth => https://example.com/.well-known/oauth-authorization-server
                    algorithm: "oauth2" //default to oidc
                }
            )

            const clientMetadata = this.config.clientMetadata()

            const scopeGranted = clientMetadata.scope as string | undefined
            if (scopeGranted) {
                this.scope = scopeGranted
            } else if (this.config.serverMetadata().scopes_supported) {
                this.scope = this.config.serverMetadata().scopes_supported?.join(" ")
            }

            return true

        } catch(error) {
            logMessage(error)
            return false
        }
    }


    private async getAuthURL(resource: URL): Promise<URL> {
        if (!this.config) {
            throw new Error("openid client.Configuration is not initialized.")
        }

        this.codeVerifier = client.randomPKCECodeVerifier()
        const codeChallenge = await client.calculatePKCECodeChallenge(this.codeVerifier)

        const parameters: Record<string, string> = {
            redirect_uri: this.redirectURI,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            response_type: "code",
            resource: String(resource)
        }

        if (this.scope) {
            parameters.scope = this.scope
        }

        if (!this.config.serverMetadata().supportsPKCE()) {
            this.state = client.randomState()
            parameters.state = this.state
        }

        const serverAuthURL: URL = client.buildAuthorizationUrl(this.config, parameters)
        logMessage('redirecting to', serverAuthURL.href)

        return serverAuthURL
    }

    private async exchangeToken(req: Request): Promise<client.TokenEndpointResponse> {
        if (!this.config) {
            throw new Error("openid client.Configuration is not initialized.")
        }

        const token = await client.authorizationCodeGrant(this.config, new URL(`${CLIENT_SERVER_PROTOCOL}//${CLIENT_SERVER_HOSTNAME}:${CLIENT_SERVER_PORT}${req.url}`), {
            expectedState: this.state,
            pkceCodeVerifier: this.codeVerifier,
            idTokenExpected: false
        })

        return token
    }


    private async refreshToken(refreshToken: string): Promise<client.TokenEndpointResponse> {
        if (!this.config) {
            throw new Error("openid client.Configuration is not initialized.")
        }

        const tokens = await client.refreshTokenGrant(this.config, refreshToken)

        logMessage(tokens)
        return tokens
    }

}
