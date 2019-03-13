require('dotenv').config()

if (!process.env.API_KEY) throw new Error('Missing API_KEY environment variable.')
if (!process.env.GOOGLE_CLOUD_PROJECT) throw new Error('Missing GOOGLE_CLOUD_PROJECT environment variable.')

const axios = require('axios')
const execa = require('execa')
const nsfw = require('nsfw')
const bucketName = `${process.env.GOOGLE_CLOUD_PROJECT}.appspot.com`
const endpoint = `https://${process.env.GOOGLE_CLOUD_PROJECT}.appspot.com/automatron`
const { Storage } = require('@google-cloud/storage')
const gcs = new Storage()
const { VError } = require('verror')
let pushing = false
let pending = false

require('yargs')
  .command(
    '$0',
    'Watches for file change and uploads automatron code.',
    {},
    async args => {
      console.log('* Obtaining API key...')
      const watcher = await nsfw(__dirname, events => {
        if (events.some(e => e.file === 'automatron.js')) {
          console.log('* Code change detected!')
          push()
        }
      })
      watcher.start()
      push()
    }
  )
  .strict()
  .help()
  .parse()

async function push() {
  if (pushing) {
    pending = true
    return
  }
  pushing = true
  console.log('* Uploading code...')
  try {
    await gcs.bucket(bucketName).upload('automatron.js', { destination: 'automatron.js' })
    console.log('* Uploaded code! Reloading endpoint...')
    await axios.post(`${endpoint}/reload`, { key: process.env.API_KEY })
    console.log('* Done! Code updated at', new Date().toString())
  } catch (error) {
    console.error('* Failed:', error)
  } finally {
    pushing = false
    if (pending) {
      pending = false
      push()
    }
  }
}