import { Elysia } from 'elysia'
import { remixSession } from '../elysiaPlugins/remixSession.ts'
import { sessionStorage } from '../web.ts'

// Admin routes with authentication
export const admin = new Elysia({ prefix: '/admin' })
  .use(remixSession(sessionStorage))
  .get('/', ({ session }) => {
    if (!session.has('user')) {
      return new Response('Unauthorized', {
        status: 302,
        headers: { location: '/auth/login' },
      })
    }
    const user = session.get('user')!
    console.log(user)
    return 'meow'
  })
