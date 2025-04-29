/****************************************************************************/
/******** OAuth2 Server Implementations *********/
/****************************************************************************/

import OAuth2Server, { AuthorizationCode, Client, RefreshToken, Token, User } from "@node-oauth/oauth2-server"
import { _AuthCode, _AccessToken, _User, _RefreshToken } from "./types.js"
import { ACCESS_TOKEN_LIFETIME, AUTHORIZATION_SERVER_HOSTNAME, AUTHORIZATION_SERVER_PORT, AUTHORIZATION_SERVER_PROTOCOL, GRANT_TYPES, REFRESH_TOKEN_LIFETIME } from "../configurationConstants.js"
import { decryptFromClientId } from "./encrypt.js"
import jwt from 'jsonwebtoken'
import dotenv from "dotenv"
import crypto from "crypto"

dotenv.config()

const ACCESS_TOKEN_SIGN_ALGORITHM: jwt.Algorithm = process.env.ACCESS_TOKEN_SIGN_ALGORITHM as jwt.Algorithm ?? "RS256"
const ACCESS_TOKEN_SIGN_SECRET = process.env.ACCESS_TOKEN_SIGN_SECRET


// potentially some DB Table
export let USER_TABLE: _User[] = []
export let AUTH_CODE_TABLE: _AuthCode[] = []
export let ACCESS_TOKEN_TABLE: _AccessToken[] = []
export let REFRESH_TOKEN_TABLE: _RefreshToken[] = []

export function addDummyUserData() {
    USER_TABLE.push({
        userId: "0000001",
        email: "itsuki@itsuki.com",
        password: "000"
    })
}

/*******************************/
/******* model handlers *******/
/*******************************/
async function generateAccessToken(client: Client, user: User, scope: string[]): Promise<string> {

    if (!ACCESS_TOKEN_SIGN_ALGORITHM || !ACCESS_TOKEN_SIGN_SECRET) {
        throw new Error("Missing server configuration.", { cause: "server_error"})
    }

    let payload: {[key: string]: any} = {
        iss: `${AUTHORIZATION_SERVER_PROTOCOL}//${AUTHORIZATION_SERVER_HOSTNAME}:${AUTHORIZATION_SERVER_PORT}`,
        scope: scope.join(" "),
        client_id: client.id,
        sub: user.userId,
        jti: crypto.randomBytes(12).toString("hex"),
    }

    if (user.resource) {
        payload.aud = user.resource
    }

    const token = jwt.sign(payload, ACCESS_TOKEN_SIGN_SECRET, {
        algorithm: ACCESS_TOKEN_SIGN_ALGORITHM,
        expiresIn: "60min",
        header: {
            typ: "at+jwt",
            alg: ACCESS_TOKEN_SIGN_ALGORITHM
        }
    })

    return token
}


async function getAuthorizationCode(authorizationCode: string): Promise<AuthorizationCode> {

    const code = AUTH_CODE_TABLE.find(c => c.authorizationCode === authorizationCode)
    if (!code) {
        throw new Error("Authorization code not found", { cause: "invalid_grant" })
    }

    const client = await getClient(code.clientId)
    const user = await toUser(code.userId, code.resource)

    if (!client || !user) {
        throw new Error("Client or user is not found for the authorization code", { cause: "invalid_grant" })
    }
    return toCode(code, client, user)
}

// client and user will not be available in the original `code`
async function saveAuthorizationCode(code: Pick<AuthorizationCode, 'authorizationCode' | 'expiresAt' | 'redirectUri' | 'scope' | 'codeChallenge' | 'codeChallengeMethod'>, client: Client, user: User): Promise<AuthorizationCode> {

    const authCode: _AuthCode = {
        authorizationCode: code.authorizationCode,
        expiresAt: code.expiresAt,
        redirectUri: code.redirectUri,
        scope: code.scope ?? [],
        clientId: client.id,
        userId: user.userId,
        codeChallenge: code.codeChallenge,
        codeChallengeMethod: code.codeChallengeMethod,
        resource: user.resource
    }

    AUTH_CODE_TABLE.push(authCode)

    return toCode(authCode, client, user)
}

async function revokeAuthorizationCode(code: AuthorizationCode): Promise<boolean> {
    const old = AUTH_CODE_TABLE.length
    AUTH_CODE_TABLE = AUTH_CODE_TABLE.filter(c => c.authorizationCode !== code.authorizationCode)
    return AUTH_CODE_TABLE.length < old
}


// clientSecret will be null when called from authorize endpoint,
// ie: invoke due to calling OAuth2Server.authorize(request, response, [options])
export async function getClient(clientId: string, clientSecret?: string): Promise<Client> {

    const client = decryptFromClientId(clientId)

    if (clientSecret !== undefined && clientSecret !== null ) {
        if (client.clientSecret !== clientSecret) {
            throw new Error("Invalid Client Secret.", { cause: "invalid_client" })
        }
    }

    return {
        id: clientId,
        redirectUris: client.redirectUris,
        grants: GRANT_TYPES,
        accessTokenLifetime: ACCESS_TOKEN_LIFETIME,
        refreshTokenLifetime: REFRESH_TOKEN_LIFETIME
    }
}

// client and user will not be available in the original `token` object
async function saveToken(token: Token, client: Client, user: User): Promise<Token> {

    const accessToken: _AccessToken = {
        accessToken: token.accessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        scope: token.scope ?? [],
        clientId: client.id,
        userId: user.userId,
    }

    ACCESS_TOKEN_TABLE.push(accessToken)

    let refreshToken: _RefreshToken | undefined
    if (token.refreshToken) {
        refreshToken = {
            refreshToken: token.refreshToken,
            refreshTokenExpiresAt: token.refreshTokenExpiresAt,
            scope: token.scope ?? [],
            clientId: client.id,
            userId: user.userId,
        }
        REFRESH_TOKEN_TABLE.push(refreshToken)
    }

    return toAccessToken(accessToken, client, user, refreshToken)
}

async function getAccessToken(accessToken: string): Promise<Token> {

    const token = ACCESS_TOKEN_TABLE.find(t => t.accessToken === accessToken)
    if (!token) {
        throw new Error("Access token not found", { cause: "invalid_grant" })
    }

    const client = await getClient(token.clientId)

    const decoded = jwt.decode(accessToken) as jwt.JwtPayload
    const user = await toUser(token.userId, decoded.aud as string | undefined)
    if (!client || !user) {
        throw new Error("Client or user is not found for the access token", { cause: "invalid_grant" })
    }

    return toAccessToken(token, client, user, undefined)
}

async function getRefreshToken(refreshToken: string): Promise<RefreshToken> {

    const token = REFRESH_TOKEN_TABLE.find(t => t.refreshToken === refreshToken)
    if (!token) {
        throw new Error("Refresh token not found", { cause: "invalid_grant" })
    }
    const client = await getClient(token.clientId)
    const user = await toUser(token.userId)
    if (!client || !user) {
        throw new Error("Client or user is not found for the refresh token", { cause: "invalid_grant" })

    }
    return toRefreshToken(token, client, user)
}

async function revokeToken(token: RefreshToken): Promise<boolean> {

    const old = REFRESH_TOKEN_TABLE.length
    REFRESH_TOKEN_TABLE = REFRESH_TOKEN_TABLE.filter(t => t.refreshToken !== token.refreshToken)
    return REFRESH_TOKEN_TABLE.length < old
}



/***********************/
/******* Helpers *******/
/***********************/
// get the DATABASE user
export async function getDBUser(email: string, password: string): Promise<_User> {

    const user = USER_TABLE.find(u => u.email === email && u.password === password)
    if (!user) {
        throw new Error("User not found", { cause: "invalid_request" })
    }

    return user
}

// to OAuth User
// include the `resource` in addition to the DB user.
// Needed to pass the information down to model functions for, for example, token generation.
export async function toUser(userId: string, resource?: string): Promise<User> {

    const user = USER_TABLE.find(u => u.userId === userId)
    if (!user) {
        throw new Error("User not found", { cause: "invalid_request" })
    }

    return {
        resource: resource,
        ...user
    }
}


function toCode(code: _AuthCode, client: Client, user: User): AuthorizationCode {
    return {
        authorizationCode: code.authorizationCode,
        expiresAt: code.expiresAt,
        redirectUri: code.redirectUri,
        scope: code.scope,
        client: client,
        user: user,
        codeChallenge: code.codeChallenge,
        codeChallengeMethod: code.codeChallengeMethod,
    }
}


function toAccessToken(accessToken: _AccessToken, client: Client, user: User, refreshToken?: _RefreshToken): Token {
    return {
        accessToken: accessToken.accessToken,
        accessTokenExpiresAt: accessToken.accessTokenExpiresAt,
        refreshToken: refreshToken?.refreshToken,
        refreshTokenExpiresAt: refreshToken?.refreshTokenExpiresAt,
        scope: accessToken.scope,
        client: client,
        user:user
    }
}

function toRefreshToken(refreshToken: _RefreshToken, client: Client, user: User): RefreshToken {
    return {
        refreshToken: refreshToken?.refreshToken,
        refreshTokenExpiresAt: refreshToken?.refreshTokenExpiresAt,
        scope: refreshToken.scope,
        client: client,
        user:user
    }
}

export function _revokeToken(token: string, clientId: string) {
    ACCESS_TOKEN_TABLE = ACCESS_TOKEN_TABLE.filter(t => t.accessToken !== token && t.clientId === clientId)
    REFRESH_TOKEN_TABLE = REFRESH_TOKEN_TABLE.filter(t => t.refreshToken !== token && t.clientId === clientId)
}


/**
 * OAuth2 Server Model specifications
 *
 * For the following functions, using the default implementation
 * - generateAuthorizationCode: https://node-oauthoauth2-server.readthedocs.io/en/master/model/spec.html#generateauthorizationcode-client-user-scope
 * - generateRefreshToken: https://node-oauthoauth2-server.readthedocs.io/en/master/model/spec.html#generaterefreshtoken-client-user-scope
 * - generateAccessToken: https://node-oauthoauth2-server.readthedocs.io/en/master/model/spec.html#generateaccesstoken-client-user-scope
 *
 */
const serverModel = {
    // Invoked to generate a new access token.
    // optional. If not implemented, a default handler is used that generates access tokens consisting of 40 characters in the range of a..z0..9.
    generateAccessToken: generateAccessToken,

    // Invoked to retrieve an existing authorization code previously saved through Model#saveAuthorizationCode().
    getAuthorizationCode: getAuthorizationCode,

    // Invoked to save an authorization code.
    saveAuthorizationCode: saveAuthorizationCode,

    // Invoked to revoke an authorization code.
    revokeAuthorizationCode: revokeAuthorizationCode,

    // Invoked to retrieve a client using a client id or a client id/client secret combination, depending on the grant type.
    getClient: getClient,

    // Invoked to save an access token and optionally a refresh token, depending on the grant type.
    saveToken: saveToken,

    // Invoked to retrieve an existing access token previously saved through Model#saveToken().
    getAccessToken: getAccessToken,

    // Invoked to retrieve an existing refresh token previously saved through Model#saveToken().
    getRefreshToken: getRefreshToken,

    // Invoked to revoke a refresh token.
    revokeToken: revokeToken
}

export const server = new OAuth2Server({
    model: serverModel
})
