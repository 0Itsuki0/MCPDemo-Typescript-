/************************************************/
/******** Authorization Implementations *********/
/************************************************/

import {  OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"
import express, { Request, Response } from "express"
import puppeteer from 'puppeteer'
import { OAuthClientInformation, OAuthClientInformationFull, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js"
import { Server } from "http"
import { CLIENT_SERVER_CALLBACK_PATH, CLIENT_SERVER_HOSTNAME, CLIENT_SERVER_PORT, CLIENT_SERVER_PROTOCOL } from "../configurationConstants.js"
import { logMessage } from "./helper.js"


export function getOAuthClientProvider(authManager: AuthManager): OAuthClientProvider {
    const authProvider: OAuthClientProvider = {
        redirectUrl: authManager.redirectURI,
        clientMetadata: {
            redirect_uris: [authManager.redirectURI],
            scope: undefined,
            token_endpoint_auth_method: undefined,
            grant_types: undefined,
            response_types: undefined,
            client_name: undefined,
            client_uri: undefined,
            logo_uri: undefined,
            contacts: undefined,
            tos_uri: undefined,
            policy_uri: undefined,
            jwks_uri: undefined,
            jwks: undefined,
            software_id: undefined,
            software_version: undefined
        },
        // Loads information about this OAuth client, as registered already with the server, or returns undefined if the client is not registered with the server.
        clientInformation: function (): OAuthClientInformation | undefined | Promise<OAuthClientInformation | undefined> {
            return authManager.clientInfo
        },
        saveClientInformation(clientInformation: OAuthClientInformationFull): void | Promise<void> {
            authManager.clientInfo = clientInformation
        },

        // Loads any existing OAuth tokens for the current session, or returns undefined if there are no saved tokens.
        tokens: function (): OAuthTokens | undefined | Promise<OAuthTokens | undefined> {
            return authManager.token
        },
        // Stores new OAuth tokens for the current session, after a successful authorization.
        saveTokens: function (tokens: OAuthTokens): void | Promise<void> {
            authManager.token = tokens
        },
        // Invoked to redirect the user agent to the given URL to begin the authorization flow.
        redirectToAuthorization: function (authorizationUrl: globalThis.URL): void | Promise<void> {
            return authManager.redirectToAuthorization(authorizationUrl)
        },
        // Saves a PKCE code verifier for the current session, before redirecting to the authorization flow.
        saveCodeVerifier: function (codeVerifier: string): void | Promise<void> {
            authManager.codeVerifier = codeVerifier
        },

        // Loads the PKCE code verifier for the current session, necessary to validate the authorization result.
        codeVerifier: function (): string | Promise<string> {
            const codeVerifier = authManager.codeVerifier
            if (!codeVerifier) {
                throw new Error("No codeVerifier saved for the current session")
            }
            return codeVerifier
        }
    }

    return authProvider
}


export class AuthManager {
    redirectURI: string
    token: OAuthTokens | undefined = undefined
    codeVerifier: string | undefined = undefined
    clientInfo: OAuthClientInformationFull | undefined = undefined

    private expressApp: express.Express
    private expressAppServer: Server | undefined = undefined

    private browser: puppeteer.Browser | undefined = undefined

    constructor(onCallbackTriggered: (code?: string, error?: string) => Promise<void>) {
        this.redirectURI = `${CLIENT_SERVER_PROTOCOL}//${CLIENT_SERVER_HOSTNAME}:${CLIENT_SERVER_PORT}${CLIENT_SERVER_CALLBACK_PATH}`

        const app = express()

        app.get(CLIENT_SERVER_CALLBACK_PATH, async (req: Request, res: Response) => {

            await this.browser?.close()
            this.browser = undefined

            const error = req.query.error as string | undefined
            const code = req.query.code as string | undefined

            await onCallbackTriggered(code, error)

            res.sendStatus(200)

            // shut down the server
            setTimeout(()=> {
                this.expressAppServer?.close()
            }, 200)
        })

        this.expressApp = app
    }


    async redirectToAuthorization(url: URL) {
         // start server so that we can receive callback
        this.expressAppServer = this.expressApp.listen(CLIENT_SERVER_PORT, CLIENT_SERVER_HOSTNAME, () => {
            logMessage(`Client Server listening on ${CLIENT_SERVER_HOSTNAME}:${CLIENT_SERVER_PORT}.`)
        })

        this.browser = await puppeteer.launch({
            headless: false,
            args: [`--window-size=400,300`]
        })

        const page = await this.browser.newPage()
        await page.goto(url.href)
    }
}
