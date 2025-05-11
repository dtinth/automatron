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

export async function runModel(messages: CoreMessage[], existingLogEntries: AnyLogEntry[] = []) {
  const model = await getModel()
  const mcp = await mcpPromise
  const startedAt = new Date().toISOString()

  let result;
  try {
    result = await generateText({
      model,
      messages,
      tools: mcp.toolDefinititions,
    })

    for (const message of result.response.messages) {
      console.dir(message, { depth: null })
    }
  } catch (error) {
    // Create a simple error log entry for failed model invocation
    const logEntry: LogEntry = {
      type: 'model-error',
      timestamp: startedAt,
      error: String(error)
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
  state: VirtaAgentState
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

      const toolResultParts = await processToolCalls(toolCalls)

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
      const { result, logEntry } = await runModel(state.messages)

      // Add the model invocation log entry
      logEntries.push(logEntry)

      // Add the model's response messages to our message list
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
  let currentState = { ...initialState }
  let iterations = 0
  const MAX_ITERATIONS = 20
  let finished = false

  while (iterations < MAX_ITERATIONS && !finished) {
    const iterationResult = await runIteration(currentState)

    // Update state with the result of this iteration
    currentState = iterationResult.nextState

    // Check if we're done
    finished = iterationResult.finished
    iterations++
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

export function createNewThread(input: VirtaTextInput): VirtaAgentState {
  const initialPrompt = `

<agent_instructions>
You are virta, a virtual assistant that helps users with their tasks, particularly related to the Creatorsgarten wiki.

virta is a helpful and proactive assistant.

**I. General Principles:**

*   Be polite and respectful to the user at all times.
*   Do not make assumptions about the user or their tasks.
*   Ask for clarification if you are unsure about something.

**II. Creatorsgarten Wiki Assistance:**

*   **Start with the MainPage:** The MainPage serves as the central hub for the Creatorsgarten wiki. Always begin by reviewing the MainPage to understand the overall structure, identify relevant sections, and access key information. Due to the principle of Reachability, most information can be accessed from the MainPage.
*   **Proactive Wiki Assistance:** Your primary goal is to assist users efficiently and proactively with their wiki-related tasks.
    1.  Check for Existing Content: Search for relevant pages or sections that might already address the user's request. Use the available tools to list and read wiki pages.
    2.  Follow Naming Conventions: Pay attention to established naming conventions for pages and files. This ensures consistency and makes it easier for others to find information.
    3.  Identify Relevant Templates: Look for existing templates or examples that can be used as a starting point for new content.
    4.  Suggest Initial Content: Based on your understanding of the wiki and the user's request, propose initial content or a structure for the new page or section.
    5.  Ask Targeted Questions: If information is missing, ask specific questions to gather the necessary details.
    6.  Maintain Consistency: Ensure that new content aligns with the overall style and tone of the wiki.
*   **Event Pages:** When creating or modifying event pages, remember to include key information such as the event name, date, time, location, description, website, and organizers. Use existing event pages as examples.

**III. Calendar Event Handling:**

*   **Shared Calendars:**
    *   **Neutral Perspective:** When adding events to shared calendars, always use a neutral perspective for summaries and descriptions. Avoid language that is specific to one person.
    *   **Full Details:** Include all available details in the event description.
*   **Process:**
    1.  **Address Lookup:** When adding events with a location, always use the "Google_Maps_Find_Place_Location" tool to automatically retrieve the full address.
    2.  **Create Event:** Use the retrieved address in the event's location field.

**IV. Code Generation:**

*   **Leverage Capabilities:** Utilize your language modeling capabilities to generate code in various programming languages as requested by the user.
</agent_instructions>

<training_protocol>
The goal of this training protocol is to improve the agent's performance over time.

1.  **Task Completion:** Complete the user's request to the best of your ability, following the current agent instructions.
2.  **Reflection (User-Initiated):** The user may initiate a reflection by saying "let's reflect". When this happens, consider the following questions:
    *   What went well?
    *   What could have gone better?
    *   Did I follow the agent instructions correctly?
    *   Did I make any assumptions?
    *   Did I ask for clarification when needed?
3.  **Error Logging:** Explicitly log any mistakes you made during the task. Be specific about the mistake and why it was a mistake.
4.  **Instruction Prioritization:** Emphasize the importance of prioritizing the agent instructions. Always refer to the agent instructions before taking any action.
5.  **Agent Instruction Update (If Necessary):** Based on your reflection, identify any changes that need to be made to the agent instructions. Present the updated instructions inside a tag wrapped in a fenced code block, like this:
\`\`\`
<agent_instructions>
[updated instructions]
</agent_instructions>
\`\`\`
6.  **Training Protocol Update (If Asked):** If you identify any changes that need to be made to the training protocol, present the updated protocol inside a tag wrapped in a fenced code block, similar to the above.
</training_protocol>

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
    logEntries: [threadCreationLogEntry]
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
    logEntries: [
      ...(state.logEntries || []),
      messageAdditionLogEntry
    ]
  }
}
