import { node } from '@elysiajs/node'
import { validateSignature } from '@line/bot-sdk'
import { Elysia } from 'elysia'
import { config } from './config.ts'
import { getRecipient } from './encryption.ts'
import { createLogger } from './logger.ts'
import { storage } from './storage.ts'

const signatureValidators = new WeakMap<Request, () => Promise<boolean>>()

const line = new Elysia()
  .onRequest(({ request }) => {
    const clone = request.clone()
    signatureValidators.set(request, async () => {
      const body = await clone.arrayBuffer()
      const actual = request.headers.get('X-Line-Signature')

      return validateSignature(
        Buffer.from(body),
        process.env.LINE_CHANNEL_SECRET!,
        actual!
      )
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
  .post('/line-webhook', async ({ request, body, validateLineSignature }) => {
    console.log(body)
    console.log(await validateLineSignature())
    return 'ok-ish'
  })

const app = new Elysia({ adapter: node() })
  .use(createLogger())
  .get('/', () => `i am automatron (revision: ${process.env.APP_REVISION || 'unknown'})`)
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
