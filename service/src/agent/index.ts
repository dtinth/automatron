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

export interface RunAgentIterationResult {
  messagesToAddToHistory: CoreMessage[]
  finished: boolean
}

// Function to run a single iteration of the agentic loop
export async function runIteration(
  messages: CoreMessage[]
): Promise<RunAgentIterationResult> {
  if (messages.length === 0) {
    return {
      messagesToAddToHistory: [],
      finished: true,
    }
  }

  const lastMessage = messages[messages.length - 1]
  const messagesToAddToHistory: CoreMessage[] = []

  // Case 1: Last message is from agent
  if (lastMessage.role === 'assistant') {
    const toolCalls = extractToolCalls([lastMessage])

    // If the assistant message has tool calls, run them
    if (toolCalls.length > 0) {
      const toolResultParts = await processToolCalls(toolCalls)

      if (toolResultParts.length > 0) {
        const toolMessage: CoreMessage = {
          role: 'tool',
          content: toolResultParts,
        }
        messagesToAddToHistory.push(toolMessage)

        return {
          messagesToAddToHistory,
          finished: false, // Not finished, continue with more iterations
        }
      }
    }

    // If no tool calls or something unexpected, we're finished
    return {
      messagesToAddToHistory,
      finished: true,
    }
  }
  // Case 2: Last message is from user or tool, run the model
  else if (lastMessage.role === 'user' || lastMessage.role === 'tool') {
    console.log('Running model…')
    const result = await runModel(messages)

    // Add the model's response messages to our message list
    messagesToAddToHistory.push(...result.response.messages)

    return {
      messagesToAddToHistory,
      finished: false, // Not finished, continue with more iterations
    }
  }

  // Default case (shouldn't reach here in normal operation)
  consola.warn('Unexpected message role:', lastMessage.role)
  return {
    messagesToAddToHistory: [],
    finished: true,
  }
}

export async function runAgent(
  messages: CoreMessage[]
): Promise<RunAgentResult> {
  const allMessages = [...messages]
  let iterations = 0
  const MAX_ITERATIONS = 20
  let finished = false

  while (iterations < MAX_ITERATIONS && !finished) {
    const iterationResult = await runIteration(allMessages)

    // Add new messages to history
    allMessages.push(...iterationResult.messagesToAddToHistory)

    // Check if we're done
    finished = iterationResult.finished
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

export function continueThread(
  previousMessages: CoreMessage[],
  newUserMessage: string
): CoreMessage[] {
  // Format the new user message
  const formattedMessage = `
<user_message_time>${new Date().toISOString()}</user_message_time>
${newUserMessage}
`.trim()

  // Add the new user message to the conversation and return the updated array
  return [
    ...previousMessages,
    {
      role: 'user',
      content: [{ type: 'text', text: formattedMessage }],
    },
  ]
}
