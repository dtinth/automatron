import type { SessionStorage } from '@remix-run/node'
import { Elysia } from 'elysia'

export function remixSession<Data, FlashData>(
  sessionStorage: SessionStorage<Data, FlashData>
) {
  return new Elysia({ name: 'remixSession' })
    .derive(async ({ request }) => {
      const cookieHeader = request.headers.get('cookie')
      return {
        session: await sessionStorage.getSession(cookieHeader),
      }
    })
    .onAfterHandle(async ({ session, set }) => {
      const cookie = await sessionStorage.commitSession(session)
      if (cookie) {
        set.headers['set-cookie'] ??= []
        if (!Array.isArray(set.headers['set-cookie'])) {
          set.headers['set-cookie'] = [set.headers['set-cookie']]
        }
        set.headers['set-cookie'].push(cookie)
      }
    })
    .as('plugin')
}
