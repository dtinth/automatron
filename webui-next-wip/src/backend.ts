import {
  getAuth,
  onAuthStateChanged,
  User,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as signOutFirebase,
} from 'firebase/auth'
import { app } from './firebase'
import { SyncExternalStore } from 'sync-external-store'

const auth = getAuth(app)

class AutomatronBackend {
  authStore = new SyncExternalStore<User | null | undefined>(undefined)

  constructor() {
    onAuthStateChanged(auth, (user) => {
      this.authStore.state = user
    })
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
