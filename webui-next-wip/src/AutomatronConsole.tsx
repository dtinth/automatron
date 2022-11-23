import { Icon } from '@iconify-icon/react'
import send from '@iconify-icons/cil/send'
import { useMutation } from '@tanstack/react-query'
import { useRef } from 'react'
import { backend } from './backend'

export interface AutomatronConsole {}

export const AutomatronConsole: FC<AutomatronConsole> = (props) => {
  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      return backend.send(text)
    },
  })
  const textarea = useRef<HTMLTextAreaElement>(null)
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    sendMutation.mutate(textarea.current!.value)
  }

  return (
    <>
      <form className="flex gap-2" onSubmit={handleSubmit}>
        <textarea
          ref={textarea}
          name="text"
          className="bg-emboss hover:border-#555453 block w-full flex-1 rounded border border-#454443 py-1 px-2 font-mono placeholder-#8b8685 shadow-md shadow-black/50 focus:border-#656463 active:border-#8b8685"
          placeholder="Talk to automatron"
          autoFocus
        />
        <button
          className="bg-bevel hover:border-#555453 block rounded border border-#454443 p-2 text-xl text-#8b8685 shadow-md shadow-black/50 active:border-#8b8685"
          type="submit"
          disabled={sendMutation.isLoading}
        >
          <Icon icon={send} />
        </button>
      </form>
      <div className=" mt-2 p-2">
        {!!sendMutation.isLoading && (
          <pre className="whitespace-pre-wrap font-mono text-yellow-400">
            Sending...
          </pre>
        )}
        {!!sendMutation.isError && (
          <pre className="whitespace-pre-wrap font-mono text-red-300">
            {String(sendMutation.error)}
          </pre>
        )}
        {!!sendMutation.data && (
          <pre className="whitespace-pre-wrap font-mono">
            {typeof sendMutation.data === 'string'
              ? sendMutation.data
              : JSON.stringify(sendMutation.data, null, 2)}
          </pre>
        )}
      </div>
    </>
  )
}
