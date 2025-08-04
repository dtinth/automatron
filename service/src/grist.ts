import { GristDocAPI } from 'grist-api'
import { config } from './config.ts'
import { decryptText } from './encryption.ts'

export async function getGrist() {
  return new GristDocAPI((await config.get('GRIST_URL')) as string, {
    apiKey: await decryptText((await config.get('GRIST_API_KEY')) as string),
  })
}
