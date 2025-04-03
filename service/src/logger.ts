import { consola } from 'consola'
import { Elysia } from 'elysia'

export function createLogger() {
  const map = new WeakMap<Request, { prefix: string; start: number }>()
  return new Elysia()
    .onRequest(({ request }) => {
      const state = {
        prefix: `[${request.method}] ${new URL(request.url).pathname}`,
        start: performance.now(),
      }
      consola.start(state.prefix)
      map.set(request, state)
    })
    .onAfterResponse(({ request, set }) => {
      const state = map.get(request)
      if (!state) return
      const time = `${Math.round(performance.now() - state.start)}ms`
      if (+set.status! >= 400) {
        consola.fail(state.prefix, set.status!, time)
      } else {
        consola.success(state.prefix, set.status!, time)
      }
    })
    .as('plugin')
}
