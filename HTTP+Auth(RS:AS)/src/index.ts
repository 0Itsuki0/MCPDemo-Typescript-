import { startClient } from "./client/index.js"
import { startResourceServer, stopResourceServer } from "./resourceServer/index.js"
import { startAuthorizationServer, stopAuthorizationServer } from "./authServer/index.js"


async function main() {
    startAuthorizationServer()
    startResourceServer()
    await startClient()
    stopResourceServer()
    stopAuthorizationServer()
    process.exit(0)
}

main()