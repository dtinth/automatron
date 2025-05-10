import { Elysia } from 'elysia'
import { htmlPlugin } from '../elysiaPlugins/html.ts'
import { remixSession } from '../elysiaPlugins/remixSession.ts'
import { sessionStorage } from '../web.ts'

export const adminUserPlugin = new Elysia({ name: 'adminUser' })
  .use(remixSession(sessionStorage))
  .use(htmlPlugin)
  .derive(({ session }) => {
    return { user: session.get('user') }
  })
  .onBeforeHandle(async ({ user }) => {
    if (!user) {
      return new Response('Unauthorized', {
        status: 302,
        headers: { location: '/auth/login' },
      })
    }
  })
  .derive(({ user }) => ({ user: user! }))
  .as('plugin')
