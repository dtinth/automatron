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

export interface AutomatronKnobs {}

const classes = {
  button:
    'bg-bevel hover:border-#555453 block rounded border border-#454443 p-2 shadow-md shadow-black/50 active:border-#8b8685 flex flex-col items-center justify-center',
}

export const AutomatronKnobs: FC<AutomatronKnobs> = (props) => {
  const query = useQuery({
    queryKey: ['knobs'],
    queryFn: async () => {
      return backend.getKnobs()
    },
  })
  if (query.isLoading) {
    return <div className="self-center">Loading...</div>
  }
  if (query.isError) {
    return <div className="self-center">Error: {String(query.error)}</div>
  }
  const knobs = query.data.result.knobs
  return (
    <div className="flex flex-col gap-4">
      {Object.entries(knobs).map(([name, value]) => {
        return (
          <div>
            <label className="block text-#8b8685">{name}</label>
            <input
              type="text"
              value={value}
              className="bg-emboss hover:border-#555453 block w-full rounded border border-#454443 py-1 px-2 font-mono placeholder-#8b8685 shadow-md shadow-black/50 focus:border-#656463 active:border-#8b8685"
            />
          </div>
        )
      })}
    </div>
  )
}
