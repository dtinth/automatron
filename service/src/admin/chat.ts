import { html, type Html } from '@thai/html'
import { type CoreMessage } from 'ai'
import { Elysia } from 'elysia'
import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { continueThread, createNewThread, runAgent } from '../agent/index.ts'
import { blobService } from '../blob.ts'
import { htmlPlugin } from '../elysiaPlugins/html.ts'
import { adminUserPlugin } from './adminUserPlugin.ts'
import { layout } from './layout.ts'

// Function to retrieve chat messages
export async function retrieveChatMessages(
  hash: string
): Promise<CoreMessage[] | null> {
  try {
    const blobKey = `chat/${hash}.json`
    const blob = await blobService.getBlobClient('ephemeral', blobKey)
    if (!blob) {
      return null
    }
    const buffer = await blob.downloadToBuffer()
    const messages = JSON.parse(buffer.toString('utf-8'))
    return messages
  } catch (error) {
    console.error('Failed to retrieve chat messages:', error)
    return null
  }
}

// Function to save chat messages
export async function saveChatMessages(
  messages: CoreMessage[]
): Promise<string> {
  const buffer = Buffer.from(JSON.stringify(messages), 'utf-8')
  const hash = createHash('sha256').update(buffer).digest('hex')
  const blobKey = `chat/${hash}.json`
  await blobService.uploadStream(
    'ephemeral',
    blobKey,
    Readable.from([buffer], { objectMode: false }),
    'application/json'
  )
  return hash
}

// Function to render chat messages
function renderChatMessages(messages: CoreMessage[]): Html[] {
  const result: Html[] = []

  for (const message of messages) {
    const messageClass =
      message.role === 'user'
        ? 'user-message'
        : message.role === 'assistant'
        ? 'assistant-message'
        : 'tool-message'

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
            <details class="tool-call">
              <summary>Tool Call: ${part.toolName}</summary>
              <pre class="tool-args">${JSON.stringify(part.args, null, 2)}</pre>
            </details>
          `)
        } else if (part.type === 'tool-result') {
          const resultClass = part.isError
            ? 'tool-result tool-error'
            : 'tool-result'
          contentParts.push(html`
            <details class="${resultClass}">
              <summary>
                Tool Result: ${part.toolName}${part.isError ? ' (Error)' : ''}
              </summary>
              <pre class="tool-result-content">
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
        <div class="message-header">${message.role}</div>
        <div class="message-content">${contentParts}</div>
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
        <style>
          .chat-page {
            max-width: 800px;
            margin: 0 auto;
          }
          .user-message,
          .assistant-message,
          .tool-message {
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 5px;
          }
          .user-message {
            background-color: #e6f7ff;
            border-left: 4px solid #1890ff;
          }
          .assistant-message {
            background-color: #f6ffed;
            border-left: 4px solid #52c41a;
          }
          .tool-message {
            background-color: #fff7e6;
            border-left: 4px solid #faad14;
          }
          .message-header {
            font-weight: bold;
            margin-bottom: 5px;
            text-transform: capitalize;
          }
          .message-content {
            margin: 0;
          }
          .text-content {
            white-space: pre-wrap;
          }
          .tool-call,
          .tool-result {
            margin: 6px 0;
            border-radius: 4px;
            overflow: hidden;
          }
          .tool-call summary,
          .tool-result summary {
            padding: 6px 10px;
            cursor: pointer;
            font-weight: bold;
          }
          .tool-call summary {
            background-color: #e6f7ff;
          }
          .tool-result summary {
            background-color: #f6ffed;
          }
          .tool-error summary {
            background-color: #fff1f0;
            color: #cf1322;
          }
          .tool-args,
          .tool-result-content {
            margin: 0;
            padding: 10px;
            background-color: #f5f5f5;
            overflow: auto;
            max-height: 300px;
          }
        </style>
      `,
    })
  })
  .post('/', async ({ user, request }) => {
    const formData = await request.formData()
    const message = String(formData.get('message'))
    const parentHash = formData.get('parentHash')

    let allMessages: CoreMessage[] = []

    if (parentHash) {
      const previousMessages = await retrieveChatMessages(String(parentHash))
      if (previousMessages) {
        // Continue existing conversation
        const updatedMessages = continueThread(previousMessages, message)
        const result = await runAgent(updatedMessages)
        allMessages = [...updatedMessages, ...result.messages]
      } else {
        // If parent messages not found, start new thread
        const previousMessages = createNewThread({ text: message })
        const result = await runAgent(previousMessages)
        allMessages = [...previousMessages, ...result.messages]
      }
    } else {
      // Start new thread
      const previousMessages = createNewThread({ text: message })
      const result = await runAgent(previousMessages)
      allMessages = [...previousMessages, ...result.messages]
    }

    const hash = await saveChatMessages(allMessages)

    return new Response('Redirect', {
      status: 302,
      headers: {
        location: `/admin/chat/${hash}`,
      },
    })
  })
  .get('/:hash', async ({ user, params }) => {
    const hash = params.hash
    const messages = await retrieveChatMessages(hash)

    if (!messages) {
      return new Response('Not found', { status: 404 })
    }

    return layout({
      title: 'Chat',
      contents: html`
        <div class="chat-page">
          <h1>Chat</h1>
          <div class="chat-messages">${renderChatMessages(messages)}</div>
          <form method="POST" action="/admin/chat">
            <input type="hidden" name="parentHash" value="${hash}" />
            <textarea
              name="message"
              rows="5"
              cols="50"
              class="form-control"
              placeholder="Continue the conversation..."
              autofocus
            ></textarea>
            <button type="submit" class="btn btn-primary mt-2">Send</button>
          </form>
        </div>
        <style>
          .chat-page {
            max-width: 800px;
            margin: 0 auto;
          }
          .chat-messages {
            margin-bottom: 20px;
          }
          .user-message,
          .assistant-message,
          .tool-message {
            padding: 10px;
            margin-bottom: 10px;
            border-radius: 5px;
          }
          .user-message {
            background-color: #e6f7ff;
            border-left: 4px solid #1890ff;
          }
          .assistant-message {
            background-color: #f6ffed;
            border-left: 4px solid #52c41a;
          }
          .tool-message {
            background-color: #fff7e6;
            border-left: 4px solid #faad14;
          }
          .message-header {
            font-weight: bold;
            margin-bottom: 5px;
            text-transform: capitalize;
          }
          .message-content {
            margin: 0;
          }
          .text-content {
            white-space: pre-wrap;
          }
          .tool-call,
          .tool-result {
            margin: 6px 0;
            border-radius: 4px;
            overflow: hidden;
          }
          .tool-call summary,
          .tool-result summary {
            padding: 6px 10px;
            cursor: pointer;
            font-weight: bold;
          }
          .tool-call summary {
            background-color: #e6f7ff;
          }
          .tool-result summary {
            background-color: #f6ffed;
          }
          .tool-error summary {
            background-color: #fff1f0;
            color: #cf1322;
          }
          .tool-args,
          .tool-result-content {
            margin: 0;
            padding: 10px;
            background-color: #f5f5f5;
            overflow: auto;
            max-height: 300px;
          }
        </style>
      `,
    })
  })
