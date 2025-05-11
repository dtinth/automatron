import { Elysia } from 'elysia'
import { html } from '@thai/html'
import { adminUserPlugin } from './adminUserPlugin.ts'
import { chatRoutes } from './chat.ts'
import { layout } from './layout.ts'

// Admin routes with authentication
export const admin = new Elysia({ prefix: '/admin' })
  .use(adminUserPlugin)
  .get('/', ({ user }) => {
    return layout({
      title: 'Admin Dashboard',
      contents: html`
        <div class="p-4">
          <h1 class="mb-4">Admin Dashboard</h1>
          <div class="row">
            <div class="col-md-6 mb-4">
              <div class="card h-100">
                <div class="card-body">
                  <h5 class="card-title">Chat</h5>
                  <p class="card-text">
                    Start a new conversation with the AI assistant.
                  </p>
                  <a href="/admin/chat" class="btn btn-primary">
                    <iconify-icon icon="mdi:chat" inline class="me-1"></iconify-icon>
                    Open Chat
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
    })
  })
  .use(chatRoutes)
