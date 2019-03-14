'use strict';
const express = require('express')
const app = express()
const dotenv = require('dotenv')
const bucketName = `${process.env.GOOGLE_CLOUD_PROJECT}.appspot.com`
const { Storage } = require('@google-cloud/storage')
const gcs = new Storage()
const startupTime = Date.now()
const { VError } = require('verror')

let _cache

// TODO: Move to actual storage
let _storedData = {}

function cached(key, fn) {
  return function() {
    if (_cache[key]) return _cache[key].value
    _cache[key] = { value: fn.apply(this, arguments) }
    return _cache[key].value
  }
}

const getSecrets = cached('secret', async () => {
  try {
    // via http://gunargessner.com/gcloud-env-vars/
    const [contents] = await gcs.bucket(bucketName).file('secrets.env').download()
    const secrets = dotenv.parse(contents)
    console.log('Secrets loaded with keys', Object.keys(secrets))
    return secrets
  } catch (error) {
    throw new VError(error, 'getSecrets() failed')
  }
})

const getAutomatron = cached('automatron', async () => {
  const [contents] = await gcs.bucket(bucketName).file('automatron.js').download()
  const m = { exports: {} }
  const code = contents.toString()
  new Function('module', 'require', code)(m, require)
  console.log('Code loaded:', contents, 'bytes')
  return m.exports
})

function reload() {
  _cache = {}
  getSecrets()
  getAutomatron()
}

reload()

async function webtaskWrapperMiddleware(req, res, next) {
  try {
    req.webtaskContext = {
      secrets: await getSecrets(),
      storage: {
        get: (cb) => cb(null, _storedData),
        set: (value, cb) => { _storedData = JSON.parse(JSON.stringify(value)); cb() },
      },
      reload
    }
  } catch (error) {
    return next(error)
  }
  next()
}

app.get('/_ah/warmup', async (req, res, next) => {
  try {
    console.log('Warmup starting...')
    await Promise.all([
      getSecrets(),
      getAutomatron()
    ])
    console.log('Warmup finished!')
  } catch (error) {
    return next(error)
  }
  res.send({ ok: true })
})

app.use('/automatron', webtaskWrapperMiddleware, async function(req, res, next) {
  try {
    const automatron = await getAutomatron()
    automatron(req, res)
  } catch (error) {
    next(error)
  }
})

app.get('/', (req, res) => {
  res.status(200).send('Hello, world!')
})

app.get('/info', async (req, res) => {
  res.status(200).json({
    uptime: Date.now() - startupTime,
    bucketName,
    secretKeys: await getSecrets().then(s => Object.keys(s)).catch(e => `Error: ${e}`)
  })
})

if (module === require.main) {
  const server = app.listen(process.env.PORT || 8080, () => {
    const port = server.address().port;
    console.log(`App listening on port ${port}`);
  })
}

module.exports = app;
