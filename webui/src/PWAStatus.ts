import { readable } from 'svelte/store'
import { registerSW } from 'virtual:pwa-register'

export const pwaStatus = readable<PWAStatus>(
  { text: 'Checking PWA status' },
  (set) => {
    set({ text: navigator.serviceWorker?.controller ? 'PWA' : 'Not PWA' })
    const updateSW = registerSW({
      onNeedRefresh() {
        set({ text: 'Refresh to update', clickAction: () => updateSW() })
      },
      onOfflineReady() {
        set({ text: 'Offline ready' })
      },
    })
  },
)

type PWAStatus = {
  text: string
  clickAction?: () => void
}
