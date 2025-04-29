/*******************************/
/******** API handlers *********/
/*******************************/

import { Request, Response } from "express"
import OAuth2Server, {  UnauthorizedRequestError } from "@node-oauth/oauth2-server"
import crypto from "crypto"

import { getClientIdSecretFromRequest, getStatusCode, isRedirectURIAllowed, isStringArray, logMessage } from "./helper.js"
import { decryptFromClientId, encryptToClientId } from "./encrypt.js"
import { _AuthCode, _AccessToken, _User, _RefreshToken } from "./types.js"
import { AUTHORIZE_ENDPOINT, CODE_CHALLENGE_METHODS, GRANT_TYPES, OAUTH_ROUTER_ENDPOINT, OTHER_ERROR_ENDPOINT, MCP_SCOPE, RESPONSE_TYPES, REVOCATION_ENDPOINT, TOKEN_ENDPOINT, AUTH_METHODS, ACCESS_TOKEN_LIFETIME, REFRESH_TOKEN_LIFETIME, REGISTRATION_ENDPOINT } from "../configurationConstants.js"
import { toUser, _revokeToken, getClient, getDBUser, server } from "./oauth.js"



// The starting point of the authorization request
// request specification: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12#name-authorization-request
export async function handleGetAuthorize(req: Request, res: Response) {
    logMessage("GetAuthorize received: ", req.url)

    const redirectUri = req.query.redirect_uri
    if (!redirectUri) {
        const errorMessage = "Missing `redirect_uri`."
        const error = "invalid_request"
        res.redirect(`${OAUTH_ROUTER_ENDPOINT}${OTHER_ERROR_ENDPOINT}?error=${error}&error_description=${errorMessage}`)
        return
    }

    if (typeof(redirectUri) !== "string") {
        const errorMessage = "Invalid parameter: `redirect_uri`."
        const error = "invalid_request"
        res.redirect(`${OAUTH_ROUTER_ENDPOINT}${OTHER_ERROR_ENDPOINT}?error=${error}&error_description=${errorMessage}`)
        return
    }

    try {

        const clientId = req.query.client_id
        if (!clientId) {
            throw new Error("Missing parameter: `client_id`", { cause: "invalid_request" })
        }

        if (typeof(clientId) !== "string") {
            throw new Error("Invalid parameter: `client_id`", { cause: "invalid_request" })
        }

        const response_type = req.query.response_type
        if (!response_type) {
            throw new Error("Missing parameter: `response_type`", { cause: "invalid_request" })
        }

        if (typeof(response_type) !== "string") {
            throw new Error("Invalid parameter: `response_type`", { cause: "invalid_request" })
        }

        // checkif state of code_challenge if present if
        const state = req.query.state as string | undefined
        const codeChallenge = req.query.code_challenge as string | undefined
        if (!state && !codeChallenge) {
            throw new Error("Either `state` or `code_challenge` is required to ensure security.", { cause: "invalid_request" })
        }

        const fullURL = new URL(`${req.protocol}://${req.host}${req.originalUrl}`)
        const postURL = `${OAUTH_ROUTER_ENDPOINT}${AUTHORIZE_ENDPOINT}${fullURL.search}`

        res.render("authorizationServer/login.ejs", {
            authURL: postURL
        })

    } catch (error) {
        logMessage("Error on GetAuthorize: ", error)
        const url = new URL(redirectUri)
        if (error instanceof Error) {
            url.searchParams.append("error",  (error.cause as string | undefined ) ?? "invalid_request")
            url.searchParams.append("error_description",  error.message)
        } else {
            url.searchParams.append("error",  "invalid_request")
        }
        res.redirect(url.href)
        return
    }
}

// request specification: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12#name-authorization-request
// response specification: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12#name-authorization-response
// error specification: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12#section-4.1.2.1
export async function handlePostAuthorize(req: Request, res: Response) {
    logMessage(`PostAuthorize received. URL: ${req.url}, body: ${req.body}`)

    const state = req.query.state as string | undefined

    const redirectUri = req.query.redirect_uri
    if (!redirectUri) {
        const errorMessage = "Missing `redirect_uri`."
        res.redirect(`${OAUTH_ROUTER_ENDPOINT}${OTHER_ERROR_ENDPOINT}?error=${errorMessage}`)
        return
    }

    if (typeof(redirectUri) !== "string") {
        const errorMessage = "Invalid parameter: `redirect_uri`."
        res.redirect(`${OAUTH_ROUTER_ENDPOINT}${OTHER_ERROR_ENDPOINT}?error=${errorMessage}`)
        return
    }

    try {

        const email = (req.body?.email || req.query.email) as string | undefined
        const password = (req.body?.password || req.query.password) as string | undefined
        if (!password || !email) {
            throw new Error("Missing `email` or `password`.", { cause: "invalid_request" })
        }

        if (typeof(password) !== "string" || typeof(email) !== "string" ) {
            throw new Error("Invalid `email` or `password`.`", { cause: "invalid_request" })
        }

        const resource = req.query.resource
        if (!resource) {
            throw new Error("Missing parameter: `resource`", { cause: "invalid_request" })
        }

        if (typeof(resource) !== "string") {
            throw new Error("Invalid parameter: `resource`", { cause: "invalid_request" })
        }

        const clientId = req.query.client_id
        if (!clientId) {
            throw new Error("Missing parameter: `client_id`", { cause: "invalid_request" })
        }

        if (typeof(clientId) !== "string") {
            throw new Error("Invalid parameter: `client_id`", { cause: "invalid_request" })
        }
        const client = decryptFromClientId(clientId)

        if (!client.redirectUris.find(u => u === redirectUri)) {
            // inform the resource owner (user) instead of sending to the redirect uri
            const errorMessage = "`redirect_uri` mismatch"
            res.redirect(`${OAUTH_ROUTER_ENDPOINT}${OTHER_ERROR_ENDPOINT}?error=${errorMessage}`)
            return
        }


        const request = new OAuth2Server.Request(req)
        const response = new OAuth2Server.Response(res)

        const code = await server.authorize(request, response, {
            allowEmptyState: true,
            authenticateHandler: {
                handle: async function() {
                    //retrieve the user associated with the request
                    const user = await getDBUser(email, password)
                    return {
                        resource: resource,
                        ...user
                    }
                }
            }
        })

        const url = new URL(redirectUri)
        url.searchParams.append("code", code.authorizationCode)
        if (state) {
            url.searchParams.append("state", state)
        }

        res.redirect(url.href)

    } catch (error) {
        logMessage("Error in PostAuthroize: ", error)
        const url = new URL(redirectUri)

        if (error instanceof UnauthorizedRequestError) {
            url.searchParams.append("error", "unauthorized_client")
        } else if (error instanceof Error) {
            url.searchParams.append("error",  (error.cause as string | undefined ) ?? "invalid_request")
            url.searchParams.append("error_description",  error.message)
        } else {
            url.searchParams.append("error", "invalid_request")
        }

        if (state) {
            url.searchParams.append("state", state)
        }

        res.redirect(url.href)
        return
    }
}


// post in url-encoded form to exchange code for token, or request for a new access token using a refresh token
// code -> access token
// request specification: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12#name-token-request
// response specification: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12#name-token-response
// error specification: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12#name-error-response
// refresh token -> access token
// request specification: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12#name-token-endpoint-extension-3
// response specification: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-12#name-refresh-token-response
export async function handlePostToken(req: Request, res: Response) {
    logMessage("PostToken received: ", req.body)

    try {
        const clientId = req.body.client_id
        if (!clientId) {
            throw new Error("Missing parameter: `client_id`", { cause: "invalid_request" })
        }

        if (typeof(clientId) !== "string") {
            throw new Error("Invalid parameter: `client_id`", { cause: "invalid_request" })
        }

        const client = await getClient(clientId)

        const request = new OAuth2Server.Request(req)
        const response = new OAuth2Server.Response(res)

        const token = await server.token(request, response, {
            alwaysIssueNewRefreshToken: false,
            // in seconds (default = 1 hour)
            accessTokenLifetime: client.accessTokenLifetime ?? ACCESS_TOKEN_LIFETIME,
            // in seconds (default to 2 weeks)
            refreshTokenLifetime: client.refreshTokenLifetime ?? REFRESH_TOKEN_LIFETIME
        })

        res.json({
            access_token: token.accessToken,
            refresh_token: token.refreshToken,
            // scope needs to be a space separated string
            scope: token.scope?.join(" ") ?? "",
            expires_in: client.accessTokenLifetime ?? 60*60,
            token_type: "bearer",
        })

    } catch(error) {
        logMessage("Error in postToken: ", error)
        if (error instanceof Error) {
            const cause = error.cause as string | undefined
            const status = getStatusCode(cause)
            res.status(status).json({
                error: cause ?? "invalid_request",
                error_description: error.message
            })
        } else {
            res.status(400).json({
                error: "invalid_request",
                error_description: `${error}`
            })
        }
        return
    }
}


// POST as application/x-www-form-urlencoded
// request specification: https://datatracker.ietf.org/doc/html/rfc7009#section-2.1
// response specification: https://datatracker.ietf.org/doc/html/rfc7009#section-2.2
// Error response specification: https://datatracker.ietf.org/doc/html/rfc7009#section-2.2.1
export async function handlePostTokenRevocation(req: Request, res: Response) {

    const token = (req.body?.token || req.query.token) as string | undefined
    const tokenType = (req.body?.token_type_hint || req.query.token_type_hint) as string | undefined

    // NOTE: invalid tokens do not cause an error response since the client cannot handle such an error in a reasonable way
    if (!token) {
        res.status(200).json({})
        return
    }

    const {clientId} = getClientIdSecretFromRequest(req)

    if (!clientId) {
        res.status(400).json({
            error: "invalid_client"
        })
        return
    }

    _revokeToken(token, clientId)

    res.status(200).json({})
}


// dynamic client registration endpoint
// request specification: https://datatracker.ietf.org/doc/html/rfc7591#section-3.1
// response specification: https://datatracker.ietf.org/doc/html/rfc7591#section-3.2.1
// error specification: https://datatracker.ietf.org/doc/html/rfc7591#section-3.2.2
export async function handlePostClientRegistration(req: Request, res: Response) {
    logMessage("PostClientRegistration received: ", req.body)
    const body = req.body

    try {
        // for grant types such as "authorization_code" and "implicit", redirection URI are required
        // https://datatracker.ietf.org/doc/html/rfc7591#section-5
        if (!isStringArray(body.redirect_uris)) {
            throw new Error("`redirect_uris` is not a string array.", { cause: "invalid_redirect_uri" })
        }

        const redirectURIs = body.redirect_uris as string[]
        if (redirectURIs.length === 0) {
            throw new Error("`redirect_uris` is required.", { cause: "invalid_redirect_uri" })
        }
        const allowed = redirectURIs.every(uri => isRedirectURIAllowed(uri))
        if (!allowed) {
            throw new Error("`redirect_uris` contains uris not allowed.", { cause: "invalid_redirect_uri" })
        }

        const authMethodRequested = body.token_endpoint_auth_method as string | undefined
        let authMethod = AUTH_METHODS[0]

        if (authMethodRequested && typeof(authMethodRequested) === "string") {
            authMethod = AUTH_METHODS.find(m => m === authMethodRequested) ?? AUTH_METHODS[0]
        }

        const clientSecret = crypto.randomBytes(32).toString("hex")
        // Time at which the client secret will expire (as timestamp) or 0 if it will not expire.
        // if the key and iv used to encrypt rotate, set this according to the rotation period
        const secretExpiredAt = 0

        const clientId = encryptToClientId(clientSecret, redirectURIs)

        res.status(201).json({
            client_id: clientId,
            client_secret: clientSecret,
            client_secret_expires_at: secretExpiredAt,
            redirect_uris: redirectURIs,
            grant_types: GRANT_TYPES,
            token_endpoint_auth_method: authMethod,
            scope: [MCP_SCOPE].join(" ")
        })

        return

    } catch(error) {
        logMessage("Error in PostClientRegistration: ", error)
        if (error instanceof Error) {
            const cause = error.cause as string | undefined
            const status = getStatusCode(cause)
            res.status(status).json({
                error: cause ?? "invalid_request",
                error_description: error.message
            })
        } else {
            res.status(400).json({
                error: "invalid_request",
                error_description: `${error}`
            })
        }

        return
    }
}



// grant type and response type relation
//
// +-----------------------------------------------+-------------------+
// | grant_types value includes:                   | response_types    |
// |                                               | value includes:   |
// +-----------------------------------------------+-------------------+
// | authorization_code                            | code              |
// | implicit                                      | token             |
// | password                                      | (none)            |
// | client_credentials                            | (none)            |
// | refresh_token                                 | (none)            |
// | urn:ietf:params:oauth:grant-type:jwt-bearer   | (none)            |
// | urn:ietf:params:oauth:grant-type:saml2-bearer | (none)            |
// +-----------------------------------------------+-------------------+

export function getServerMetadataJson(req: Request, res: Response) {
    logMessage("GetServerMetadataJson received.")

    const baseURL = `${req.protocol}://${req.host}`
    res.json({
        "issuer": baseURL,
        "authorization_endpoint": `${baseURL}${OAUTH_ROUTER_ENDPOINT}${AUTHORIZE_ENDPOINT}`,
        "token_endpoint": `${baseURL}${OAUTH_ROUTER_ENDPOINT}${TOKEN_ENDPOINT}`,
        // https://datatracker.ietf.org/doc/html/rfc7591#section-2
        // possible values: https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#token-endpoint-auth-method
        // "none": The client is a public client and does not have a client secret
        "token_endpoint_auth_method": AUTH_METHODS,
        "scopes_supported": [MCP_SCOPE],
        "grant_types_supported": GRANT_TYPES,
        "response_types_supported": RESPONSE_TYPES,
        "code_challenge_methods_supported": CODE_CHALLENGE_METHODS,
        "revocation_endpoint": `${baseURL}${OAUTH_ROUTER_ENDPOINT}${REVOCATION_ENDPOINT}`,
        "registration_endpoint": `${baseURL}${OAUTH_ROUTER_ENDPOINT}${REGISTRATION_ENDPOINT}`,
        // possible values: https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#token-endpoint-auth-method
        "revocation_endpoint_auth_methods_supported": AUTH_METHODS,
    })
}
