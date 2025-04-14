import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import express, { Request, Response } from "express"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"

// Create server instance
const server = new Server({
    name: "itsuki-mcp-server",
    version: "1.0.0"
}, {
    capabilities: {
        tools: {}
    }
})

// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
const transports: {[sessionId: string]: SSEServerTransport} = {}

const app = express()
app.use(express.json())

const router = express.Router()

// endpoint for the client to use for sending messages
const POST_ENDPOINT = "/messages"

router.post(POST_ENDPOINT, async (req: Request, res: Response) => {
    console.log("message request received: ", req.body)
    // when client sends messages with `SSEClientTransport`,
    // the sessionId will be atomically set as query parameter.
    const sessionId = req.query.sessionId

    if (typeof (sessionId) != "string") {
        res.status(400).send({ messages: "Bad session id." })
        return
    }
    const transport = transports[sessionId]
    if (!transport) {
        res.status(400).send({ messages: "No transport found for sessionId." })
        return
    }

    // IMPORTANT!
    // using `await transport.handlePostMessage(req, res)` will cause
    // `SSE transport error: Error: Error POSTing to endpoint (HTTP 400): InternalServerError: stream is not readable`
    // on the client side
    await transport.handlePostMessage(req, res, req.body)

    return
})


// initialization:
// create a new transport to connect and
// send an endpoint event containing a URI for the client to use for sending messages
router.get("/connect", async (req: Request, res: Response) => {
    console.log("connection request received")
    // tells the client to send messages to the `POST_ENDPOINT`
    const transport = new SSEServerTransport(POST_ENDPOINT, res)
    console.log("new transport created with session id: ", transport.sessionId)

    transports[transport.sessionId] = transport

    res.on("close", () => {
        console.log("SSE connection closed")
        delete transports[transport.sessionId]
    })

    await server.connect(transport)

    // an exmaple of a server-sent-event (message) to client
    await sendMessages(transport)

    return
})

async function sendMessages(transport: SSEServerTransport) {
    try {
        // some messages will proabaly not be able to observed on the client side
        // becasue an open SSE Stream is not yet established
        // by receving the `initialize` POST request and the `notifications/initialized` POST request
        await transport.send({
            jsonrpc: "2.0",
            method: "sse/connection",
            params: { message: "Stream started" }
        })
        console.log("Stream started")


        let messageCount = 0
        const interval = setInterval(async () => {

        messageCount++

        const message = `Message ${messageCount} at ${new Date().toISOString()}`

        try {
            await transport.send({
                jsonrpc: "2.0",
                method: "sse/message",
                params: { data: message }
            })

          console.log(`Sent: ${message}`)

            if (messageCount === 2) {
                clearInterval(interval)
                await transport.send({
                    jsonrpc: "2.0",
                    method: "sse/complete",
                    params: { message: "Stream completed" }
                })
                console.log("Stream completed")
            }

        } catch (error) {
          console.error("Error sending message:", error)
          clearInterval(interval)
        }

      }, 1000)

    } catch (error) {
      console.error("Error in startSending:", error)
    }
}


app.use('/', router)

const PORT = 3000
app.listen(PORT, () => {
    console.log(`MCP Streamable HTTP Server listening on port ${PORT}`)
})