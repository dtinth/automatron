import * as age from 'age-encryption'

export const decrypter = new age.Decrypter()
decrypter.addIdentity(process.env.AGE_SECRET_KEY)

export async function getRecipient() {
  const recipient = await age.identityToRecipient(process.env.AGE_SECRET_KEY)
  return recipient
}

export async function decryptText(text: string): Promise<string> {
  const decrypted = await decrypter.decrypt(age.armor.decode(text), 'text')
  return decrypted
}
