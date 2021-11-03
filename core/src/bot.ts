import express, {
  RequestHandler,
  Request,
  Response,
  NextFunction,
} from 'express'
import { Client, middleware, WebhookEvent, MessageEvent } from '@line/bot-sdk'
import { Stream } from 'stream'
import { AutomatronContext } from './types'
import { handleSMS } from './SMSHandler'
import { toMessages } from './LINEMessageUtilities'
import { createErrorMessage, SlackMessage } from './SlackMessageUtilities'
import { getCronTable } from './Cron'
import { handleTextMessage, handleImage } from './MessageHandler'
import axios from 'axios'
import Encrypted from '@dtinth/encrypted'
import sealedbox from 'tweetnacl-sealedbox-js'
import { deployPrelude } from './PreludeCode'
import { logger } from './logger'

const app = express()

function getAutomatronContext(req: Request): AutomatronContext {
  return { secrets: req.env }
}

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
    logger.info(
      { event: JSON.stringify(event) },
      'Received a message event from LINE'
    )
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
        { type: 'text', text: 'don’t know how to handle this yet!' },
      ])
    }
  }

  return main()
}

app.post('/webhook', (req, res, next) => {
  const lineConfig = getLineConfig(req)
  middleware(lineConfig)(req, res, async (err) => {
    if (err) return next(err)
    endpoint(async (context, req, services) => {
      const lineClient = services.line
      const data = await handleWebhook(context, req.body.events, lineClient)
      console.log('Response:', data)
      return data
    })(req, res, next)
  })
})

app.post(
  '/slack',
  require('body-parser').json(),
  (req, res, next) => {
    logger.info(
      { event: JSON.stringify(req.body) },
      'Received an event from Slack'
    )
    if (req.body.type === 'url_verification') {
      res.set('Content-Type', 'text/plain').send(req.body.challenge)
      return
    }
    next()
  },
  endpoint(async (context, req, services) => {
    if (req.body.type === 'event_callback') {
      let eventCache = global.automatronSlackEventCache
      if (!eventCache) {
        eventCache = new Set()
        global.automatronSlackEventCache = eventCache
      }
      const eventId = req.body.event_id
      if (eventCache.has(eventId)) {
        return
      }
      eventCache.add(eventId)
      if (req.body.event.user === req.env.SLACK_USER_ID) {
        const text = String(req.body.event.text)
          .replace(/&gt;/g, '>')
          .replace(/&lt;/g, '>')
          .replace(/&amp;/g, '&')
        const slackClient = services.slack
        const reply = await handleTextMessage(context, text)
        await slackClient.pushMessage({
          text: `\`\`\`${JSON.stringify(reply, null, 2)}\`\`\``,
        })
      }
    }

    return 1
  })
)

app.post(
  '/post',
  require('body-parser').json(),
  requireApiKey,
  endpoint(async (context, req, services) => {
    const lineClient = services.line
    const messages = toMessages(req.body.data)
    await lineClient.pushMessage(context.secrets.LINE_USER_ID, messages)
  })
)

app.post(
  '/text',
  require('body-parser').json(),
  requireApiKey,
  endpoint(async (context, req, services) => {
    const text = String(req.body.text)
    const lineClient = services.line
    await lineClient.pushMessage(
      context.secrets.LINE_USER_ID,
      toMessages('received: ' + text + ` [from ${req.body.source}]`)
    )
    const reply = await handleTextMessage(context, text)
    await lineClient.pushMessage(
      context.secrets.LINE_USER_ID,
      toMessages(reply)
    )
    return reply
  })
)

app.post(
  '/gh/prelude/push',
  require('body-parser').json(),
  endpoint(async (context, req, services) => {
    logger.info(
      { event: JSON.stringify(req.body) },
      'Received prelude push webhook from GitHub'
    )
    await deployPrelude(context)
    return 'ok'
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

app.post(
  '/notification',
  require('body-parser').text(),
  endpoint(async (context, req, services) => {
    try {
      const encrypted = Encrypted(context.secrets.ENCRYPTION_SECRET)
      const { publicKey, secretKey, forwardingTarget } = encrypted(`
        BpnjVPJcwkInfE/lPxxcl6E11BlDNh3v.KoCet77F7KC4pvuhRySH2wNP1AjYpUGVcHQSqhc
        rbFTDHUsXDaYjF/Jc584uh7Bd6yLl0a4scdEsX7EhxuHXUknD4bA8AXxkJe/OhI3EbmfleP5
        ByVNvvvxqScM9pHvCy/bURK33REznhvW0MsscwgRGsqMxvI7Km9RpxpglexWANMlrkuVBJbC
        G3CeOqs9QGI3QS0K+jse8PM7HvJ8vg43AAjQsx6o85xSzaGWVWE1wdNtWfkdusGf/NYbDyb6
        hgA9ddrCRJVMydqJ4g9A/LgpieO0v
      `)
      const result = sealedbox.open(
        Buffer.from(req.body, 'hex'),
        Buffer.from(publicKey, 'base64'),
        Buffer.from(secretKey, 'base64')
      )
      const notification = JSON.parse(Buffer.from(result).toString('utf8'))
      logger.info({ notification }, 'Received a notification')
      await axios.post(forwardingTarget, req.body, {
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    } catch (err) {
      logger.error({ err, data: req.body }, 'Unable to process notification')
    }
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
      (j) => new Date().toJSON() >= j.get('Scheduled time')
    )
    logger.trace('Number of pending cron jobs found: %s', jobsToRun.length)
    try {
      for (const job of jobsToRun) {
        let result = 'No output'
        const logContext = {
          job: { id: job.getId(), name: job.get('Name') },
        }
        try {
          const reply = await handleTextMessage(context, job.get('Name'))
          result = require('util').inspect(reply)
          logger.info(
            { ...logContext, result },
            `Done processing cron job: ${job.get('Name')}`
          )
        } catch (e) {
          logError('Unable to process cron job', e, logContext)
          result = `Error: ${e}`
        }
        await table.update(job.getId(), { Completed: true, Notes: result })
      }
      return 'All OK'
    } catch (e) {
      logError('Unable to process cron jobs', e)
      return 'Error: ' + e
    }
  })
)

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const context = getAutomatronContext(req)
  if (req.body.key !== context.secrets.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' })
  }
  next()
}

class Slack {
  constructor(private webhookUrl: string) {}
  async pushMessage(message: SlackMessage) {
    await axios.post(this.webhookUrl, message)
  }
}

function endpoint(
  f: (
    context: AutomatronContext,
    req: Request,
    services: { line: Client; slack: Slack }
  ) => Promise<any>
): RequestHandler {
  return async (req, res, next) => {
    const context = getAutomatronContext(req)
    const lineConfig = getLineConfig(req)
    const lineClient = new Client(lineConfig)
    const slackClient = new Slack(context.secrets.SLACK_WEBHOOK_URL)
    try {
      const result = await f(context, req, {
        line: lineClient,
        slack: slackClient,
      })
      res.json({ ok: true, result })
    } catch (e) {
      logError('Unable to execute endpoint ' + req.path, e)
      try {
        await slackClient.pushMessage(createErrorMessage(e as any))
      } catch (ee) {
        console.error('Cannot send error message to LINE!')
        logError('Unable to send error message to Slack', ee)
      }
      return next(e)
    }
  }
}

function logError(title: string, e: any, extra: Record<string, any> = {}) {
  var response = e.response || (e.originalError && e.originalError.response)
  var data = response && response.data
  const bindings: Record<string, any> = { ...extra, err: e }
  if (data) {
    bindings.responseData = JSON.stringify(data)
  }
  logger.error(bindings, `${title}: ${e}`)
}

function getLineConfig(req: Request) {
  const context = getAutomatronContext(req)
  return {
    channelAccessToken: context.secrets.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: context.secrets.LINE_CHANNEL_SECRET,
  }
}

function readAsBuffer(stream: Stream) {
  return new Promise((resolve, reject) => {
    stream.on('error', (e: Error) => {
      reject(e)
    })
    const bufs: Buffer[] = []
    stream.on('end', () => {
      resolve(Buffer.concat(bufs))
    })
    stream.on('data', (buf: Buffer) => {
      bufs.push(buf)
    })
  })
}

module.exports = app
