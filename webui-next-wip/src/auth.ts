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

export const authStore = new SyncExternalStore<User | null | undefined>(
  undefined
)

onAuthStateChanged(auth, (user) => {
  authStore.state = user
})

export async function signIn() {
  try {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  } catch (error) {
    console.error(error)
    alert(`Unable to sign in: ${error}`)
  }
}

export async function signOut() {
  await signOutFirebase(auth)
}

Object.assign(window, {
  auth: { signIn, signOut },
})
