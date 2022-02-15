require('dotenv').config()

if (!process.env.GOOGLE_CLOUD_PROJECT)
  throw new Error('Missing GOOGLE_CLOUD_PROJECT environment variable.')

const fs = require('fs')
const ora = require('ora')()
const FormData = require('form-data')
const axios = require('axios').default
const bucketName = `${process.env.GOOGLE_CLOUD_PROJECT}-evalaas`
const { Storage } = require('@google-cloud/storage')
const gcs = new Storage()
let pushing = false
let pending = false
let latestResult

const { GoogleAuth } = require('google-auth-library')
const auth = new GoogleAuth()

require('yargs')
  .command(
    '$0',
    'Watches for file change and uploads automatron code.',
    {},
    async (args) => {
      ora.info('Running bundler.')
      const ncc = require('@vercel/ncc')(require.resolve('./src/bot.ts'), {
        externals: [
          '@google-cloud/iot',
          '@google-cloud/firestore',
          '@google-cloud/storage',
          '@google-cloud/trace-agent',
          '@google-cloud/vision',
          'mongodb',
        ],
        sourceMap: true,
        sourceMapRegister: false,
        watch: true,
      })
      ncc.handler((result) => {
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
  .command('id-token', 'Prints ID token', {}, async () => {
    const jwt = await getJwt()
    console.log(jwt)
  })
  .command('download-env', 'Downloads environment file', {}, async () => {
    await gcs
      .bucket(bucketName)
      .file('evalaas/automatron.env')
      .download({ destination: 'automatron.env' })
  })
  .command('upload-env', 'Uploads environment file', {}, async () => {
    await gcs
      .bucket(bucketName)
      .file('evalaas/automatron.env')
      .save(fs.readFileSync('automatron.env'))
  })
  .command(
    'set-up-codespaces',
    'Downloads Google Cloud service account file for usage in GitHub Codespaces',
    {},
    async () => {
      const encrypted = require('@dtinth/encrypted')(
        process.env.SERVICE_ACCOUNT_ENCRYPTION_KEY
      )
      const encryptedServiceAccount = require('child_process')
        .execSync('curl $SERVICE_ACCOUNT_URL')
        .toString()
        .trim()
      const decryptedServiceAccount = encrypted(encryptedServiceAccount)

      const serviceAccountPath =
        process.env.HOME + '/.google-cloud-service-account.json'
      fs.writeFileSync(
        serviceAccountPath,
        JSON.stringify(decryptedServiceAccount, null, 2)
      )
      console.log('Written service account file to', serviceAccountPath)
    }
  )
  .strict()
  .help()
  .parse()

async function getJwt() {
  const audience = 'https://github.com/dtinth/automatron'
  const client = await auth.getIdTokenClient(audience)
  const jwt = await client.idTokenProvider.fetchIdToken(audience)
  return jwt
}

async function push() {
  if (pushing) {
    pending = true
    return
  }
  pushing = true
  ora.start('Uploading code...')
  try {
    const jwt = await getJwt()
    const form = new FormData()
    const buffer = fs.readFileSync('automatron.js.gz')
    form.append('file', buffer, 'file')
    await axios.put(
      `${process.env.EVALAAS_URL}/admin/endpoints/automatron`,
      form.getBuffer(),
      {
        headers: Object.assign({}, form.getHeaders(), {
          Authorization: `Bearer ${jwt}`,
        }),
      }
    )
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
