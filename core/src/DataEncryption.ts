import Encrypted from '@dtinth/encrypted'
import { AutomatronContext } from './types'

export function decrypt(
  context: AutomatronContext,
  encryptedPayload: string
): any {
  const encrypted = Encrypted(context.secrets.ENCRYPTION_SECRET)
  return encrypted(encryptedPayload)
}

export function encrypt(context: AutomatronContext, payload: any): string {
  const encrypted = Encrypted(context.secrets.ENCRYPTION_SECRET)
  return encrypted.encrypt(payload)
}
