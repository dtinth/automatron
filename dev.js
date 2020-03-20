require('dotenv').config()

if (!process.env.GOOGLE_CLOUD_PROJECT)
  throw new Error('Missing GOOGLE_CLOUD_PROJECT environment variable.')

const fs = require('fs')
const ora = require('ora')()
const bucketName = `${process.env.GOOGLE_CLOUD_PROJECT}-evalaas`
const { Storage } = require('@google-cloud/storage')
const gcs = new Storage()
let pushing = false
let pending = false
let latestResult

require('yargs')
  .command(
    '$0',
    'Watches for file change and uploads automatron code.',
    {},
    async args => {
      ora.info('Running bundler.')
      const ncc = require('@zeit/ncc')('./src/bot.ts', {
        externals: ['@google-cloud/vision'],
        sourceMap: true,
        sourceMapRegister: false,
        watch: true
      })
      ncc.handler(result => {
        if (result.err) {
          console.error(result.err)
          return
        }
        let code = result.code
        const expectedFooter = '//# sourceMappingURL=index.js.map'
        const mapBase64 = Buffer.from(result.map).toString('base64')
        const mapComment = `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${mapBase64}`
        if (code.endsWith(expectedFooter)) {
          code = code.slice(0, -expectedFooter.length) + mapComment
        } else {
          code += '\n' + mapComment
        }
        const codeBuffer = Buffer.from(code)
        const gzippedBuffer = require('zlib').gzipSync(codeBuffer)
        console.log(
          'Compiled / Code %skb (%skb gzipped)',
          (codeBuffer.length / 1024).toFixed(1),
          (gzippedBuffer.length / 1024).toFixed(1)
        )
        require('fs').writeFileSync('automatron.js.gz', gzippedBuffer)

        // https://github.com/zeit/ncc/pull/516#issuecomment-601708133
        // require('fs').writeFileSync('webpack.stats.json', result.stats.toJson())
        push()
      })
      ncc.rebuild(() => {
        console.log('Rebuilding...')
      })
      ora.info('Watching for file changes.')
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
      .upload('automatron.js.gz', { destination: 'evalaas/automatron.js.gz' })
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
