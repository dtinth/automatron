const express = require('express')
const Webtask = require('webtask-tools')
const bodyParser = require('body-parser')
const middleware = require('@line/bot-sdk').middleware
const Client = require('@line/bot-sdk').Client
const app = express()

/**
 * @param {WebtaskContext} context
 * @param {import('@line/bot-sdk').WebhookEvent[]} events
 * @param {import('@line/bot-sdk').Client} client
 */
async function handleWebhook(context, events, client) {
  return 1
}

app.post('/webhook', (req, res, next) => {
  /** @type {WebtaskContext} */
  const lineConfig = getLineConfig(req)
  middleware(lineConfig)(req, res, async err => {
    if (err) return next(err)
    try {
      const client = new Client(config)
      const data = handleWebhook(ctx, req.body.events, client)
      res.json({ data })
    } catch (e) {
      return next(err)
    }
  })
})

function getLineConfig(req) {
  const ctx = req.webtaskContext
  return {
    channelAccessToken: ctx.secrets.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: ctx.LINE_CHANNEL_SECRET
  }
}

module.exports = Webtask.fromExpress(app)
