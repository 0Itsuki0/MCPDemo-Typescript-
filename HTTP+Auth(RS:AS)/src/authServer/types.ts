// potentially entries for a user table in a Database
export type _User = {
    userId: string
    // or other credentials to verify user
    email: string
    password: string
}

export type _AuthCode = {
    authorizationCode: string
    expiresAt: Date
    redirectUri: string
    scope: string[]
    clientId: string
    userId: string
    codeChallenge?: string
    codeChallengeMethod?: string
    resource?: string
}

export type _AccessToken = {
    accessToken: string
    accessTokenExpiresAt?: Date
    scope: string[]
    clientId: string
    userId: string
}


export type _RefreshToken = {
    refreshToken: string
    refreshTokenExpiresAt?: Date
    scope: string[]
    clientId: string
    userId: string
}
