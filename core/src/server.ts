import { Storage } from '@google-cloud/storage'
import { start } from '@google-cloud/trace-agent'
import * as age from 'age-encryption'
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

function loadEnv() {
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
    })
}
let envPromise = loadEnv()
envPromise.then(async (env) => {
  console.log('Environment has been loaded')
})

app.use(async (req, res, next) => {
  try {
    req.tracer = tracer
    req.env = (await envPromise) as unknown as BotSecrets
    bot(req, res)
  } catch (err) {
    next(err)
  }
})
app.listen(PORT, () => {
  console.log(`Automatron server is running on port ${PORT}`)
})
