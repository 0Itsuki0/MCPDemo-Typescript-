/****************************************************/
/******** Non-MCP API handlers & Middleware *********/
/****************************************************/

import jwt, { JwtPayload } from 'jsonwebtoken'
import { NextFunction, Request, Response } from "express"
import { AUTHORIZATION_SERVER_HOSTNAME, AUTHORIZATION_SERVER_PORT, RESOURCE_SERVER_PROTOCOL, RESOURCE_SERVER_HOSTNAME, RESOURCE_SERVER_PORT, AUTHORIZATION_SERVER_PROTOCOL } from '../configurationConstants.js'
import { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import dotenv from "dotenv"
// import { verifyScopes } from './helper.js'
import { PROTECTED_RESOURCE_METADATA_ENDPOINT } from './index.js'
import { logMessage } from './helper.js'

dotenv.config()

const ACCESS_TOKEN_SIGN_ALGORITHM: jwt.Algorithm = process.env.ACCESS_TOKEN_SIGN_ALGORITHM as jwt.Algorithm ?? "RS256"
const ACCESS_TOKEN_SIGN_SECRET = process.env.ACCESS_TOKEN_SIGN_SECRET

declare module "express-serve-static-core" {
    interface Request {
      /**
       * Information about the validated access token, if the `requireBearerAuth` middleware was used.
       */
      auth?: AuthInfo
    }
}

const WWW_AUTHENTICATE_HEADER = "WWW-Authenticate"
const REALM = "mcp"
const TOKEN_VALIDATION_ERROR_CODE = {
    invalidToken: "invalid_token",
    invalidRequest: "invalid_request",
    insufficientScope: "insufficient_scope"
} as const

const ALLOWED_JWT_TYP_HEADERS = ["at+jwt", "application/at+jwt"]

type TOKEN_VALIDATION_ERROR_CODE = (typeof TOKEN_VALIDATION_ERROR_CODE)[keyof typeof TOKEN_VALIDATION_ERROR_CODE]

// middleware to verify access token and extract authorization info
// token validation specification: https://www.rfc-editor.org/rfc/rfc9068.html#name-validating-jwt-access-token
export function verifyAccessToken(req: Request, res: Response, next: NextFunction, requiredScopes?: string[]) {
    if (!ACCESS_TOKEN_SIGN_ALGORITHM || !ACCESS_TOKEN_SIGN_SECRET) {
        res.status(500).json({
            error: "server_error"
        })
        return
    }

    const authHeader = req.headers.authorization

    // If the request lacks any authentication information (e.g., the client
    // was unaware that authentication is necessary or attempted using an
    // unsupported authentication method), the resource server SHOULD NOT
    // include an error code or other error information.
    if (!authHeader) {
        sendUnauthorizedErrorResponse(res, REALM)
        return
    }

    const [type, token] = authHeader.split(' ')
    if (type.toLowerCase() !== 'bearer' || !token) {
        sendUnauthorizedErrorResponse(res, REALM)
        return
    }

    let decoded: jwt.Jwt

    try {
        decoded = jwt.verify(token, ACCESS_TOKEN_SIGN_SECRET, {
            algorithms: [ACCESS_TOKEN_SIGN_ALGORITHM],
            issuer: `${AUTHORIZATION_SERVER_PROTOCOL}//${AUTHORIZATION_SERVER_HOSTNAME}:${AUTHORIZATION_SERVER_PORT}`,
            audience: `${RESOURCE_SERVER_PROTOCOL}//${RESOURCE_SERVER_HOSTNAME}:${RESOURCE_SERVER_PORT}`,
            ignoreExpiration: false,
            ignoreNotBefore: false,
            complete: true,
        })
    } catch(error) {
        logMessage("Error verifying jwt token: ", error)
        let description: string | undefined = undefined
        if (error instanceof Error) {
            description = error.message
        }
        sendUnauthorizedErrorResponse(res, REALM, TOKEN_VALIDATION_ERROR_CODE.invalidToken, description)
        return
    }

    if (!ALLOWED_JWT_TYP_HEADERS.find(h => h.toLowerCase() === decoded.header.typ?.toLowerCase())) {
        logMessage("Error verifying jwt token: invalid header")
        sendUnauthorizedErrorResponse(res, REALM, TOKEN_VALIDATION_ERROR_CODE.invalidToken, "Invalid header type.")
        return
    }

    const payload = decoded.payload as JwtPayload

    const scopes = ((payload.scope as string | undefined) ?? "").split(" ")

    // verify scoep if neccesary
    // However, the current MCP SDK client auth flow (startAuthorization function) will NOT request for an authorization code with scopes
    // and consequently the access token will not have scope contained
    // (Also partially dependent on how the authroization server implement the scope behavior.)
    // if (!verifyScopes(scopes, requiredScopes)) {
    //     sendUnauthorizedErrorResponse(res, REALM, ERROR_CODE.insufficientScope)
    //     return
    // }

    req.auth = {
        token,
        clientId: payload.client_id,
        scopes: scopes,
        expiresAt: payload.exp
    }

    next()
}

export function sendUnauthorizedErrorResponse(res: Response, realm: string, error?: TOKEN_VALIDATION_ERROR_CODE, error_description?: string, requiredScopes?: string[]) {
    let bearer = `Bearer realm="${realm}", resource_metadata="${RESOURCE_SERVER_PROTOCOL}//${RESOURCE_SERVER_HOSTNAME}:${RESOURCE_SERVER_PORT}${PROTECTED_RESOURCE_METADATA_ENDPOINT}"`
    if (error) {
        bearer = `${bearer}, error="${error}"`
    }
    if (error_description) {
        bearer = `${bearer}, error_description="${error_description}"`
    }
    if (requiredScopes) {
        bearer = `${bearer}, scope="${requiredScopes.join(" ")}"`
    }
    res.setHeader(WWW_AUTHENTICATE_HEADER, bearer)
    res.sendStatus(401)
    return
}


// get /.well-known/oauth-protected-resource
// specification: https://datatracker.ietf.org/doc/html/rfc9728
export function getProtectedResourceMetadataJson(req: Request, res: Response) {
    logMessage("GetProtectedResourceMetadata received")
    const baseURL = `${req.protocol}://${req.host}`
    res.json({
        "resource": baseURL,
        "authorization_servers": [`${AUTHORIZATION_SERVER_PROTOCOL}//${AUTHORIZATION_SERVER_HOSTNAME}:${AUTHORIZATION_SERVER_PORT}`]
    })
}