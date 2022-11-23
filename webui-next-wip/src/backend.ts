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

const auth = getAuth(app)
const firestore = getFirestore(app)

class AutomatronBackend {
  authStore = new SyncExternalStore<User | null | undefined>(undefined)
  url?: string

  constructor() {
    onAuthStateChanged(auth, (user) => {
      this.authStore.state = user
      if (user && !this.url) {
        this.getUrl()
      }
    })
  }

  async getUrl() {
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
}

export const backend = new AutomatronBackend()

Object.assign(window, { backend })
