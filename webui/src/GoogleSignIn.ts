import { GoogleSignInController } from '@dtinth/google-sign-in-controller'
import type { UserInfo } from '@dtinth/google-sign-in-controller'

import { readable } from 'svelte/store'

export const signInController = new GoogleSignInController(
  '347735770628-l928d9ddaf33p8bvsr90aos4mmmacrgq.apps.googleusercontent.com',
)

export const currentUserInfo = readable<UserInfo | null>(
  signInController.getUserInfo(),
  (set) => {
    set(signInController.getUserInfo())
    return signInController.onCurrentUserChanged(() => {
      set(signInController.getUserInfo())
    })
  },
)

Object.assign(window, { signInController })
