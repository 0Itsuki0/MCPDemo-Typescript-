
import { Request } from "express"

export function logMessage(message: any, ...optionalParams: any[]) {
    console.log('\x1b[36m%s\x1b[0m', "Authorization Server",  message, ...optionalParams)
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export function isStringArray(value: any): boolean {
    return Array.isArray(value) && value.every(item => typeof item === 'string')
}

export function getStatusCode(cause: string | undefined): number {
    const status = cause === "server_error" ? 500 : cause === "invalid_client" ? 401 : 400
    return status
}

export function isRedirectURIAllowed(uri: string): boolean {
    if (!isAbsoluteURI(uri)) {
        return false
    }

    let url: URL
    try {
        url = new URL(uri)
    } catch(error) {
        logMessage("Error parsing for URL: ", error)
        return false
    }

    if (url.protocol === "http" || url.protocol === "http:") {
        return isLocalhost(url.hostname)
    }

    // https or application-specific URL
    return true
}

export function isAbsoluteURI(uri: string) {
    var r = new RegExp('^(?:[a-z+]+:)?//', 'i')
    return r.test(uri)
}

export function isLocalhost(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1'
}


export function getClientIdSecretFromRequest(req: Request): { clientId?: string, clientSecret?: string } {
    if (req.headers.authorization) {
        const authString = req.headers.authorization
        const match = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/.exec(authString)
        if (match) {
            const encoded = match[1]
            const decoded = Buffer.from(encoded, "base64").toString()
            const idPass = /^([^:]*):(.*)$/.exec(decoded)
            if (idPass) {
                return {
                    clientId: idPass[1],
                    clientSecret: idPass[2]
                }
            }
        }
    }

    const clientId = (req.body.client_id || req.query.client_id) as string | undefined
    const clientSecret = (req.body.client_secret || req.query.client_secret) as string | undefined

    return {
        clientId: clientId,
        clientSecret: clientSecret
    }
}
