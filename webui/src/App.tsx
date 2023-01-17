import { Icon } from '@iconify-icon/react'
import running from '@iconify-icons/cil/running'
import menu from '@iconify-icons/cil/menu'
import x from '@iconify-icons/cil/x'
import { Fragment, useSyncExternalStore } from 'react'
import { backend } from './backend'
import { Clock } from './Clock'
import { hashStore } from './hash'
import { AutomatronConsole } from './AutomatronConsole'
import { AutomatronKnobs } from './AutomatronKnobs'

const viewMap = new Map([
  ['automatron', AutomatronConsole],
  ['knobs', AutomatronKnobs],
])

function App() {
  const authState = useSyncExternalStore(
    backend.authStore.subscribe,
    backend.authStore.getSnapshot
  )
  const hash = useSyncExternalStore(hashStore.subscribe, hashStore.getSnapshot)
  const Component = viewMap.get(hash.slice(1))
  if (Component && authState) {
    return (
      <>
        <FloatingButton
          onClick={() => {
            location.replace('#')
          }}
          title="Close"
        >
          <Icon icon={x} />
        </FloatingButton>
        <div className="flex h-16 items-end px-2">
          {Array.from(viewMap.keys()).map((key) => (
            <Fragment key={key}>
              {hash === `#${key}` ? (
                <div className="border-x border-t border-#454443 bg-#252423 px-2 py-1 text-sm text-#8b8685">
                  {key}
                </div>
              ) : (
                <a
                  href={`#${key}`}
                  className="border-x border-t border-transparent px-2 py-1 text-sm text-#8b8685"
                >
                  {key}
                </a>
              )}
            </Fragment>
          ))}
        </div>
        <div className="-mt-px min-h-screen border-t border-t-#454443 bg-#252423 px-4 py-4">
          <Component />
        </div>
      </>
    )
  }
  return (
    <>
      {authState === undefined ? (
        <></>
      ) : authState === null ? (
        <FloatingButton onClick={() => backend.signIn()} title="Sign In">
          <Icon icon={running} />
        </FloatingButton>
      ) : (
        <FloatingButton
          onClick={() => {
            location.replace('#automatron')
          }}
          title="Automatron"
        >
          <Icon icon={menu} />
        </FloatingButton>
      )}
      <Clock />
    </>
  )
}

export interface FloatingButton {
  title: string
  children: ReactNode
  onClick?: () => void
}

export const FloatingButton: FC<FloatingButton> = (props) => {
  return (
    <div className="absolute top-2 right-2">
      <button
        onClick={props.onClick}
        className="p-2 text-3xl text-#8b8685"
        title={props.title}
      >
        {props.children}
      </button>
    </div>
  )
}

export default App
