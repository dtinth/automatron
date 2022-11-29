import { Icon } from '@iconify-icon/react'
import send from '@iconify-icons/cil/send'
import history from '@iconify-icons/cil/history'
import chevronRight from '@iconify-icons/cil/chevron-right'
import chevronLeft from '@iconify-icons/cil/chevron-left'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { backend } from './backend'
import { z } from 'zod'
import clsx from 'clsx'

export interface AutomatronConsole {}

const classes = {
  button:
    'bg-bevel hover:border-#555453 block rounded border border-#454443 p-2 shadow-md shadow-black/50 active:border-#8b8685 flex flex-col items-center justify-center',
}

export const AutomatronConsole: FC<AutomatronConsole> = (props) => {
  const [speedDialEnabled, setSpeedDialEnabled] = useState(false)
  const [historyEnabled, setHistoryEnabled] = useState(false)
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
          className={clsx(classes.button, 'text-xl text-#8b8685')}
          type="submit"
          disabled={sendMutation.isLoading}
          title="Send"
        >
          <Icon icon={send} />
        </button>
      </form>
      <div className="mt-2 flex gap-2">
        <button
          className={clsx(classes.button, 'text-lg text-#8b8685')}
          onClick={() => setHistoryEnabled((x) => !x)}
        >
          <Icon icon={history} />
        </button>
        <button
          className={clsx(classes.button, 'text-lg text-#8b8685')}
          onClick={() => setSpeedDialEnabled((x) => !x)}
        >
          <Icon icon={speedDialEnabled ? chevronLeft : chevronRight} />
        </button>
        {speedDialEnabled && (
          <SpeedDial
            onRun={(id) => {
              sendMutation.mutate(`;SD '${id}'`)
            }}
          />
        )}
      </div>
      {historyEnabled && (
        <div className="mt-4">
          <Panel title="History">
            <AutomatronHistory />
          </Panel>
        </div>
      )}
      <div className="mt-4">
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
        {!!sendMutation.data && <OutputViewer data={sendMutation.data} />}
      </div>
    </>
  )
}

export interface OutputViewer {
  data: unknown
}

type OkResult = z.infer<typeof OkResult>
const OkResult = z.object({
  ok: z.literal(true),
  result: z.array(
    z
      .object({
        type: z.string(),
      })
      .passthrough()
  ),
})

export const OutputViewer: FC<OutputViewer> = (props) => {
  const { data } = props
  const okResult = OkResult.safeParse(data)
  if (okResult.success) {
    const result = okResult.data.result
    return (
      <div className="flex flex-col gap-2">
        {result.map((item, index) => (
          <ResultItem key={index} item={item as any} />
        ))}
      </div>
    )
  }
  return (
    <pre className="whitespace-pre-wrap font-mono">
      {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
    </pre>
  )
}

type ResultEntry = { type: 'text'; text: string }

export interface ResultItem {
  item: ResultEntry
}

export const ResultItem: FC<ResultItem> = (props) => {
  const { item } = props
  const children = (() => {
    switch (item.type) {
      case 'text':
        return <pre className="whitespace-pre-wrap font-mono">{item.text}</pre>
      default:
        return (
          <pre className="whitespace-pre-wrap font-mono">
            {JSON.stringify(item, null, 2)}
          </pre>
        )
    }
  })()
  return (
    <div className="rounded border border-#454443 bg-#090807 p-2 ">
      {children}
    </div>
  )
}

export interface AutomatronHistory {}

export const AutomatronHistory: FC<AutomatronHistory> = (props) => {
  const query = useQuery({
    queryKey: ['history'],
    queryFn: async () => {
      return backend.getHistory()
    },
    refetchOnMount: true,
  })
  if (query.isLoading) {
    return <div>Loading...</div>
  }
  if (query.isError) {
    return <div>Error: {String(query.error)}</div>
  }
  return (
    <>
      <div className="flex flex-col">
        {query.data.result.history.map(
          (item: { text: string }, index: number) => (
            <div
              key={index}
              className="border-t border-#454443 bg-#090807 p-2 first:border-t-0"
            >
              <pre className="whitespace-pre-wrap font-mono">{item.text}</pre>
            </div>
          )
        )}
      </div>
    </>
  )
}

export interface Panel {
  title: ReactNode
  children: ReactNode
}

export const Panel: FC<Panel> = (props) => {
  return (
    <section className="overflow-hidden rounded border border-#454443 bg-#353433 shadow-md shadow-black/50">
      <h2 className="bg-glossy py-1 px-2 font-bold text-#8b8685">
        <span>{props.title}</span>
      </h2>
      {props.children}
    </section>
  )
}

export interface SpeedDial {
  onRun: (id: string) => void
}

export const SpeedDial: FC<SpeedDial> = (props) => {
  const query = useQuery({
    queryKey: ['speedDials'],
    queryFn: async () => {
      return backend.getSpeedDials()
    },
  })
  if (query.isLoading) {
    return <div className="self-center">Loading...</div>
  }
  if (query.isError) {
    return <div className="self-center">Error: {String(query.error)}</div>
  }
  return (
    <>
      {query.data.result.speedDials.map((item: { _id: string }) => (
        <button
          key={item._id}
          className={clsx(classes.button, 'py-0')}
          onClick={() => props.onRun(item._id)}
        >
          {item._id}
        </button>
      ))}
    </>
  )
}
