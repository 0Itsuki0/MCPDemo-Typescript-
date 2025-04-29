/****************************************************************************/
/******** Encryption and Decryption for Dynamic Client Registration *********/
/****************************************************************************/

import dotenv from "dotenv"
import crypto from "crypto"

import { isStringArray, logMessage } from "./helper.js"

dotenv.config()

const CIPHER_KEY = process.env.CIPHER_KEY
const CIPHER_KEY_ENCODING: BufferEncoding = process.env.CIPHER_KEY_ENCODING as BufferEncoding ?? "hex"
const CIPHER_IV = process.env.CIPHER_IV
const CIPHER_IV_ENCODING: BufferEncoding = process.env.CIPHER_IV_ENCODING as BufferEncoding ?? "hex"

const CIPHER_ALGORITHM = "aes-256-cbc"
const INPUT_ENCODING: BufferEncoding = "utf-8"
const CLIENT_ID_ENCODING: BufferEncoding = "base64url"
const CLIENT_SECRET_KEY = "client_secret"
const REDIRECT_URIS_KEY = "redirect_uris"

if (!CIPHER_KEY || !CIPHER_IV) {
    throw new Error("Missing Server configuration.", { cause: "server_error"})
}

const key = Buffer.from(CIPHER_KEY, CIPHER_KEY_ENCODING)
const iv = Buffer.from(CIPHER_IV, CIPHER_IV_ENCODING)


export function encryptToClientId(clientSecret: string, redirectURIs: string[]): string {
    try {
        const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, key, iv)

        const obj = {
            [CLIENT_SECRET_KEY]: clientSecret,
            [REDIRECT_URIS_KEY]: redirectURIs,
        }
        const str = JSON.stringify(obj)

        const encrypted = Buffer.concat([
            cipher.update(Buffer.from(str, INPUT_ENCODING)),
            cipher.final(),
        ]).toString(CLIENT_ID_ENCODING)

        return encrypted
    } catch(error) {
        logMessage("Error on client id  encryption: ", error)
        throw new Error("internal server error", {cause: "server_error"})
    }
}

export function decryptFromClientId(clientId: string): { clientSecret: string, redirectUris: string[] } {

    let decrypted: string
    try {
        const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, key, iv)

        decrypted = Buffer.concat([
            decipher.update(Buffer.from(clientId, CLIENT_ID_ENCODING)),
            decipher.final(),
        ]).toString(INPUT_ENCODING)

    } catch(error) {
        logMessage("Error on client id decryption: ", error)
        throw new Error("internal server error", {cause: "server_error"})
    }

    const obj = JSON.parse(decrypted)
    const clientSecret = obj[CLIENT_SECRET_KEY] as string | undefined
    if (!clientSecret || typeof(clientSecret) !== "string") {
        throw new Error("Invalid client Metadata: `client_secret`.", { cause: "invalid_client" })
    }
    const redirectURIs = obj[REDIRECT_URIS_KEY] as string[] | undefined
    if (!redirectURIs || !isStringArray(redirectURIs)) {
        throw new Error("Invalid client Metadata: `redirect_uris`.", { cause: "invalid_client" })
    }

    return {
        clientSecret: clientSecret,
        redirectUris: redirectURIs
    }
}