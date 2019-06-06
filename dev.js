require('dotenv').config()

if (!process.env.API_KEY)
  throw new Error('Missing API_KEY environment variable.')
if (!process.env.GOOGLE_CLOUD_PROJECT)
  throw new Error('Missing GOOGLE_CLOUD_PROJECT environment variable.')

const axios = require('axios')
const ora = require('ora')()
const nsfw = require('nsfw')
const bucketName = `${process.env.GOOGLE_CLOUD_PROJECT}.appspot.com`
const endpoint = `https://${
  process.env.GOOGLE_CLOUD_PROJECT
}.appspot.com/automatron`
const { Storage } = require('@google-cloud/storage')
const gcs = new Storage()
let pushing = false
let pending = false

require('yargs')
  .command(
    '$0',
    'Watches for file change and uploads automatron code.',
    {},
    async args => {
      ora.info('Running bundler.')
      const Bundler = require('parcel-bundler')
      const entryFiles = require('path').join(__dirname, 'src/bot.ts')
      const bundler = new Bundler(entryFiles, {
        outDir: '.',
        outFile: 'automatron.js',
        watch: true,
        target: 'node',
        global: 'automatron'
      })
      bundler.bundle()

      ora.info('Watching for file changes.')
      const watcher = await nsfw(__dirname, events => {
        if (events.some(e => e.file === 'automatron.js')) {
          ora.info('Code change detected!')
          push()
        }
      })
      watcher.start()
      await push()
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
  ora.start('Uploading code...')
  try {
    await gcs
      .bucket(bucketName)
      .upload('automatron.js', { destination: 'automatron.js' })
    ora.text = 'Reloading endpoint...'
    await axios.post(`${endpoint}/reload`, { key: process.env.API_KEY })
    ora.succeed('Done! Code updated at ' + new Date().toString())
  } catch (error) {
    ora.fail('Failed: ' + error)
  } finally {
    ora.stop()
    pushing = false
    if (pending) {
      pending = false
      push()
    }
  }
}
