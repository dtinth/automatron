import { createCookieSessionStorage } from '@remix-run/node'
import * as client from 'openid-client'

export const baseUrl = process.env.BASE_URL || 'http://localhost:29691'
export const signatureValidators = new WeakMap<
  Request,
  () => Promise<boolean>
>()
export const sessionStorage = createCookieSessionStorage<{
  user: client.IDToken
  code_verifier: string
}>({
  cookie: {
    name: 'automatron_session',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    secrets: [process.env.AGE_SECRET_KEY!],
  },
})
