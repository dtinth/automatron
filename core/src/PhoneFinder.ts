import { TextMessageHandler } from './types'
import { GoogleAuth } from 'google-auth-library'
import axios from 'axios'
import { decrypt } from './DataEncryption'

const auth = new GoogleAuth()

export const PhoneFinderMessageHandler: TextMessageHandler = (
  text,
  context
) => {
  if (text === 'where is my phone') {
    return async () => {
      const url = decrypt(
        context,
        '09oTErU3ru/YqzCNmUBIH2ftVYz1jSfG.NODxXCib7BiuF0vAtnxpwbsvVQ5fxNVXoYDYGZHmJNxBRLPfAWj9KmAK89cOjCtFw3uxudSjqCV1F79Icmn3/SWwi5Z313xXkKyJFr9YWT/1dq8+EWcZfbPR'
      )
      const client = await auth.getIdTokenClient(url)
      const jwt = await client.idTokenProvider.fetchIdToken(url)
      await axios.post(url, {}, { headers: { Authorization: `Bearer ${jwt}` } })
      return 'calling you now...'
    }
  }
}
