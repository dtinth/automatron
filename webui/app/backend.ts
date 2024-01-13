import {
  getAuth,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as signOutFirebase,
} from 'firebase/auth'
import { getFirestore, doc, getDoc } from 'firebase/firestore'
import { app } from './firebase'
import { SyncExternalStore } from 'sync-external-store'
import axios from 'axios'

const auth = getAuth(app)
const firestore = getFirestore(app)

class AutomatronBackend implements Backend {
  authReadyStatePromise: Promise<void>
  authStore = new SyncExternalStore<User | null | undefined>(undefined)
  private url?: string

  constructor() {
    this.authReadyStatePromise = new Promise<void>((resolve) => {
      onAuthStateChanged(auth, (user) => {
        this.authStore.state = user
        resolve()
        if (user && !this.url) {
          this.getUrl()
        }
      })
    })
  }

  private async getUrl() {
    if (this.url) {
      return this.url
    }
    const s = await getDoc(
      doc(firestore, 'apps', 'automatron', 'config', 'url')
    )
    this.url = s.data()?.service
    return this.url
  }

  async signIn() {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error(error)
      alert(`Unable to sign in: ${error}`)
    }
  }

  async signOut() {
    await signOutFirebase(auth)
  }

  async send(text: string): Promise<any> {
    const data = await this._post('/webpost-firebase', { text, source: 'web' })
    if (typeof data.result === 'string') {
      data.result = [
        {
          type: 'text',
          text: data.result,
        },
      ]
    }
    return data
  }

  private async getHeaders() {
    return {
      Authorization: `Bearer ${await this.getIdToken()}`,
    }
  }

  async getHistory(): Promise<any> {
    return this._get('/history')
  }

  async getSpeedDials(): Promise<any> {
    return this._get('/speed-dials')
  }

  async getKnobs(): Promise<Ok<{ knobs: Record<string, string> }>> {
    return this._get('/knobs')
  }

  private async getIdToken() {
    return await auth.currentUser!.getIdToken()
  }

  async _get(url: string) {
    const response = await axios.get((await this.getUrl()) + url, {
      headers: await this.getHeaders(),
    })
    return response.data
  }

  async _post(url: string, data: any) {
    const response = await axios.post((await this.getUrl()) + url, data, {
      headers: await this.getHeaders(),
    })
    return response.data
  }
}

class FakeBackend implements Backend {
  authReadyStatePromise: Promise<void> = Promise.resolve()
  authStore = new SyncExternalStore<User | null | undefined>(null)

  async signIn() {
    this.authStore.state = {} as User
  }

  async signOut() {
    this.authStore.state = null
  }

  async getHistory(): Promise<any> {
    return { ok: true, result: { history: [] } }
  }

  async getSpeedDials(): Promise<any> {
    return { ok: true, result: { speedDials: [] } }
  }

  async getKnobs(): Promise<Ok<{ knobs: Record<string, string> }>> {
    return { ok: true, result: { knobs: {} } }
  }

  async send(text: string): Promise<any> {
    return JSON.parse(text)
  }
}

type Ok<X> = { ok: true; result: X }

interface Backend {
  authReadyStatePromise: Promise<void>
  authStore: SyncExternalStore<User | null | undefined>
  signIn(): Promise<void>
  signOut(): Promise<void>
  send(text: string): Promise<any>
  getHistory(): Promise<any>
  getSpeedDials(): Promise<any>
  getKnobs(): Promise<Ok<{ knobs: Record<string, string> }>>
}

export const backend =
  typeof location === 'undefined' ||
  new URLSearchParams(location.search).get('backend') === 'fake'
    ? new FakeBackend()
    : new AutomatronBackend()

if (typeof window !== 'undefined') {
  Object.assign(window, { backend })
}
