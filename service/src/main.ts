import { node } from '@elysiajs/node'
import {
  messagingApi,
  validateSignature,
  type WebhookRequestBody,
} from '@line/bot-sdk'
import consola from 'consola'
import { Elysia } from 'elysia'
import { Brain } from './brain.ts'
import { config } from './config.ts'
import { decryptText, getRecipient } from './encryption.ts'
import { createLogger } from './logger.ts'
import { registerCorePlugins } from './plugins/index.ts'
import { storage } from './storage.ts'
import { handleLINEMessage, sendLINEResponse } from './adapters/line.ts'

const signatureValidators = new WeakMap<Request, () => Promise<boolean>>()

async function getLineConfig() {
  return {
    channelAccessToken: await decryptText(
      (await config.get('LINE_CHANNEL_ACCESS_TOKEN_DEV')) as string
    ),
  }
}

// Initialize Brain with plugins
const brain = new Brain()
registerCorePlugins(brain)

const line = new Elysia()
  .onRequest(({ request }) => {
    const clone = request.clone()
    signatureValidators.set(request, async () => {
      const body = await clone.arrayBuffer()
      const actual = request.headers.get('X-Line-Signature')
      const channelSecret = await decryptText(
        (await config.get('LINE_CHANNEL_SECRET_DEV')) as string
      )
      return validateSignature(Buffer.from(body), channelSecret, actual!)
    })
  })
  .derive(({ request }) => {
    const signatureValidator =
      signatureValidators.get(request) ??
      (() => {
        throw new Error('Signature validator not found for this request')
      })
    return { validateLineSignature: signatureValidator }
  })
  .post('/line-webhook', async ({ body, validateLineSignature, set }) => {
    if (!(await validateLineSignature())) {
      set.status = 401
      return 'Unauthorized'
    }
    const payload = body as unknown as WebhookRequestBody
    const userId = await config.get('LINE_OWNER_USER_ID')
    const lineConfig = await getLineConfig()
    
    for (const event of payload.events) {
      if (event.source.userId !== userId) {
        consola.warn(`User ID mismatch: ${event.source.userId} !== ${userId}`)
        continue
      }
      if (event.type === 'message') {
        const replyToken = event.replyToken
        
        // Show loading animation
        const animationClient = new messagingApi.MessagingApiClient(lineConfig)
        animationClient
          .showLoadingAnimation({
            chatId: event.source.userId,
            loadingSeconds: 60,
          })
          .catch((err) => {
            consola.error('Error showing loading animation:', err)
          })
        
        // Process message with platform-agnostic handler
        try {
          // Convert LINE message to generic format
          const genericMessage = await handleLINEMessage(event, lineConfig)
          
          // Process with Brain
          const response = await brain.processMessage(genericMessage)
          
          if (!response) {
            const client = new messagingApi.MessagingApiClient(lineConfig)
            await client.replyMessage({
              replyToken,
              messages: [
                {
                  type: 'text',
                  text: "I don't know how to handle this message.",
                },
              ],
            })
            continue
          }
          
          // Send response back to LINE
          await sendLINEResponse(response, replyToken, lineConfig)
        } catch (error) {
          consola.error('Error handling message:', error)
          const errorClient = new messagingApi.MessagingApiClient(await getLineConfig())
          await errorClient.replyMessage({
            replyToken,
            messages: [
              {
                type: 'text',
                text: `Error: ${(error as Error).message}`,
              },
            ],
          })
        }
      }
    }
    return 'ok'
  })

const app = new Elysia({ adapter: node() })
  .use(createLogger())
  .get(
    '/',
    () => `i am automatron (revision: ${process.env.COMMIT_HASH || 'unknown'})`
  )
  .get('/recipient', () => getRecipient())
  .get('/config', async () => {
    console.log(await config.get('test'))
    await storage.setItem('test', 'it works!')
    return 'ok'
  })
  .use(line)
  .listen(29691, ({ hostname, port }) => {
    console.log(`🦊 Elysia is running at ${hostname}:${port}`)
  })