export function logMessage(message: any, ...optionalParams: any[]) {
    console.log('\x1b[31m%s\x1b[0m', "Client: ",  message, ...optionalParams)
}