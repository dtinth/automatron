import { html, type Html } from '@thai/html'
import { type CoreMessage } from 'ai'
import { Elysia } from 'elysia'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { continueThread, createNewThread, runAgent, type VirtaAgentState, type ModelInvocationLogEntry } from '../agent/index.ts'
import { blobService } from '../blob.ts'
import { htmlPlugin } from '../elysiaPlugins/html.ts'
import { adminUserPlugin } from './adminUserPlugin.ts'
import { layout } from './layout.ts'

// Shared styles for chat pages
const styles = html`<style>
  .chat-page {
    max-width: 800px;
    margin: 0 auto;
  }
  .chat-messages {
    margin-bottom: 20px;
  }
  .Message {
    padding: 10px;
    margin-bottom: 10px;
    border-radius: 5px;
  }
  .Message--user {
    background-color: #e6f7ff;
    border-left: 4px solid #1890ff;
  }
  .Message--assistant {
    background-color: #f6ffed;
    border-left: 4px solid #52c41a;
  }
  .Message--tool {
    background-color: #fff7e6;
    border-left: 4px solid #faad14;
  }
  .Message__header {
    font-weight: bold;
    margin-bottom: 5px;
    text-transform: capitalize;
  }
  .Message__content {
    margin: 0;
  }
  .text-content {
    white-space: pre-wrap;
  }
  .Tool {
    margin: 6px 0;
    border-radius: 4px;
    overflow: hidden;
  }
  .Tool summary {
    padding: 6px 10px;
    cursor: pointer;
    font-weight: bold;
  }
  .Tool--call summary {
    background-color: #e6f7ff;
  }
  .Tool--result summary {
    background-color: #f6ffed;
  }
  .Tool--error summary {
    background-color: #fff1f0;
    color: #cf1322;
  }
  .Tool__args,
  .Tool__result-content {
    margin: 0;
    padding: 10px;
    background-color: #f5f5f5;
    overflow: auto;
    max-height: 300px;
  }
</style>`

// Function to retrieve agent state
export async function retrieveAgentState(
  hash: string
): Promise<VirtaAgentState | null> {
  try {
    const blobKey = `chat/state/${hash}.json`
    const blob = await blobService.getBlobClient('ephemeral', blobKey)
    if (!blob) {
      return null
    }
    const buffer = await blob.downloadToBuffer()
    const state = JSON.parse(buffer.toString('utf-8'))
    return state
  } catch (error) {
    console.error('Failed to retrieve agent state:', error)
    return null
  }
}

// Function to save agent state
export async function saveAgentState(
  state: VirtaAgentState
): Promise<string> {
  const buffer = Buffer.from(JSON.stringify(state), 'utf-8')
  const hash = createHash('sha256').update(buffer).digest('hex')
  const blobKey = `chat/state/${hash}.json`
  await blobService.uploadStream(
    'ephemeral',
    blobKey,
    Readable.from([buffer], { objectMode: false }),
    'application/json'
  )
  return hash
}

/**
 * Calculate total token usage from all model invocations
 */
function calculateTokenUsage(state: VirtaAgentState): {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUSD: number
  costTHB: number
} {
  // Use static constants to ensure consistent values
  return calculateTokenUsage.calculateUsage(state)
}

// Define static properties and methods
calculateTokenUsage.PROMPT_PRICE_PER_MILLION = 0.15
calculateTokenUsage.COMPLETION_PRICE_PER_MILLION = 0.6
calculateTokenUsage.USD_TO_THB = 35

calculateTokenUsage.calculateUsage = function(state: VirtaAgentState) {
  // Price per million tokens in USD and exchange rate
  const PROMPT_PRICE_PER_MILLION = calculateTokenUsage.PROMPT_PRICE_PER_MILLION
  const COMPLETION_PRICE_PER_MILLION = calculateTokenUsage.COMPLETION_PRICE_PER_MILLION
  const USD_TO_THB = calculateTokenUsage.USD_TO_THB

  const result = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUSD: 0,
    costTHB: 0
  }

  // Filter log entries for model invocations
  const modelInvocations = state.logEntries.filter(
    entry => entry.type === 'model-invocation'
  ) as ModelInvocationLogEntry[]

  // Sum up token usage
  for (const entry of modelInvocations) {
    if (entry.usage) {
      result.promptTokens += entry.usage.promptTokens || 0
      result.completionTokens += entry.usage.completionTokens || 0
      result.totalTokens += entry.usage.totalTokens || 0
    }
  }

  // Calculate costs
  result.costUSD = (
    (result.promptTokens / 1000000) * PROMPT_PRICE_PER_MILLION +
    (result.completionTokens / 1000000) * COMPLETION_PRICE_PER_MILLION
  )
  result.costTHB = result.costUSD * USD_TO_THB

  return result
}

/**
 * Generate a signed URL for viewing the JSON state
 */
async function getStateJsonUrl(hash: string): Promise<string> {
  const blobKey = `chat/state/${hash}.json`
  try {
    // Create a signed URL valid for 60 minutes
    return await blobService.getSignedUrl('ephemeral', blobKey, 60)
  } catch (error) {
    console.error('Failed to generate signed URL:', error)
    return '#'
  }
}

// Function to render chat messages
function renderChatMessages(state: VirtaAgentState): Html[] {
  const result: Html[] = []

  for (const message of state.messages) {
    const messageClass =
      message.role === 'user'
        ? 'Message Message--user'
        : message.role === 'assistant'
        ? 'Message Message--assistant'
        : 'Message Message--tool'

    let contentParts: Html[] = []

    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (typeof part === 'string') {
          contentParts.push(html`<span class="text-content">${part}</span>`)
        } else if (part.type === 'text') {
          contentParts.push(
            html`<span class="text-content">${part.text}</span>`
          )
        } else if (part.type === 'tool-call') {
          contentParts.push(html`
            <details class="Tool Tool--call">
              <summary>Tool Call: ${part.toolName}</summary>
              <pre class="Tool__args">${JSON.stringify(part.args, null, 2)}</pre>
            </details>
          `)
        } else if (part.type === 'tool-result') {
          const resultClass = part.isError
            ? 'Tool Tool--result Tool--error'
            : 'Tool Tool--result'
          contentParts.push(html`
            <details class="${resultClass}">
              <summary>
                Tool Result: ${part.toolName}${part.isError ? ' (Error)' : ''}
              </summary>
              <pre class="Tool__result-content">
${JSON.stringify(part.result, null, 2)}</pre
              >
            </details>
          `)
        }
      }
    } else if (typeof message.content === 'string') {
      contentParts.push(
        html`<span class="text-content">${message.content}</span>`
      )
    }

    result.push(html`
      <div class="${messageClass}">
        <div class="Message__header">${message.role}</div>
        <div class="Message__content">${contentParts}</div>
      </div>
    `)
  }

  return result
}

// Chat routes
export const chatRoutes = new Elysia({ prefix: '/chat' })
  .use(adminUserPlugin)
  .use(htmlPlugin)
  .get('/', ({ user }) => {
    return layout({
      title: 'Chat',
      contents: html`
        <div class="chat-page">
          <h1>New Chat</h1>
          <form method="POST" action="/admin/chat">
            <textarea
              name="message"
              rows="10"
              cols="50"
              class="form-control"
              placeholder="Type your message here..."
              autofocus
            ></textarea>
            <button type="submit" class="btn btn-primary mt-2">Send</button>
          </form>
        </div>
        ${styles}
      `,
    })
  })
  .post('/', async ({ user, request }) => {
    const formData = await request.formData()
    const message = String(formData.get('message'))
    const parentHash = formData.get('parentHash')

    let state: VirtaAgentState

    if (parentHash) {
      const previousState = await retrieveAgentState(String(parentHash))
      if (previousState) {
        // Continue existing conversation
        const updatedState = continueThread(previousState, message)
        const result = await runAgent(updatedState)
        state = result.nextState
      } else {
        // If parent state not found, start new thread
        const newState = createNewThread({ text: message })
        const result = await runAgent(newState)
        state = result.nextState
      }
    } else {
      // Start new thread
      const newState = createNewThread({ text: message })
      const result = await runAgent(newState)
      state = result.nextState
    }

    const hash = await saveAgentState(state)

    return new Response('Redirect', {
      status: 302,
      headers: {
        location: `/admin/chat/${hash}`,
      },
    })
  })
  .get('/:hash', async ({ user, params }) => {
    const hash = params.hash
    const state = await retrieveAgentState(hash)

    if (!state) {
      return new Response('Not found', { status: 404 })
    }

    // Calculate token usage
    const tokenUsage = calculateTokenUsage(state)

    // Generate signed URL for JSON state
    const jsonUrl = await getStateJsonUrl(hash)

    return layout({
      title: 'Chat',
      contents: html`
        <div class="chat-page">
          <h1>Chat</h1>

          <div class="card mb-4">
            <div class="card-body">
              <div class="row">
                <div class="col-md-8">
                  <h5 class="card-title">Token Usage Summary</h5>
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Tokens</th>
                        <th>Cost (THB)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Prompt</td>
                        <td>${tokenUsage.promptTokens.toLocaleString()}</td>
                        <td>฿${((tokenUsage.promptTokens / 1000000) *
                          calculateTokenUsage.PROMPT_PRICE_PER_MILLION *
                          calculateTokenUsage.USD_TO_THB).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td>Completion</td>
                        <td>${tokenUsage.completionTokens.toLocaleString()}</td>
                        <td>฿${((tokenUsage.completionTokens / 1000000) *
                          calculateTokenUsage.COMPLETION_PRICE_PER_MILLION *
                          calculateTokenUsage.USD_TO_THB).toFixed(2)}</td>
                      </tr>
                      <tr class="table-active fw-bold">
                        <td>Total</td>
                        <td>${tokenUsage.totalTokens.toLocaleString()}</td>
                        <td>฿${tokenUsage.costTHB.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="col-md-4 d-flex align-items-center justify-content-md-end mt-3 mt-md-0">
                  <a href="${jsonUrl}" target="_blank" class="btn btn-outline-secondary">
                    <iconify-icon icon="mdi:json" inline class="me-1"></iconify-icon>
                    View Raw JSON
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="chat-messages mb-4">${renderChatMessages(state)}</div>
          <form method="POST" action="/admin/chat">
            <input type="hidden" name="parentHash" value="${hash}" />
            <textarea
              name="message"
              rows="5"
              class="form-control mb-2"
              placeholder="Continue the conversation..."
              autofocus
            ></textarea>
            <button type="submit" class="btn btn-primary">
              <iconify-icon icon="mdi:send" inline class="me-1"></iconify-icon>
              Send
            </button>
          </form>
        </div>
        ${styles}
      `,
    })
  })
