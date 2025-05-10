import { createGoogleGenerativeAI } from '@ai-sdk/google'
import {
  experimental_createMCPClient,
  generateText,
  type CoreMessage,
  type ToolCallPart,
  type ToolExecutionOptions,
  type ToolResultPart,
} from 'ai'
import consola from 'consola'
import PLazy from 'p-lazy'
import { config } from '../config.ts'
import { decryptText } from '../encryption.ts'

const getModel = async () => {
  const google = createGoogleGenerativeAI({
    apiKey: await decryptText((await config.get('GEMINI_API_KEY')) as string),
  })
  const model = google('gemini-2.0-flash-001')
  return model
}

const mcpPromise = PLazy.from(async () => {
  const mcpClient = await experimental_createMCPClient({
    transport: {
      type: 'sse',
      url: (await config.get('VIRTA_MCP_URL')) as string,
      headers: {
        authorization: `Bearer ${await decryptText(
          (await config.get('VIRTA_MCP_BEARER_TOKEN')) as string
        )}`,
      },
    },
  })
  const toolDefinititions = Object.fromEntries(
    Object.entries(await mcpClient.tools()).map(
      ([name, { execute, ...definition }]) => [name, { ...definition }]
    )
  )
  const toolImplementations = Object.fromEntries(
    Object.entries(await mcpClient.tools()).map(([name, { execute }]) => [
      name,
      async (args: any, options: ToolExecutionOptions) => {
        const result = await execute(args, options)
        return {
          isError: false,
          result,
        }
      },
    ])
  )
  return { mcpClient, toolDefinititions, toolImplementations }
})

export async function runModel(messages: CoreMessage[]) {
  const model = await getModel()
  const mcp = await mcpPromise
  const result = await generateText({
    model,
    messages,
    tools: mcp.toolDefinititions,
  })
  for (const message of result.response.messages) {
    console.dir(message, { depth: null })
  }
  return result
}

export interface RunAgentResult {
  messages: CoreMessage[]
  finished: boolean
}

export async function runAgent(
  messages: CoreMessage[]
): Promise<RunAgentResult> {
  const allMessages = [...messages]

  // Inner function to run a single iteration of the agentic loop
  async function runIteration(): Promise<boolean> {
    console.log('Running model…')
    const result = await runModel(allMessages)

    // Add the model's response messages to our message list
    for (const message of result.response.messages) {
      allMessages.push(message)
    }

    // Extract tool calls from messages
    const toolCalls = extractToolCalls(result.response.messages)

    // If no tool calls, the agent is done
    if (toolCalls.length === 0) {
      return false
    }

    // Process all tool calls and get results
    const toolResultParts = await processToolCalls(toolCalls)

    // Add tool results to messages
    if (toolResultParts.length > 0) {
      allMessages.push({
        role: 'tool',
        content: toolResultParts,
      })

      // Continue the loop
      return true
    }

    // If we reach here, something unexpected happened
    return false
  }

  // Run the agent loop until it's finished
  let iterations = 0
  const MAX_ITERATIONS = 20

  while (iterations < MAX_ITERATIONS && (await runIteration())) {
    iterations++
  }

  if (iterations >= MAX_ITERATIONS) {
    consola.warn(
      `Reached maximum of ${MAX_ITERATIONS} iterations, stopping agent loop`
    )
  }

  // Return only the new messages
  return {
    messages: allMessages.slice(messages.length),
    finished: true,
  }
}

// Helper function to extract tool calls from messages
function extractToolCalls(messages: CoreMessage[]): ToolCallPart[] {
  const toolCalls: ToolCallPart[] = []

  for (const message of messages) {
    if (message.content) {
      for (const part of message.content) {
        if (typeof part === 'object' && part.type === 'tool-call') {
          toolCalls.push(part)
        }
      }
    }
  }

  return toolCalls
}

// Helper function to process tool calls
async function processToolCalls(
  toolCalls: ToolCallPart[]
): Promise<ToolResultPart[]> {
  const toolResultParts: ToolResultPart[] = []
  const toolImplementations = (await mcpPromise).toolImplementations

  for (const toolCall of toolCalls) {
    const toolName = toolCall.toolName

    try {
      if (!toolImplementations[toolName]) {
        throw new Error(`Tool '${toolName}' not implemented`)
      }

      const result = await toolImplementations[toolName]!(
        toolCall.args as any,
        {
          toolCallId: toolCall.toolCallId,
          messages: [],
        }
      )

      if (result.isError) {
        consola.fail(`${toolName}:`, result.result)
      } else {
        consola.success(`${toolName}`)
      }

      toolResultParts.push({
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        ...result,
      })
    } catch (error) {
      consola.error(
        `Error calling ${toolName} with args ${JSON.stringify(toolCall.args)}:`,
        error
      )

      toolResultParts.push({
        type: 'tool-result',
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        isError: true,
        result: `Internal error: ${error}`,
      })
    }
  }

  return toolResultParts
}

export interface VirtaTextInput {
  text: string
}

export function createNewThread(input: VirtaTextInput): CoreMessage[] {
  const initialPrompt = `

<agent_instructions>
You are virta, a virtual assistant that helps users with their tasks.
virta is a helpful assistant.
You can also ask the user for more information if you need it.
You are not allowed to make any assumptions about the user or their tasks.
You should always ask for clarification if you are unsure about something.
You should also be polite and respectful to the user at all times.
</agent_instructions>

<user_message_time>${new Date().toISOString()}</user_message_time>
${input.text}
`.trim()
  return [
    {
      role: 'user',
      content: [{ type: 'text', text: initialPrompt }],
    },
  ]
}
