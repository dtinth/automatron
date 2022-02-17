import axios from 'axios'
import { signInController } from './GoogleSignIn'

let url: string | undefined

async function getUrl(onRequest: () => void) {
  return (
    url ||
    (await (async () => {
      onRequest()
      const idToken = getIdToken()
      const base =
        location.hostname === 'localhost' ? 'https://automatron.dt.in.th' : ''
      const urlResponse = await axios.get(
        base + '/api/automatron?action=endpoint',
        { headers: { Authorization: `Bearer ${idToken}` } },
      )
      url = urlResponse.data.url
      return url
    })())
  )
}

function getIdToken() {
  const userInfo = signInController.getUserInfo()
  if (!userInfo) {
    throw new Error('Not signed in')
  }
  return userInfo.idToken
}

export async function automatronRequest(
  path: string,
  body: any,
  options: { onRequest?: () => void } = {},
) {
  const url = await getUrl(options.onRequest || (() => {}))
  return axios.post(`${url}${path}`, body, {
    headers: { Authorization: `Bearer ${getIdToken()}` },
  })
}
