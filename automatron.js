const express = require('express')
const mqtt = require('mqtt')
const bodyParser = require('body-parser')
const middleware = require('@line/bot-sdk').middleware
const Client = require('@line/bot-sdk').Client
const app = express()
const axios = require('axios')
const Airtable = require('airtable')
const vision = require('@google-cloud/vision')

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
    await sendHomeCommand(context, ['plugs on', 'lights normal', 'ac on'])
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
  } else if (message.match(/^[\d.]+j?[tfghmol]$/i)) {
    const m = message.match(/^([\d.]+)(j?)([tfghmol])$/i)
    const amount = (+m[1] * (m[2] ? 0.302909 : 1)).toFixed(2)
    const category = {
      t: 'transportation',
      f: 'food',
      g: 'game',
      h: 'health',
      m: 'miscellaneous',
      o: 'occasion',
      l: 'lodging'
    }[m[3].toLowerCase()]
    const remarks = m[2] ? `${m[1]} JPY` : ''
    return await recordExpense(context, amount, category, remarks)
  } else if (message.startsWith('>')) {
    const code = require('livescript').compile(message.substr(1), { bare: true })
    console.log('Code compilation result', code)
    const runner = new Function(
      ...['prelude', 'code', 'context', 'state'],
      'with (prelude) { with (state) { return [ eval(code), state ] } }'
    )
    const prevStateSnapshot = await new Promise((resolve, reject) => {
      context.storage.get((error, data) => error ? reject(error) : resolve(data))
    })
      .then(data => (data || {}).jsState || '{}')
    const prevState = JSON.parse(prevStateSnapshot)
    const [value, nextState] = runner(require('prelude-ls'), code, context, prevState)
    let result = require('util').inspect(value)
    const extraMessages = []
    const nextStateSnapshot = JSON.stringify(nextState)
    if (nextStateSnapshot !== prevStateSnapshot) {
      extraMessages.push({
        type: 'text',
        text: 'state = ' + JSON.stringify(nextState, null, 2)
      })
      await new Promise((resolve, reject) => {
        context.storage.set(
          { jsState: nextStateSnapshot },
          (error) => error ? reject(error) : resolve()
        )
      })
    }
    return [
      // createBubble('livescript', result, {
      //   headerBackground: '#37BF00',
      //   headerColor: '#ffffff',
      //   textSize: 'sm'
      // }),
      { type: 'text', text: result },
      ...extraMessages
    ]
  }
  return 'unrecognized message...'
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
        "text": "฿" + result.amount,
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
  const quickReply = (suffix, label) => ({
    type: 'action',
    action: {
      type: 'message',
      label: label,
      text: result.amount + suffix
    }
  })
  const messages = [
    {
      ...createBubble(title, body, {
        headerBackground: pay ? '#91918F' : moneyOut ? '#DA9E00' : '#9471FF',
        headerColor: '#FFFFFF',
        altText: require('util').inspect(result)
      }),
      quickReply: {
        items: [
          quickReply('f', 'food'),
          quickReply('h', 'health'),
          quickReply('t', 'transport'),
          quickReply('m', 'misc'),
          quickReply('o', 'occasion')
        ]
      }
    }
  ]
  if (result.type === 'pay' && result.to === 'LINEPAY*BTS01') {
    messages.push(await recordExpense(context, result.amount, 'transportation', 'BTS'))
  }
  await client.pushMessage(context.secrets.LINE_USER_ID, messages)
  return { match: true }
}

async function handleImage(context, imageBuffer) {
  const credentials = JSON.parse(
    Buffer.from(context.secrets.CLOUD_VISION_SERVICE_ACCOUNT, 'base64').toString()
  )
  const imageAnnotator = new vision.ImageAnnotatorClient({ credentials })
  const results = await imageAnnotator.documentTextDetection(imageBuffer)
  const fullTextAnnotation = results[0].fullTextAnnotation
  const blocks = []
  for (const page of fullTextAnnotation.pages) {
    blocks.push(...page.blocks.map(block => {
      return block.paragraphs.map(p =>
        p.words.map(w => w.symbols.map(s => s.text).join('')).join(' ')
      ).join('\n\n')
    }))
  }
  const blocksToResponses = blocks => {
    if (blocks.length <= 5) return blocks
    let processedIndex = 0
    const outBlocks = []
    for (let i = 0; i < 5; i++) {
      const targetIndex = Math.ceil((i + 1) * blocks.length / 5)
      outBlocks.push(blocks.slice(processedIndex, targetIndex).map(x => `・ ${x}`).join('\n'))
      processedIndex = targetIndex
    }
    return outBlocks
  }
  const responses = blocksToResponses(blocks)
  return responses.map(r => ({ type: 'text', text: r }))
}

// ==== SERVICE FUNCTIONS ====

/**
 * @param {WebtaskContext} context
 * @param {string | string[]} cmd
 */
async function sendHomeCommand(context, cmd) {
  var client = await getMQTTClient(context)
  if (Array.isArray(cmd)) {
    cmd.forEach(c => client.publish('home', c));
  } else {
    client.publish('home', cmd);
  }
}

/**
 * @param {WebtaskContext} context
 * @param {string} category
 * @param {string} amount
 */
async function recordExpense(context, amount, category, remarks = '') {
  const date = new Date().toJSON().split('T')[0]

  // Airtable
  const table = getExpensesTable(context)

  const record = await table.create({
    Date: date,
    Category: category,
    Amount: amount,
    Remarks: remarks
  }, { typecast: true })

  const body = {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "text": "฿" + amount,
        "size": "xxl",
        "weight": "bold"
      },
      {
        "type": "text",
        "text": `${category}\nrecorded`,
        "wrap": true
      }
    ],
    action: {
      type: 'uri',
      label: 'Open Airtable',
      uri: context.secrets.AIRTABLE_EXPENSE_URI + '/' + record.getId()
    }
  }

  const footer = await getExpensesSummaryData(context)
  const bubble = createBubble('expense tracking', body, {
    headerColor: '#ffffbb',
    footer: {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: footer.map(([label, text]) => ({
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: label, color: '#8b8685', size: 'xs', align: 'end' },
          { type: 'text', text: text, color: '#8b8685', size: 'sm', align: 'end' }
        ]
      })),
      action: {
        type: 'uri',
        label: 'Open Airtable',
        uri: context.secrets.AIRTABLE_EXPENSE_URI
      }
    }
  })
  return bubble
}

function getExpensesTable(context) {
  return new Airtable({ apiKey: context.secrets.AIRTABLE_API_KEY })
    .base(context.secrets.AIRTABLE_EXPENSE_BASE)
    .table('Expense records')
}

async function getExpensesSummaryData(context) {
  const date = new Date().toJSON().split('T')[0]
  const tableData = await getExpensesTable(context).select().all()
  const normalRecords = tableData.filter(r => !r.get('Occasional'))
  const total = records => records.map(r => +r.get('Amount') || 0).reduce((a, b) => a + b, 0)
  const firstDate = normalRecords.map(r => r.get('Date')).reduce((a, b) => a < b ? a : b, date)
  const todayUsage = total(normalRecords.filter(r => r.get('Date') === date))
  const totalUsage = total(normalRecords)
  const dayNumber = Math.round((Date.parse(date) - Date.parse(firstDate)) / 86400e3) + 1
  const [pacemakerPerDay, pacemakerBase] = context.secrets.EXPENSE_PACEMAKER.split('/')
  const pacemaker = (+pacemakerBase) + (+pacemakerPerDay) * dayNumber - totalUsage
  const $ = v => `฿${v.toFixed(2)}`
  return [
    ['today', $(todayUsage)],
    ['pace', $(pacemaker)],
    ['day', `${dayNumber}`]
  ]
}

// ==== UTILITY FUNCTIONS ====

async function getMQTTClient(context) {
  if (global.automatronMqttPromise) {
    return global.automatronMqttPromise
  }
  const promise = new Promise((resolve, reject) => {
    var client = mqtt.connect(context.secrets.MQTT_URL);
    client.on('connect', function () {
      resolve(client)
    })
    client.on('error', function (error) {
      reject(error)
      global.automatronMqttPromise = null
    })
  })
  global.automatronMqttPromise = promise
  return promise
}

function toMessages(data) {
  if (!data) data = '...'
  if (typeof data === 'string') data = [{ type: 'text', text: data }]
  return data
}

function createErrorMessage(error) {
  const title = (error.name || 'Error') + (error.message ? `: ${error.message}` : '')
  return createBubble(title, String(error.stack || error), {
    headerBackground: '#E82822',
    headerColor: '#ffffff',
    textSize: 'sm'
  })
}

function createBubble(
  title,
  text,
  {
    headerBackground = '#353433',
    headerColor = '#d7fc70',
    textSize = 'xl',
    altText = text,
    footer,
  } = {}
) {
  const data = {
    type: 'bubble',
    styles: {
      header: { backgroundColor: headerBackground },
    },
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: title, color: headerColor, weight: 'bold' },
      ],
    },
    body:
      typeof text === 'string'
        ? {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: text, wrap: true, size: textSize },
            ],
          }
        : text,
  }
  if (footer) {
    data.styles.footer = { backgroundColor: '#e9e8e7' }
    data.footer =
      typeof footer === 'string'
        ? {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: footer,
                wrap: true,
                size: 'sm',
                color: '#8b8685',
              },
            ],
          }
        : footer
  }
  return {
    type: 'flex',
    altText: truncate(`[${title}] ${altText}`, 400),
    contents: data,
  }
}

function truncate(text, maxLength) {
  return text.length + 5 > maxLength ? text.substr(0, maxLength - 5) + '…' : text
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
    } else if (message.type === 'image') {
      const content = await client.getMessageContent(message.id)
      const buffer = await readAsBuffer(content)
      const reply = await handleImage(context, buffer)
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

app.post('/reload', require('body-parser').json(), requireApiKey, endpoint(async (context, req, services) => {
  context.reload()
  return { ok: true }
}))

app.post('/sms', require('body-parser').json(), requireApiKey, endpoint(async (context, req, services) => {
  const text = String(req.body.text)
  return await handleSMS(context, services.line, text)
}))

app.get('/cron', endpoint(async (context, req, services) => {
  const table = new Airtable({ apiKey: context.secrets.AIRTABLE_API_KEY })
    .base(context.secrets.AIRTABLE_CRON_BASE)
    .table('Cron jobs')
  const pendingJobs = await table.select({ filterByFormula: 'NOT(Completed)' }).all()
  const jobsToRun = pendingJobs.filter(j => new Date().toJSON() >= j.get('Scheduled time'))
  try {
    for (job of jobsToRun) {
      let result = 'No output'
      try {
        const reply = await handleTextMessage(context, job.get('Name'))
        result = require('util').inspect(reply)
      } catch (e) {
        result = `Error: ${e}`
      }
      await table.update(job.id, { Completed: true, Notes: result })
    }
    return 'All OK'
  } catch (e) {
    return 'Error: ' + e
  }
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

function getLineConfig(req) {
  const ctx = req.webtaskContext
  return {
    channelAccessToken: ctx.secrets.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: ctx.secrets.LINE_CHANNEL_SECRET
  }
}

function readAsBuffer(stream) {
  return new Promise((resolve, reject) => {
    stream.on('error', e => {
      reject(e)
    })
    const bufs = []
    stream.on('end', () => {
      resolve(Buffer.concat(bufs))
    })
    stream.on('data', buf => {
      bufs.push(buf)
    })
  })
}

module.exports = app
