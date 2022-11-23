import { SyncExternalStore } from 'sync-external-store'

export const hashStore = new SyncExternalStore(location.hash)

window.addEventListener('hashchange', () => {
  hashStore.state = location.hash
})
