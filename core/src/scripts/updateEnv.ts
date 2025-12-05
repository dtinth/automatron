import { Storage } from '@google-cloud/storage'
import { password } from '@inquirer/prompts'
import * as age from 'age-encryption'
import { defineCommand, runMain } from 'citty'

const main = defineCommand({
  meta: {
    name: 'updateEnv',
    description:
      'Encrypt and upload environment variables to Google Cloud Storage',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Name',
      required: true,
    },
  },
  async run({ args }) {
    const name = args.name
    const value = await password({
      message: `Enter value for ${name}:`,
      mask: true,
    })
    const e = new age.Encrypter()
    e.addRecipient(
      'age1234vw9hka4p6eurluezk49kn46ywqpshywy6eypvs0kw0dep6a4sn6gyaz'
    )
    e.addRecipient(
      'age1eeezwmr0u6pnl2rgw56dl3k5pcsmxfmzv42varg2zzm96a7s64as9cffpl'
    )
    const ciphertext = await e.encrypt(value)
    const encoded = age.armor.encode(ciphertext)
    console.log(name)
    console.log(encoded)

    await writeEnv(name, encoded)
  },
})

async function writeEnv(key: string, encodedValue: string) {
  const storage = new Storage()
  const [, bucket, file] = process.env.AUTOMATRON_ENV_GS_URI!.match(
    /^gs:\/\/([^\/]+)\/(.+)$/
  )!
  const [data] = await storage.bucket(bucket).file(file).download()
  const encryptedEnv = JSON.parse(data.toString()) as Record<string, string>
  encryptedEnv[key] = encodedValue
  await storage
    .bucket(bucket)
    .file(file)
    .save(JSON.stringify(encryptedEnv, null, 2))
  console.log(`Updated ${key} in ${process.env.AUTOMATRON_ENV_GS_URI}`)
}

runMain(main)
