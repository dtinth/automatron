import { Icon } from '@iconify-icon/react'
import running from '@iconify-icons/cil/running'
import menu from '@iconify-icons/cil/menu'
import x from '@iconify-icons/cil/x'
import { useSyncExternalStore } from 'react'
import { authStore, signIn } from './auth'
import { Clock } from './Clock'
import { hashStore } from './hash'

function App() {
  const authState = useSyncExternalStore(
    authStore.subscribe,
    authStore.getSnapshot
  )
  const hash = useSyncExternalStore(hashStore.subscribe, hashStore.getSnapshot)
  if (hash === '#automatron' && authState) {
    return (
      <>
        <FloatingButton
          onClick={() => {
            location.replace('#')
          }}
        >
          <Icon icon={x} />
        </FloatingButton>
        <div className="flex h-16 items-end px-2">
          <div className="border-x border-t border-#454443 bg-#252423 px-2 py-1 text-sm text-#8b8685">
            automatron
          </div>
        </div>
        <div className="-mt-px min-h-screen border-t border-t-#454443 bg-#252423 px-4 py-4">
          <AutomatronConsole />
        </div>
      </>
    )
  }
  return (
    <>
      {authState === undefined ? (
        <></>
      ) : authState === null ? (
        <FloatingButton onClick={signIn}>
          <Icon icon={running} />
        </FloatingButton>
      ) : (
        <FloatingButton
          onClick={() => {
            location.replace('#automatron')
          }}
        >
          <Icon icon={menu} />
        </FloatingButton>
      )}
      <Clock />
    </>
  )
}

export interface FloatingButton {
  children: ReactNode
  onClick?: () => void
}

export const FloatingButton: FC<FloatingButton> = (props) => {
  return (
    <div className="absolute top-2 right-2">
      <button onClick={props.onClick} className="p-2 text-3xl text-#8b8685">
        {props.children}
      </button>
    </div>
  )
}

export interface AutomatronConsole {}

export const AutomatronConsole: FC<AutomatronConsole> = (props) => {
  return (
    <>
      <textarea
        name="text"
        className="bg-emboss hover:border-#555453 block w-full rounded border border-#454443 py-1 px-2 font-mono placeholder-#8b8685 shadow-md shadow-black/50 focus:border-#656463 active:border-#8b8685"
        placeholder="Talk to automatron"
        autoFocus
      />
    </>
  )
}

export default App
