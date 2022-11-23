import { Icon } from '@iconify-icon/react'
import send from '@iconify-icons/cil/send'

export interface AutomatronConsole {}

export const AutomatronConsole: FC<AutomatronConsole> = (props) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    alert('TODO')
  }

  return (
    <>
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <textarea
          name="text"
          className="bg-emboss hover:border-#555453 block w-full flex-1 rounded border border-#454443 py-1 px-2 font-mono placeholder-#8b8685 shadow-md shadow-black/50 focus:border-#656463 active:border-#8b8685"
          placeholder="Talk to automatron"
          autoFocus
        />
        <button
          className="bg-bevel hover:border-#555453 block rounded border border-#454443 p-2 text-xl text-#8b8685 shadow-md shadow-black/50 active:border-#8b8685"
          type="submit"
        >
          <Icon icon={send} />
        </button>
      </form>
    </>
  )
}
