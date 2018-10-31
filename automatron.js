const express = require('express')
const Webtask = require('webtask-tools')
const mqtt = require('mqtt')
const bodyParser = require('body-parser')
const middleware = require('@line/bot-sdk').middleware
const Client = require('@line/bot-sdk').Client
const app = express()
const axios = require('axios')

// ==== MAIN BOT LOGIC ====

/**
 * @param {WebtaskContext} context
 * @param {string} message
 */
async function handleTextMessage(context, message) {
  if (message === 'ac on' || message === 'sticker:2:27') {
    await sendHomeCommand(context, 'ac on')
    return 'ok, turning air-con on'
  } else if (message === 'ac off' || message === 'sticker:2:29') {
    await sendHomeCommand(context, 'ac off')
    return 'ok, turning air-con off'
  } else if (message === 'power on' || message === 'plugs on') {
    await sendHomeCommand(context, 'plugs on')
    return 'ok, turning smart plugs on'
  } else if (message === 'power off' || message === 'plugs off') {
    await sendHomeCommand(context, 'plugs off')
    return 'ok, turning smart plugs off'
  } else if (message === 'home' || message === 'arriving' || message === 'sticker:2:503') {
    await sendHomeCommand(context, ['plugs on', 'lights on', 'ac on'])
    return 'preparing home'
  } else if (message === 'leaving' || message === 'sticker:2:502') {
    await sendHomeCommand(context, ['plugs off', 'lights off', 'ac off'])
    return 'bye'
  } else if (message === 'lights' || message === 'sticker:4:275') {
    await sendHomeCommand(context, 'lights normal')
    return 'ok, lights normal'
  } else if (message === 'bedtime' || message === 'gn' || message === 'gngn' || message === 'sticker:11539:52114128') {
    await sendHomeCommand(context, 'lights bedtime')
    return 'ok, good night'
  } else if (message.match(/^lights \w+$/)) {
    const cmd = message.split(' ')[1]
    await sendHomeCommand(context, 'lights ' + cmd)
    return 'ok, lights ' + cmd
  } else if (message.match(/^[\d.]+[tfghmo]$/i)) {
    const m = message.match(/^([\d.]+)([tfghmo])$/i)
    const amount = Math.round(+m[1], 2)
    const category = {
      t: 'transportation',
      f: 'food',
      g: 'game',
      h: 'health',
      m: 'miscellaneous',
      o: 'occasion'
    }[m[2].toLowerCase()]
    await recordExpense(context, category, amount)
    return createBubble('expense tracking', `recorded expense ฿${amount} ${category}`)
  } else if (message.startsWith('>')) {
    const code = require('livescript').compile(message.substr(1), { bare: true })
    console.log('Code compilation result', code)
    const runner = new Function('prelude', 'code', 'context', 'with(prelude){return eval(code)}')
    const result = require('util').inspect(runner(require('prelude-ls'), code, context))
    return createBubble('livescript', result, {
      headerBackground: '#37BF00',
      headerColor: '#ffffff',
      textSize: 'sm'
    })
  }
  return 'unrecognized message! ' + message
}

// ==== SERVICE FUNCTIONS ====

/**
 * @param {WebtaskContext} context
 * @param {string | string[]} cmd
 */
async function sendHomeCommand(context, cmd) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    var client = mqtt.connect(context.secrets.MQTT_URL);
    client.on('connect', function () {
      if (Array.isArray(cmd)) {
        cmd.forEach(c => client.publish('home', c));
      } else {
        client.publish('home', cmd);
      }
      console.log('Finish sending command', cmd, Date.now() - start)
      client.end(false, resolve);
    });
    client.on('error', function (error) {
      reject(error);
    });
  });
}

/**
 * @param {WebtaskContext} context
 * @param {string} category
 * @param {string} amount
 */
async function recordExpense(context, amount, category) {
  await axios.post(context.secrets.EXPENSE_WEBHOOK, {
    value1: new Date().toJSON().split('T')[0],
    value2: amount,
    value3: category,
  })
}

// ==== SMS HANDLING ====

async function handleSMS(context, client, text) {
  const { parseSMS } = require('transaction-parser-th')
  const result = parseSMS(text)
  if (!result || !result.amount)return { match: false }

  console.log('SMS parsing result', result)
  const title = result.type
  const pay = result.type === 'pay'
  const moneyOut = ['pay', 'transfer', 'withdraw'].includes(result.type)
  const body = {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "THB " + result.amount,
        "size": "xxl",
        "weight": "bold"
      }
    ]
  }
  const ordering = ['provider', 'from', 'to', 'via', 'date', 'time', 'balance']
  const skip = ['type', 'amount']
  const getOrder = key => (ordering.indexOf(key) + 1) || 999
  for (const key of Object.keys(result)
    .filter(key => !skip.includes(key))
    .sort((a, b) => getOrder(a) - getOrder(b))
  ) {
    body.contents.push({
      "type": "box",
      "layout": "horizontal",
      "spacing": "md",
      "contents": [
        {
          "type": "text",
          "text": key,
          "align": "end",
          "color": "#888888",
          "flex": 2
        },
        {
          "type": "text",
          "text": String(result[key]),
          "flex": 5
        }
      ]
    })
  }
  await client.pushMessage(context.secrets.LINE_USER_ID, createBubble(title, body, {
    headerBackground: pay ? '#91918F' : moneyOut ? '#DA9E00' : '#9471FF',
    headerColor: '#FFFFFF',
    altText: require('util').inspect(result)
  }))
  return { match: true }
}

// ==== RUNTIME CODE ====

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
    console.log(event)
    if (event.source.userId !== context.secrets.LINE_USER_ID) {
      await client.replyMessage(replyToken, toMessages('unauthorized'))
      return
    }
    if (message.type === 'text') {
      const reply = await handleTextMessage(context, message.text)
      await client.replyMessage(replyToken, toMessages(reply))
    } else if (message.type === 'sticker') {
      const reply = await handleTextMessage(context, 'sticker:' + message.packageId + ':' + message.stickerId)
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

app.post('/post', require('body-parser').json(), requireApiKey, endpoint(async (context, req, services) => {
  const client = services.line
  const messages = toMessages(req.body.data)
  await client.pushMessage(context.secrets.LINE_USER_ID, messages)
}))

app.post('/text', require('body-parser').json(), requireApiKey, endpoint(async (context, req, services) => {
  const text = String(req.body.text)
  const client = services.line
  await client.pushMessage(context.secrets.LINE_USER_ID, toMessages('received: ' + text + ` [from ${req.body.source}]`))
  const reply = await handleTextMessage(context, text)
  await client.pushMessage(context.secrets.LINE_USER_ID, toMessages(reply))
  return reply
}))

app.post('/sms', require('body-parser').json(), requireApiKey, endpoint(async (context, req, services) => {
  const text = String(req.body.text)
  return await handleSMS(context, services.line, text)
}))

function requireApiKey(req, res, next) {
  const context = req.webtaskContext
  if (req.body.key !== context.secrets.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' })
  }
  next()
}

function endpoint(f) {
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
        await client.pushMessage(context.secrets.LINE_USER_ID, createErrorMessage(e))
      } catch (ee) {
        console.error('Cannot send error message to LINE!')
        logError(ee)
      }
      return next(e)
    }
  }
}

function logError(e) {
  var response = e.response || (e.originalError && e.originalError.response)
  var data = response && response.data
  if (data) {
    console.error('HTTP error data', data)
  }
}

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

function createErrorMessage(error) {
  const title = (error.name || 'Error') + (error.message ? `: ${error.message}` : '')
  return createBubble(title, String(error.stack || error), {
    headerBackground: '#E82822',
    headerColor: '#ffffff',
    textSize: 'sm'
  })
}

function createBubble(title, text, {
  headerBackground = '#353433',
  headerColor = '#d7fc70',
  textSize = 'xl',
  altText = text
} = {}) {
  const data = {
    "type": "bubble",
    "styles": {
      "header": {
        "backgroundColor": headerBackground
      }
    },
    "header": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": title,
          "color": headerColor,
          "weight": "bold"
        }
      ]
    },
    "body": typeof text === 'string' ? {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": text,
          "wrap": true,
          "size": textSize
        }
      ]
    } : text
  }
  return { type: 'flex', altText: truncate(`[${title}] ${altText}`, 400), contents: data }
}

function truncate(text, maxLength) {
  return text.length + 5 > maxLength ? text.substr(0, maxLength - 5) + '…' : text
}

module.exports = Webtask.fromExpress(app)
