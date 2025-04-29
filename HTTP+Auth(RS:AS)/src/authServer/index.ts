import express, { Request, Response } from "express"
import { getServerMetadataJson, handleGetAuthorize , handlePostAuthorize, handlePostToken, handlePostClientRegistration, handlePostTokenRevocation, } from "./handlers.js"
import { AUTHORIZE_ENDPOINT, OAUTH_ROUTER_ENDPOINT, OTHER_ERROR_ENDPOINT, REGISTRATION_ENDPOINT, REVOCATION_ENDPOINT, AUTHORIZATION_SERVER_PORT, TOKEN_ENDPOINT, AUTHORIZATION_SERVER_HOSTNAME } from "../configurationConstants.js"
import { addDummyUserData } from "./oauth.js"
import { Server } from "http"
import { logMessage } from "./helper.js"


const app = express()
app.use(express.json())
app.use(express.urlencoded({extended: false}))

/*******************************/
/******* Auth Endpoint Set Up *******/
/*******************************/
const oauthRouter = express.Router()

// Get /oauth/authorize
// Since we only want to authorize on Post AUTHORIZE_ENDPOINT
// either redirect to a login endpoint or
// Show login form/registration from in this endpoint
// to collect user credentials and post to `AUTHORIZE_ENDPOINT` with the same query parameters
oauthRouter.get(AUTHORIZE_ENDPOINT, async (req: Request, res: Response) => {
    handleGetAuthorize(req, res)
})

// actual authorization
oauthRouter.post(AUTHORIZE_ENDPOINT, async (req: Request, res: Response) => {
    handlePostAuthorize(req, res)
})

// error endpoint
// show authorization error when redirect uri missing
oauthRouter.get(OTHER_ERROR_ENDPOINT, async (req: Request, res: Response) => {
    let error = req.query.error  ?? "unknown error"
    res.render("authorizationServer/error.ejs", {
        errorMessage: `${error}`
    })
})

// token exchange
// - access token if grant_type is authorization_code
// - refresh token if grant_type is refresh_token
// (automatically handled by OAuth2Server
oauthRouter.post(TOKEN_ENDPOINT, async (req: Request, res: Response) => {
    handlePostToken(req, res)
})

oauthRouter.post(REVOCATION_ENDPOINT, async (req: Request, res: Response) => {
    handlePostTokenRevocation(req, res)
})

// dynamic registration
oauthRouter.post(REGISTRATION_ENDPOINT, async (req: Request, res: Response) => {
    handlePostClientRegistration(req, res)
})

app.use(OAUTH_ROUTER_ENDPOINT, oauthRouter)

// Authorization Server Metadata endpoint
// specification: https://datatracker.ietf.org/doc/html/rfc8414
// either /.well-known/openid-configuration or /.well-known/oauth-authorization-server will work
const OAUTH_METADATA_ENDPOINT = "/.well-known/oauth-authorization-server"
const OPENID_METADATA_ENDPOINT = "/.well-known/openid-configuration"
app.get(OAUTH_METADATA_ENDPOINT, async (req: Request, res: Response) => {
    getServerMetadataJson(req, res)
})
app.get(OPENID_METADATA_ENDPOINT, async (req: Request, res: Response) => {
    getServerMetadataJson(req, res)
})


let expressAppServer: Server | undefined = undefined
export function startAuthorizationServer() {

    expressAppServer = app.listen(AUTHORIZATION_SERVER_PORT, AUTHORIZATION_SERVER_HOSTNAME, () => {
        logMessage(`Authorization Server listening on ${AUTHORIZATION_SERVER_HOSTNAME}:${AUTHORIZATION_SERVER_PORT}.`)
    })

    addDummyUserData()

    process.on('SIGINT', async () => {
        logMessage('Shutting down authorization server...')
        process.exit(0)
    })
}

export function stopAuthorizationServer() {
    expressAppServer?.close()
    logMessage('Shutting down authorization server...')
}



if (process.argv[2] === "startAuthorizationServer") {
    startAuthorizationServer()
}