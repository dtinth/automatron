import express, {
  RequestHandler,
  Request,
  Response,
  NextFunction
} from 'express'
import { Client, middleware, WebhookEvent, MessageEvent } from '@line/bot-sdk'
import { Stream } from 'stream'
import { AutomatronContext } from './types'
import { handleSMS } from './SMSHandler'
import { toMessages, createErrorMessage } from './LINEMessageUtilities'
import { getCronTable } from './Cron'
import { handleTextMessage, handleImage } from './MessageHandler'

const app = express()

async function handleWebhook(
  context: AutomatronContext,
  events: WebhookEvent[],
  client: Client
) {
  async function main() {
    for (const event of events) {
      if (event.type === 'message') {
        await handleMessageEvent(event)
      }
    }
  }

  async function handleMessageEvent(event: MessageEvent) {
    const { replyToken, message } = event
    console.log(event)
    if (event.source.userId !== context.secrets.LINE_USER_ID) {
      await client.replyMessage(replyToken, toMessages('unauthorized'))
      return
    }
    if (message.type === 'text') {
      const reply = await handleTextMessage(context, message.text)
      await client.replyMessage(replyToken, toMessages(reply))
    } else if (message.type === 'sticker') {
      const reply = await handleTextMessage(
        context,
        'sticker:' + message.packageId + ':' + message.stickerId
      )
      await client.replyMessage(replyToken, toMessages(reply))
    } else if (message.type === 'image') {
      const content = await client.getMessageContent(message.id)
      const buffer = await readAsBuffer(content)
      const reply = await handleImage(context, buffer as Buffer)
      await client.replyMessage(replyToken, toMessages(reply))
    } else {
      await client.replyMessage(replyToken, [
        { type: 'text', text: 'don’t know how to handle this yet!' }
      ])
    }
  }

  return main()
}

app.post('/webhook', (req, res, next) => {
  const lineConfig = getLineConfig(req)
  middleware(lineConfig)(req, res, async err => {
    if (err) return next(err)
    endpoint(async (context, req, services) => {
      const client = services.line
      const data = await handleWebhook(context, req.body.events, client)
      console.log('Response:', data)
      return data
    })(req, res, next)
  })
})

app.post(
  '/post',
  require('body-parser').json(),
  requireApiKey,
  endpoint(async (context, req, services) => {
    const client = services.line
    const messages = toMessages(req.body.data)
    await client.pushMessage(context.secrets.LINE_USER_ID, messages)
  })
)

app.post(
  '/text',
  require('body-parser').json(),
  requireApiKey,
  endpoint(async (context, req, services) => {
    const text = String(req.body.text)
    const client = services.line
    await client.pushMessage(
      context.secrets.LINE_USER_ID,
      toMessages('received: ' + text + ` [from ${req.body.source}]`)
    )
    const reply = await handleTextMessage(context, text)
    await client.pushMessage(context.secrets.LINE_USER_ID, toMessages(reply))
    return reply
  })
)

app.post(
  '/reload',
  require('body-parser').json(),
  requireApiKey,
  endpoint(async (context, req, services) => {
    context.reload()
    return { ok: true }
  })
)

app.post(
  '/sms',
  require('body-parser').json(),
  requireApiKey,
  endpoint(async (context, req, services) => {
    const text = String(req.body.text)
    return await handleSMS(context, services.line, text)
  })
)

app.get(
  '/cron',
  endpoint(async (context, req, services) => {
    const table = getCronTable(context)
    const pendingJobs = await table
      .select({ filterByFormula: 'NOT(Completed)' })
      .all()
    const jobsToRun = pendingJobs.filter(
      j => new Date().toJSON() >= j.get('Scheduled time')
    )
    try {
      for (const job of jobsToRun) {
        let result = 'No output'
        try {
          const reply = await handleTextMessage(context, job.get('Name'))
          result = require('util').inspect(reply)
        } catch (e) {
          result = `Error: ${e}`
        }
        await table.update(job.getId(), { Completed: true, Notes: result })
      }
      return 'All OK'
    } catch (e) {
      return 'Error: ' + e
    }
  })
)

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const context = req.webtaskContext
  if (req.body.key !== context.secrets.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' })
  }
  next()
}
function endpoint(
  f: (
    context: AutomatronContext,
    req: Request,
    services: {
      line: Client
    }
  ) => Promise<any>
): RequestHandler {
  return async (req, res, next) => {
    const context = req.webtaskContext
    const lineConfig = getLineConfig(req)
    const client = new Client(lineConfig)
    try {
      const result = await f(context, req, { line: client })
      res.json({ ok: true, result })
    } catch (e) {
      console.error('An error has been caught in the endpoint...')
      logError(e)
      try {
        await client.pushMessage(
          context.secrets.LINE_USER_ID,
          createErrorMessage(e)
        )
      } catch (ee) {
        console.error('Cannot send error message to LINE!')
        logError(ee)
      }
      return next(e)
    }
  }
}

function logError(e: any) {
  var response = e.response || (e.originalError && e.originalError.response)
  var data = response && response.data
  if (data) {
    console.error('HTTP error data', data)
  }
}

function getLineConfig(req: Request) {
  const ctx = req.webtaskContext
  return {
    channelAccessToken: ctx.secrets.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: ctx.secrets.LINE_CHANNEL_SECRET
  }
}

function readAsBuffer(stream: Stream) {
  return new Promise((resolve, reject) => {
    stream.on('error', e => {
      reject(e)
    })
    const bufs: Buffer[] = []
    stream.on('end', () => {
      resolve(Buffer.concat(bufs))
    })
    stream.on('data', buf => {
      bufs.push(buf)
    })
  })
}

module.exports = app
