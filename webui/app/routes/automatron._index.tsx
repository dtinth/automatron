import { Icon } from '@iconify-icon/react'
import chevronLeft from '@iconify-icons/cil/chevron-left'
import chevronRight from '@iconify-icons/cil/chevron-right'
import history from '@iconify-icons/cil/history'
import send from '@iconify-icons/cil/send'
import {
  Await,
  ClientActionFunctionArgs,
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from '@remix-run/react'
import clsx from 'clsx'
import { ReactNode, Suspense, useState } from 'react'
import { z } from 'zod'
import { backend } from '~/backend'
import { requireAuth } from '~/requireAuth'

export const clientLoader = async () => {
  await requireAuth()
  return {
    speedDialsPromise: backend.getSpeedDials(),
    historyPromise: backend.getHistory(),
  }
}

export interface ActionResult {
  result?: unknown
  error?: unknown
}

export const clientAction = async (
  args: ClientActionFunctionArgs
): Promise<ActionResult> => {
  await requireAuth()
  const form = await args.request.formData()
  const text = form.get('text')
  const result = await backend.send(String(text))
  try {
    return { result } as ActionResult
  } catch (error) {
    return { error }
  }
}

const classes = {
  button:
    'bg-bevel hover:border-#555453 block rounded border border-#454443 p-2 shadow-md shadow-black/50 active:border-#8b8685 flex flex-col items-center justify-center',
}

export default function AutomatronConsole() {
  const data = useLoaderData<typeof clientLoader>()
  const [speedDialEnabled, setSpeedDialEnabled] = useState(false)
  const [historyEnabled, setHistoryEnabled] = useState(false)
  const { error, result } = useActionData<typeof clientAction>() ?? {}
  const navigation = useNavigation()
  const isSubmitting = navigation.state === 'submitting'

  return (
    <>
      <Form className="flex gap-2" method="POST">
        <textarea
          name="text"
          className="bg-emboss hover:border-#555453 block w-full flex-1 rounded border border-#454443 py-1 px-2 font-mono placeholder-#8b8685 shadow-md shadow-black/50 focus:border-#656463 active:border-#8b8685"
          placeholder="Talk to automatron"
          autoFocus
        />
        <button
          className={clsx(classes.button, 'text-xl text-#8b8685')}
          type="submit"
          title="Send"
          disabled={isSubmitting}
        >
          <Icon icon={send} />
        </button>
      </Form>
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
          <Suspense fallback={<div className="self-center">Loading...</div>}>
            <Await resolve={data.speedDialsPromise}>
              {(speedDials) => <SpeedDial speedDialData={speedDials} />}
            </Await>
          </Suspense>
        )}
      </div>
      {historyEnabled && (
        <div className="mt-4">
          <Panel title="History">
            <Suspense fallback={<div>Loading...</div>}>
              <Await resolve={data.historyPromise}>
                {(historyData) => (
                  <AutomatronHistory historyData={historyData} />
                )}
              </Await>
            </Suspense>
          </Panel>
        </div>
      )}
      <div className="mt-4">
        {!!isSubmitting && (
          <pre className="whitespace-pre-wrap font-mono text-yellow-400">
            Sending...
          </pre>
        )}
        {!!error && (
          <pre className="whitespace-pre-wrap font-mono text-red-300">
            {String(error)}
          </pre>
        )}
        {!!result && <OutputViewer data={result} />}
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

export function OutputViewer(props: OutputViewer) {
  const { data } = props
  const okResult = OkResult.safeParse(data)
  if (okResult.success) {
    const result = okResult.data.result
    return (
      <div className="flex flex-col gap-2 text-sm">
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

export function ResultItem(props: ResultItem) {
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

export interface AutomatronHistory {
  historyData: any
}
export function AutomatronHistory(props: AutomatronHistory) {
  return (
    <>
      <div className="flex flex-col">
        {props.historyData.result.history.map(
          (item: { text: string }, index: number) => (
            <div
              key={index}
              className="border-t border-#454443 bg-#090807 p-2 first:border-t-0"
            >
              <pre className="whitespace-pre-wrap font-mono text-sm">
                {item.text}
              </pre>
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

export function Panel(props: Panel) {
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
  speedDialData: any
}
export function SpeedDial(props: SpeedDial) {
  return (
    <>
      {props.speedDialData.result.speedDials.map((item: { _id: string }) => (
        <Form method="POST" key={item._id} className="flex m-0">
          <input type="hidden" name="text" value={`;SD '${item._id}'`} />
          <button className={clsx(classes.button, 'py-0')} type="submit">
            {item._id}
          </button>
        </Form>
      ))}
    </>
  )
}
