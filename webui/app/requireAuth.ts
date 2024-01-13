import { backend } from './backend'
import { redirect } from '@remix-run/react'

export async function requireAuth() {
  await backend.authReadyStatePromise
  if (!backend.authStore.state) {
    throw redirect('/')
  }
}
