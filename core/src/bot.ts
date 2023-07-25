import Encrypted from '@dtinth/encrypted'
import { Client, MessageEvent, middleware, WebhookEvent } from '@line/bot-sdk'
import axios from 'axios'
import cors from 'cors'
import express, {
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from 'express'
import handler from 'express-async-handler'
import { auth as jwtAuth, claimEquals } from 'express-oauth2-jwt-bearer'
import { Stream } from 'stream'
import sealedbox from 'tweetnacl-sealedbox-js'
import { getCronTable } from './Cron'
import { encrypt } from './DataEncryption'
import { toMessages } from './LINEMessageUtilities'
import { logger } from './logger'
import { handleImage, handleTextMessage } from './MessageHandler'
import { getMessageHistory } from './MessageHistory'
import { handleNotification } from './NotificationProcessor'
import { ref } from './PersistentState'
import { deployPrelude } from './PreludeCode'
import { createErrorMessage, SlackMessage } from './SlackMessageUtilities'
import { handleSMS } from './SMSHandler'
import { getAllSpeedDials } from './SpeedDial'
import { AutomatronContext } from './types'

const app = express()
app.set('trust proxy', true)

function getAutomatronContext(req: Request, res: Response): AutomatronContext {
  return {
    secrets: req.env,
    tracer: req.tracer,
    requestInfo: {
      ip: req.ip,
      ips: req.ips,
      headers: req.headers,
    },
    addPromise: (name, promise) => {
      if (!res.yields) res.yields = []
      res.yields.push(promise)
    },
  }
}

async function runMiddleware(
  req: Request,
  res: Response,
  middleware: RequestHandler
): Promise<void> {
  return new Promise((resolve, reject) => {
    middleware(req, res, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
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
    if (event.source.userId !== context.secrets.LINE_USER_ID) {
      await client.replyMessage(replyToken, toMessages('unauthorized'))
      return
    }
    if (message.type === 'text') {
      const reply = await handleTextMessage(context, message.text, {
        source: 'line',
      })
      await client.replyMessage(replyToken, toMessages(reply))
    } else if (message.type === 'sticker') {
      const reply = await handleTextMessage(
        context,
        'sticker:' + message.packageId + ':' + message.stickerId,
        { source: 'line' }
      )
      await client.replyMessage(replyToken, toMessages(reply))
    } else if (message.type === 'image') {
      const content = await client.getMessageContent(message.id)
      const buffer = await readAsBuffer(content)
      const reply = await handleImage(context, buffer as Buffer, {
        source: 'line',
      })
      await client.replyMessage(replyToken, toMessages(reply))
    } else {
      await client.replyMessage(replyToken, [
        { type: 'text', text: 'don’t know how to handle this yet!' },
      ])
    }
  }

  return main()
}

app.post(
  '/webhook',
  handler(async (req, res) => {
    const lineConfig = getLineConfig(req, res)
    await runMiddleware(req, res, middleware(lineConfig))
    await handleRequest(req, res, async (context, services) => {
      const lineClient = services.line
      logger.info(
        { ingest: 'line', event: JSON.stringify(req.body) },
        'Received webhook from LINE'
      )
      const data = await handleWebhook(context, req.body.events, lineClient)
      return data
    })
  })
)

app.post(
  '/slack',
  require('body-parser').json(),
  (req, res, next) => {
    logger.info(
      { ingest: 'slack', event: JSON.stringify(req.body) },
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
        const reply = await handleTextMessage(context, text, {
          source: 'slack',
        })
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
    logger.info(
      { ingest: 'text', event: JSON.stringify(req.body) },
      'Received a text API call'
    )
    const text = String(req.body.text)
    logToSlack(context, services.auditSlack, text, req.body.source)
    const reply = await handleTextMessage(context, text, {
      source: 'text:' + req.body.source,
    })
    return reply
  })
)

app.options('/webpost-firebase', cors() as any)
app.post(
  '/webpost-firebase',
  require('body-parser').json(),
  requireFirebaseAuth,
  cors(),
  endpoint(async (context, req, services) => {
    logger.info(
      { ingest: 'webpost-firebase', event: JSON.stringify(req.body) },
      'Received a webpost API call with Firebase credentials'
    )
    const text = String(req.body.text)
    logToSlack(context, services.auditSlack, text, req.body.source)
    const reply = await handleTextMessage(context, text, {
      source: 'webpost:' + req.body.source,
    })
    return reply
  })
)

app.options('/history', cors() as any)
app.get(
  '/history',
  requireFirebaseAuth,
  cors(),
  endpoint(async (context, req) => {
    logger.info(
      { ingest: 'history', event: JSON.stringify(req.body) },
      'Received a history API call'
    )
    return {
      history: await getMessageHistory(context, { limit: 20 }),
    }
  })
)

app.options('/speed-dials', cors() as any)
app.get(
  '/speed-dials',
  requireFirebaseAuth,
  cors(),
  endpoint(async (context, req) => {
    logger.info(
      { ingest: 'speed-dials', event: JSON.stringify(req.body) },
      'Received a speed dial API call'
    )
    return {
      speedDials: await getAllSpeedDials(context),
    }
  })
)

app.options('/knobs', cors() as any)
app.get(
  '/knobs',
  requireFirebaseAuth,
  cors(),
  endpoint(async (context, req) => {
    logger.info({ ingest: 'knobs' }, 'Received a knobs API call')
    const knobKeys = ((await ref(context, 'knobs').get()) as string).split(',')
    const knobs = Object.fromEntries(
      await Promise.all(
        knobKeys.map(async (key) => {
          const value = await ref(context, key).get()
          return [key, value] as [string, string]
        })
      )
    )
    return { knobs }
  })
)

// http post $AUTOMATRON/encrypt data=meow
app.post(
  '/encrypt',
  express.json(),
  endpoint(async (context, req) => {
    return encrypt(context, req.body.data)
  })
)

function logToSlack(
  context: AutomatronContext,
  slack: Slack,
  text: string,
  source: string
) {
  context.addPromise(
    'Log to Slack',
    slack.pushMessage({
      blocks: [
        {
          type: 'context',
          elements: [{ type: 'plain_text', text: 'from ' + source }],
        },
        {
          type: 'section',
          text: { type: 'plain_text', text: text },
        },
      ],
    })
  )
}

app.post(
  '/gh/prelude/push',
  require('body-parser').json(),
  endpoint(async (context, req, services) => {
    logger.info(
      { ingest: 'prelude-push', event: JSON.stringify(req.body) },
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
      logger.info(
        { ingest: 'notification', notification },
        'Received a notification from ' + notification.packageName
      )
      await Promise.all([
        axios.post(forwardingTarget, req.body, {
          headers: {
            'Content-Type': 'text/plain',
          },
        }),
        handleNotification(context, notification),
      ])
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
          const reply = await handleTextMessage(context, job.get('Name'), {
            source: 'cron:' + job.getId(),
          })
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
  const context = getAutomatronContext(req, res)
  if (req.body.key !== context.secrets.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' })
  }
  next()
}

const firebaseAuthn = jwtAuth({
  issuer: 'https://securetoken.google.com/dtinth-automatron',
  jwksUri:
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  audience: 'dtinth-automatron',
})
function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  const encrypted = Encrypted(req.env.ENCRYPTION_SECRET)
  const sub = encrypted(
    `HnX5zHMDR/F7ZUy8sw2829Wi7cYbi/3c.6CBZ+I3sTbyYsXUg81qf+OvjRQExIfVkkhGvEs9E+w7LAO4y9KwU1DtKAtIutA==`
  )
  return firebaseAuthn(req, res, (err) => {
    if (err) {
      return next(err)
    }
    claimEquals('sub', sub)(req, res, next)
  })
}

class Slack {
  constructor(private webhookUrl: string) {}
  async pushMessage(message: SlackMessage) {
    await axios.post(this.webhookUrl, message)
  }
}

interface ThirdPartyServices {
  line: Client
  slack: Slack
  auditSlack: Slack
}

function endpoint(
  f: (
    context: AutomatronContext,
    req: Request,
    services: ThirdPartyServices
  ) => Promise<any>
): RequestHandler {
  return handler(async (req, res) => {
    await handleRequest(req, res, (context, services) =>
      f(context, req, services)
    )
  })
}

async function handleRequest(
  req: Request,
  res: Response,
  f: (context: AutomatronContext, services: ThirdPartyServices) => Promise<any>
) {
  const context = getAutomatronContext(req, res)
  const encrypted = Encrypted(context.secrets.ENCRYPTION_SECRET)
  const lineConfig = getLineConfig(req, res)
  const lineClient = new Client(lineConfig)
  const slackClient = new Slack(context.secrets.SLACK_WEBHOOK_URL)
  const auditSlackClient = new Slack(
    encrypted(
      'j3o0uDUL3OuYfUsYxZUkI8ECdaUIGxW0.HX1CMjS27oaZHnQormJbPIoE9xdPB3GsITBVXW2oIFeuuAb4xyWVJZyywWMubR1I1ECkXtBJN+Fs+98MECYk+u9YnlnAgw6DlE9e8TezE88C5DeNtOO0DOnSO6ww39Cn/w=='
    )
  )
  try {
    const result = await f(context, {
      line: lineClient,
      slack: slackClient,
      auditSlack: auditSlackClient,
    })
    await Promise.allSettled(res.yields || [])
    res.json({ ok: true, result })
  } catch (e) {
    logError('Unable to execute endpoint ' + req.path, e)
    try {
      await slackClient.pushMessage(createErrorMessage(e as any))
    } catch (ee) {
      console.error('Cannot send error message to LINE!')
      logError('Unable to send error message to Slack', ee)
    }
    await Promise.allSettled(res.yields || [])
    throw e
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

function getLineConfig(req: Request, res: Response) {
  const context = getAutomatronContext(req, res)
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
