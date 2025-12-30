import { Storage } from '@google-cloud/storage'
import { start } from '@google-cloud/trace-agent'
import * as age from 'age-encryption'
import crypto from 'crypto'
import express from 'express'
import 'google-application-credentials-base64'
import { BotSecrets } from './BotSecrets'

const bot = require('./bot')
const tracer = start()

const app = express()
const PORT = process.env.PORT || 28364

const storage = new Storage()
const [, bucket, file] = process.env.AUTOMATRON_ENV_GS_URI!.match(
  /^gs:\/\/([^\/]+)\/(.+)$/
)!

function loadEnv(): Promise<BotSecrets> {
  return storage
    .bucket(bucket)
    .file(file)
    .download()
    .then(async ([data]) => {
      const encryptedEnv = JSON.parse(data.toString()) as Record<string, string>
      const env: Record<string, string> = {}
      const d = new age.Decrypter()
      d.addIdentity(process.env.AGE_SECRET_KEY!)
      for (const [key, value] of Object.entries(encryptedEnv)) {
        const ciphertext = age.armor.decode(value)
        env[key] = await d.decrypt(ciphertext, 'text')
      }
      console.log('Decrypted keys:', Object.keys(env))
      return env
    }) as Promise<BotSecrets>
}
let envPromise: Promise<BotSecrets> = loadEnv()
let reloadPromise: Promise<BotSecrets> | null = null
envPromise
  .then(async (env) => {
    console.log('Environment has been loaded')
  })
  .catch((err) => {
    console.error('Unable to load environment', err)
  })
app.post('/run/automatron/reload', async (req, res, next) => {
  try {
    let validationEnv: BotSecrets
    try {
      validationEnv = await envPromise
    } catch (err) {
      console.warn('Existing environment unavailable, attempting reload', err)
      validationEnv = await loadEnv()
    }
    const providedApiKey = req.get('X-API-Key')
    const providedBuffer = providedApiKey
      ? Buffer.from(providedApiKey, 'utf8')
      : undefined
    const expectedBuffer = Buffer.from(validationEnv.API_KEY, 'utf8')
    if (
      !providedBuffer ||
      providedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
    ) {
      res.status(401).send('Invalid API key')
      return
    }
    const startReload = () => {
      const nextEnvPromise = loadEnv()
      return nextEnvPromise
        .then((env) => {
          envPromise = nextEnvPromise
          return env
        })
        .catch((err) => {
          console.error('Unable to reload environment', err)
          throw err
        })
        .finally(() => {
          reloadPromise = null
        })
    }
    if (!reloadPromise) {
      reloadPromise = startReload()
    }
    await reloadPromise
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
app.use('/run/automatron', async (req, res, next) => {
  try {
    req.tracer = tracer
    req.env = (await envPromise) as unknown as BotSecrets
    bot(req, res)
  } catch (err) {
    next(err)
  }
})
app.get('/', (req, res) => {
  res.send('Automatron is running')
})
app.listen(PORT, () => {
  console.log(`Automatron server is running on port ${PORT}`)
})
