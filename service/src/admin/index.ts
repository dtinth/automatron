import { Elysia } from 'elysia'
import { adminUserPlugin } from './adminUserPlugin.ts'
import { chatRoutes } from './chat.ts'

// Admin routes with authentication
export const admin = new Elysia({ prefix: '/admin' })
  .use(adminUserPlugin)
  .get('/', ({ user }) => {
    return 'meow - ' + user.sub
  })
  .use(chatRoutes)
