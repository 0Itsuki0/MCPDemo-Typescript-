import {  MCPHost } from "./mcpHost.js"

async function main() {
    const host = new MCPHost()

    try {
        await host.connectToServers()
        await host.chatLoop()
    } finally {
        await host.cleanup()
        process.exit(0)
    }
}

main()