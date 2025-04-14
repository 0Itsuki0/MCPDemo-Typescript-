import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import readline from "readline/promises"
import dotenv from "dotenv"
import OpenAI from 'openai'
import { FunctionTool, ResponseInput } from "openai/src/resources/responses/responses.js"
import configs from "../server-config.json" with { type: "json" }

dotenv.config()

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set")
}

type ServerConfig = {
    command: string,
    args: string[]
}

export class MCPHost {
    private mcps: MCPClient[] = []
    private tools: FunctionTool[] = []
    private toolsMap: {[name: string]: MCPClient} = {}

    private servers: {[name: string]: ServerConfig} = configs
    private openai: OpenAI
    private model: string = "gpt-4o"

    constructor() {
        this.openai = new OpenAI({apiKey: OPENAI_API_KEY})
    }

    async connectToServers() {
        try {
            for (const serverName in this.servers) {
                const mcp = new MCPClient(serverName)
                const config = this.servers[serverName]
                await mcp.connectToServer(config)
                this.mcps.push(mcp)

                const tools = await mcp.getTools()
                const map: {[name: string]: MCPClient} = {}
                tools.forEach((t) => map[t.name] = mcp)
                this.tools = [...this.tools, ...tools]
                this.toolsMap = {
                    ...this.toolsMap,
                    ...map
                }
                console.log(`Connected to server ${serverName} with tools: ${tools.map(({ name }) => name)}`)
            }

        } catch (e) {
            console.log("Failed to connect to MCP server: ", e)
            throw e
        }
    }

    async cleanup() {
        for (const mcp of this.mcps) {
            await mcp.cleanup()
        }
    }


    async processQuery(query: string) {

        const messages: ResponseInput = [{
            role: "user", content: query
        }]

        const response = await this.openai.responses.create({
            model: this.model,
            input: messages,
            tools: this.tools,
        })

        for (const output of response.output) {
            if (output.type === "message" && output.content.length > 0 && output.content[0].type === "output_text") {
                console.log(output.content[0].text)

            } else if (output.type === "function_call") {
                const toolName = output.name
                const mcpClient = this.toolsMap[toolName]

                if (mcpClient === undefined) {
                    continue
                }

                const toolArgs = JSON.parse(output.arguments) as { [x: string]: unknown }

                console.log(`[Calling tool ${toolName} with args ${JSON.stringify(toolArgs)}]`)

                const result = await mcpClient.callTool(toolName, toolArgs)

                messages.push(output)
                messages.push({
                    type: "function_call_output",
                    call_id: output.call_id,
                    output: JSON.stringify(result.content)
                })
                const response = await this.openai.responses.create({
                    model: this.model,
                    input: messages,
                })

                if (response.output[0].type === "message" && response.output[0].content.length > 0 && response.output[0].content[0].type === "output_text") {
                    console.log(response.output[0].content[0].text)
                }
            }
        }
    }

    async chatLoop() {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        })

        try {
            console.log("\nMCP Client Started!")
            console.log("Type your message.")

            while (true) {
                const message = await rl.question("\nQuery: ")
                console.log("\n")
                await this.processQuery(message)
            }

        } finally {
            rl.close()
        }
    }
}


// Protocol client that maintain 1:1 connection with servers
class MCPClient {
    private client: Client
    private transport: StdioClientTransport | null = null

    constructor(serverName: string) {
        this.client = new Client({ name: `mcp-client-for-${serverName}`, version: "1.0.0" })
    }

    async connectToServer(serverConfig: ServerConfig) {
        try {
            this.transport = new StdioClientTransport({
                command: serverConfig.command,
                args: serverConfig.args,
            })
            this.client.connect(this.transport)

        } catch (e) {
            console.log("Failed to connect to MCP server: ", e)
            throw e
        }
    }

    async getTools(): Promise<FunctionTool[]> {
        const toolsResult = await this.client.listTools()
        const tools: FunctionTool[] = toolsResult.tools.map((tool) => {
            return {
                type: 'function',
                strict: true,
                name: tool.name,
                description: tool.description,
                parameters: {
                    ... tool.inputSchema,
                    additionalProperties: false
                },
            }
        })
        return tools
    }

    async callTool(name: string, args: { [x: string]: unknown }) {
        const result = await this.client.callTool({
            name: name,
            arguments: args,
        })
        return result
    }

    async cleanup() {
        await this.client.close()
    }
}
