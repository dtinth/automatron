import { ReactNode, useSyncExternalStore } from 'react'
import { Clock } from '~/Clock'
import { backend } from '~/backend'
import { Icon } from '@iconify-icon/react'
import running from '@iconify-icons/cil/running'
import menu from '@iconify-icons/cil/menu'
import { useNavigate } from '@remix-run/react'

export default function Index() {
  return (
    <>
      <AuthButton />
      <Clock />
    </>
  )
}

function AuthButton() {
  const authState = useSyncExternalStore(
    backend.authStore.subscribe,
    backend.authStore.getSnapshot
  )
  const navigate = useNavigate()

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
            navigate('/automatron')
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

export function FloatingButton(props: FloatingButton) {
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
