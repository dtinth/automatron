const express = require('express')
const Webtask = require('webtask-tools')
const bodyParser = require('body-parser')
const middleware = require('@line/bot-sdk').middleware
const Client = require('@line/bot-sdk').Client
const app = express()

/**
 * @param {WebtaskContext} context
 * @param {string} message
 */
async function handleTextMessage(context, message) {
  return 'alright! ' + message
}

/**
 * @param {WebtaskContext} context
 * @param {import('@line/bot-sdk').WebhookEvent[]} events
 * @param {import('@line/bot-sdk').Client} client
 */
async function handleWebhook(context, events, client) {
  async function main() {
    for (const event of events) {
      if (event.type === 'message') {
        await handleMessageEvent(event)
      }
    }
  }

  async function handleMessageEvent(event) {
    const { replyToken, message } = event
    console.log(message)
    if (message.type === 'text') {
      let reply
      try {
        reply = await handleTextMessage(context, message.text)
      } catch (e) {
        reply = `Error: ${e.stack}`
      }
      client.replyMessage(replyToken, toMessages(reply))
    } else {
      client.replyMessage(replyToken, [
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
    try {
      const client = new Client(lineConfig)
      const data = await handleWebhook(req.webtaskContext, req.body.events, client)
      console.log('Response:', data)
      res.json({ ok: true, data })
    } catch (e) {
      return next(e)
    }
  })
})

app.post('/post', require('body-parser').json(), async (req, res, next) => {
  try {
    const context = req.webtaskContext
    if (req.body.key !== context.secrets.API_KEY) {
      return res.status(401).json({ error: 'Invalid API key' })
    }
    const lineConfig = getLineConfig(req)
    const client = new Client(lineConfig)
    const messages = toMessages(req.body.data)
    await client.pushMessage(context.secrets.LINE_USER_ID, messages)
    res.json({ ok: true })
  } catch (e) {
    return next(e)
  }
})

function toMessages(data) {
  if (!data) data = '...'
  if (typeof data === 'string') data = [{ type: 'text', text: data }]
  return data
}

function getLineConfig(req) {
  const ctx = req.webtaskContext
  return {
    channelAccessToken: ctx.secrets.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: ctx.secrets.LINE_CHANNEL_SECRET
  }
}

module.exports = Webtask.fromExpress(app)
