import { Storage } from '@google-cloud/storage'
import { start } from '@google-cloud/trace-agent'
import express from 'express'
import 'google-application-credentials-base64'

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
    .then(([data]) => {
      const env = require('dotenv').parse(data)
      return env
    })
}
let envPromise = loadEnv()
envPromise.then((env) => {
  console.log('Environment has been loaded')
})

app.use(async (req, res, next) => {
  try {
    req.tracer = tracer
    req.env = await envPromise
    bot(req, res)
  } catch (err) {
    next(err)
  }
})
app.listen(PORT, () => {
  console.log(`Automatron server is running on port ${PORT}`)
})
