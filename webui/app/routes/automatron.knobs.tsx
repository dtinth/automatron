import { Icon } from '@iconify-icon/react'
import copy from '@iconify-icons/cil/copy'
import { useLoaderData } from '@remix-run/react'
import { backend } from '~/backend'
import { requireAuth } from '~/requireAuth'

export interface AutomatronKnobs {}

export const clientLoader = async () => {
  await requireAuth()
  return {
    knobs: await backend.getKnobs(),
  }
}

export default function AutomatronKnobs() {
  const { knobs } = useLoaderData<typeof clientLoader>()
  return (
    <div className="flex flex-col gap-4">
      {Object.entries(knobs.result.knobs)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, value]) => {
          return (
            <div key={name}>
              <div className="flex gap-3">
                <label className="block text-#8b8685">{name}</label>
                <button
                  className="text-#8b8685"
                  onClick={() => {
                    const code = `;;ref('${name}').set(${JSON.stringify(
                      value
                    )})`
                    navigator.clipboard.writeText(code)
                  }}
                >
                  <Icon icon={copy} />
                </button>
              </div>
              <input
                type="text"
                value={String(value)}
                readOnly
                className="bg-emboss hover:border-#555453 block w-full rounded border border-#454443 py-1 px-2 font-mono placeholder-#8b8685 shadow-md shadow-black/50 focus:border-#656463 active:border-#8b8685"
              />
            </div>
          )
        })}
    </div>
  )
}
