export function logMessage(message: any, ...optionalParams: any[]) {
    console.log('\x1b[32m%s\x1b[0m', "Resource Server: ",  message, ...optionalParams)
}

export async function verifyScopes(authorizedScopes: string[], requiredScopes?: string[]): Promise<boolean> {
    if (!requiredScopes) {
        return true
    }
    return requiredScopes.every(element =>
        authorizedScopes.indexOf(element) !== -1
    )
}

export function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}