import {
  createGoogleGenerativeAI,
  type GoogleGenerativeAIProviderOptions,
} from '@ai-sdk/google'
import {
  experimental_createMCPClient,
  generateText,
  type CoreMessage,
  type ToolCallPart,
  type ToolExecutionOptions,
  type ToolResultPart,
  type Tool,
  // MCPClient import removed as it's not exported; will use ReturnType instead
} from 'ai'
import consola from 'consola'
// PLazy import removed as it's no longer used
import { config } from '../config.ts'
import { decryptText } from '../encryption.ts'
import { agentInstructions, trainingProtocol } from './systemPrompts.ts'

const getModel = async () => {
  const google = createGoogleGenerativeAI({
    apiKey: await decryptText((await config.get('GEMINI_API_KEY')) as string),
  })
  const model = google('gemini-2.5-flash-preview-04-17')
  return model
}

function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Bangkok',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }
  return date.toLocaleString('en-US', options)
}

// Helper function to create model invocation log entry
function createModelInvocationLogEntry(
  startedAt: string,
  result: Awaited<ReturnType<typeof generateText>>,
  completedAt: string
): ModelInvocationLogEntry {
  return {
    type: 'model-invocation',
    timestamp: startedAt,
    startedAt,
    completedAt,
    finishReason: result.finishReason,
    providerMetadata: result.providerMetadata,
    usage: result.usage,
    modelId: result.response.modelId,
  }
}

// Define specific types for tool definitions and implementations
// ToolDefinitionsMap will be Record<string, Tool<any, any>> as generateText expects ToolSet = Record<string, Tool<any, any>>
// and the 'execute' property on Tool is optional.
type ToolDefinitionsMap = Record<string, Tool<any, any>>
type ToolImplementationsMap = Record<
  string,
  (
    args: any,
    options: ToolExecutionOptions
  ) => Promise<{ isError: boolean; result: any }>
>

// Define a type alias for the MCPClient Promise and its resolved type
type MCPClientPromiseType = ReturnType<typeof experimental_createMCPClient>
type ActualMCPClientType = Awaited<MCPClientPromiseType>

// Define the MCPContextType interface
interface MCPContextType {
  mcpClient: ActualMCPClientType // Use the resolved client type
  toolDefinititions: ToolDefinitionsMap
  toolImplementations: ToolImplementationsMap
}

// Private helper function to create MCP context
async function _createMCPContext(): Promise<MCPContextType> {
  const mcpClient: ActualMCPClientType = await experimental_createMCPClient({ // mcpClient is the resolved client object here
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
  const toolDefinititions: ToolDefinitionsMap = Object.fromEntries(
    Object.entries(await mcpClient.tools()).map( // Corrected: mcpClient is not a promise here, mcpClient.tools() is
      ([name, toolEntry]: [string, any]) => {
        const { execute, ...definitionPart } = toolEntry
        return [name, definitionPart as Tool<any, any>]
      }
    )
  )
  const toolImplementations: ToolImplementationsMap = Object.fromEntries(
    Object.entries(await mcpClient.tools()).map(([name, toolEntry]: [string, any]) => { // Corrected: mcpClient.tools() is a promise
      const { execute } = toolEntry; // toolEntry here is ToolExecution which has execute
      return [
        name,
        async (args: any, options: ToolExecutionOptions) => {
          // Ensure execute is a function before calling
          if (typeof execute === 'function') {
            const result = await execute(args, options)
            return {
              isError: false,
              result // Comma removed here
            }
          }
          // Handle cases where execute might not be a function (though MCP implies it should be)
          return {
            isError: true,
            result: `Tool ${name} does not have a valid execute method.`,
          }
        },
      ]
    })
  )
  return { mcpClient, toolDefinititions, toolImplementations } // Corrected: mcpClient is not a promise here
}

export async function runModel(
  messages: CoreMessage[],
  existingLogEntries: AnyLogEntry[] = [],
  toolDefinititions: ToolDefinitionsMap
) {
  const model = await getModel()
  const startedAt = new Date().toISOString()

  let result
  try {
    result = await generateText({
      model,
      messages,
      tools: toolDefinititions, // Use passed toolDefinititions
      providerOptions: {
        google: {
          thinkingConfig: { thinkingBudget: 0 },
        } satisfies GoogleGenerativeAIProviderOptions,
      },
    })

    for (const message of result.response.messages) {
      console.dir(message, { depth: null })
    }
  } catch (error) {
    // Create a simple error log entry for failed model invocation
    const logEntry: LogEntry = {
      type: 'model-error',
      timestamp: startedAt,
      error: String(error),
    }

    // Return the error and log entry
    throw { error, logEntry }
  }

  // Create log entry for successful model invocation
  const completedAt = new Date().toISOString()
  const logEntry = createModelInvocationLogEntry(startedAt, result, completedAt)

  // Return both the result and the log entry
  return { result, logEntry }
}

export interface LogEntry {
  type: string
  timestamp: string // ISO timestamp
  [key: string]: any // Allow additional properties
}

export interface ModelInvocationLogEntry extends LogEntry {
  type: 'model-invocation'
  startedAt: string // ISO timestamp
  completedAt?: string // ISO timestamp
  finishReason?: string
  providerMetadata?: any
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  modelId?: string
}

export type AnyLogEntry = ModelInvocationLogEntry | LogEntry

export interface VirtaAgentState {
  messages: CoreMessage[]
  logEntries: AnyLogEntry[]
}

export interface RunAgentResult {
  nextState: VirtaAgentState
  finished: boolean
}

export interface RunAgentIterationResult {
  nextState: VirtaAgentState
  finished: boolean
}

// Function to run a single iteration of the agentic loop
export async function runIteration(
  state: VirtaAgentState,
  toolDefinititions: ToolDefinitionsMap,
  toolImplementations: ToolImplementationsMap
): Promise<RunAgentIterationResult> {
  if (state.messages.length === 0) {
    return {
      nextState: { ...state },
      finished: true,
    }
  }

  const lastMessage = state.messages[state.messages.length - 1]
  const messagesToAddToHistory: CoreMessage[] = []
  const logEntries = [...(state.logEntries || [])]

  // Case 1: Last message is from agent
  if (lastMessage.role === 'assistant') {
    const toolCalls = extractToolCalls([lastMessage])

    // If the assistant message has tool calls, run them
    if (toolCalls.length > 0) {
      // Create a log entry for tool calls
      const toolCallLogEntry: LogEntry = {
        type: 'tool-calls',
        timestamp: new Date().toISOString(),
      }
      logEntries.push(toolCallLogEntry)

      const toolResultParts = await processToolCalls(toolCalls, toolImplementations)

      if (toolResultParts.length > 0) {
        const toolMessage: CoreMessage = {
          role: 'tool',
          content: toolResultParts,
        }
        messagesToAddToHistory.push(toolMessage)

        return {
          nextState: {
            ...state,
            messages: [...state.messages, ...messagesToAddToHistory],
            logEntries,
          },
          finished: false, // Not finished, continue with more iterations
        }
      }
    }

    // If no tool calls or something unexpected, we're finished
    return {
      nextState: {
        ...state,
        logEntries,
      },
      finished: true,
    }
  }
  // Case 2: Last message is from user or tool, run the model
  else if (lastMessage.role === 'user' || lastMessage.role === 'tool') {
    console.log('Running model…')

    try {
      const { result, logEntry } = await runModel(state.messages, logEntries, toolDefinititions)
      logEntries.push(logEntry)
      messagesToAddToHistory.push(...result.response.messages)

      return {
        nextState: {
          ...state,
          messages: [...state.messages, ...messagesToAddToHistory],
          logEntries,
        },
        finished: false, // Not finished, continue with more iterations
      }
    } catch (err: any) {
      if (err.logEntry) {
        // Add the error log entry
        logEntries.push(err.logEntry)
      }

      // Log the error
      consola.error('Error running model:', err.error || err)

      // Return state with error
      return {
        nextState: {
          ...state,
          logEntries,
        },
        finished: true, // Finish due to error
      }
    }
  }

  // Default case (shouldn't reach here in normal operation)
  consola.warn('Unexpected message role:', lastMessage.role)
  return {
    nextState: {
      ...state,
      logEntries,
    },
    finished: true,
  }
}

export async function runAgent(
  initialState: VirtaAgentState
): Promise<RunAgentResult> {
  const mcpContext: MCPContextType = await _createMCPContext()

  let currentState = { ...initialState }
  let iterations = 0
  const MAX_ITERATIONS = 20
  let finished = false

  try {
    while (iterations < MAX_ITERATIONS && !finished) {
      const iterationResult = await runIteration(currentState, mcpContext.toolDefinititions, mcpContext.toolImplementations)
      currentState = iterationResult.nextState
      finished = iterationResult.finished
      iterations++
    }
  } finally {
    if (mcpContext && mcpContext.mcpClient && typeof mcpContext.mcpClient.close === 'function') {
      mcpContext.mcpClient.close();
      consola.info('MCP client connection explicitly closed.');
    } else {
      consola.warn('MCP client does not have a close method or mcpContext/mcpClient is not available for closing.');
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    consola.warn(
      `Reached maximum of ${MAX_ITERATIONS} iterations, stopping agent loop`
    )
  }

  // Return the final state
  return {
    nextState: currentState,
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
  toolCalls: ToolCallPart[],
  toolImplementations: ToolImplementationsMap
): Promise<ToolResultPart[]> {
  const toolResultParts: ToolResultPart[] = []

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

export function createNewThread(input: VirtaTextInput): VirtaAgentState {
  const initialPrompt = `

${agentInstructions}

${trainingProtocol}

<user_message_time>${formatDate(new Date())}</user_message_time>
${input.text}
`.trim()

  // Create a thread creation log entry
  const threadCreationLogEntry: LogEntry = {
    type: 'thread-creation',
    timestamp: new Date().toISOString(),
  }

  return {
    messages: [
      {
        role: 'user',
        content: [{ type: 'text', text: initialPrompt }],
      },
    ],
    logEntries: [threadCreationLogEntry],
  }
}

export function continueThread(
  state: VirtaAgentState,
  newUserMessage: string
): VirtaAgentState {
  // Format the new user message
  const formattedMessage = `
<user_message_time>${formatDate(new Date())}</user_message_time>
${newUserMessage}
`.trim()

  // Create a message addition log entry
  const messageAdditionLogEntry: LogEntry = {
    type: 'message-addition',
    timestamp: new Date().toISOString(),
  }

  // Add the new user message to the conversation and return the updated state
  return {
    ...state,
    messages: [
      ...state.messages,
      {
        role: 'user',
        content: [{ type: 'text', text: formattedMessage }],
      },
    ],
    logEntries: [...(state.logEntries || []), messageAdditionLogEntry],
  }
}
