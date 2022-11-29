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

class AutomatronBackend {
  authStore = new SyncExternalStore<User | null | undefined>(undefined)
  private url?: string

  constructor() {
    onAuthStateChanged(auth, (user) => {
      this.authStore.state = user
      if (user && !this.url) {
        this.getUrl()
      }
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
    const url = (await this.getUrl()) + '/webpost-firebase'
    const response = await axios.post(
      url,
      { text, source: 'web' },
      { headers: await this.getHeaders() }
    )
    return response.data
  }

  private async getHeaders() {
    return {
      Authorization: `Bearer ${await this.getIdToken()}`,
    }
  }

  async getHistory(): Promise<any> {
    const url = (await this.getUrl()) + '/history'
    const response = await axios.get(url, { headers: await this.getHeaders() })
    return response.data
  }

  async getSpeedDials(): Promise<any> {
    const url = (await this.getUrl()) + '/speed-dials'
    const response = await axios.get(url, { headers: await this.getHeaders() })
    return response.data
  }

  private async getIdToken() {
    return await auth.currentUser!.getIdToken()
  }
}

class FakeBackend {
  authStore = new SyncExternalStore<{} | null | undefined>(null)

  async signIn() {
    this.authStore.state = {}
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

  async send(text: string): Promise<any> {
    return JSON.parse(text)
  }
}

export const backend =
  new URLSearchParams(location.search).get('backend') === 'fake'
    ? new FakeBackend()
    : new AutomatronBackend()

Object.assign(window, { backend })
