import { AutomatronContext } from './types'

export async function trace<T>(
  context: AutomatronContext,
  name: string,
  f: () => Promise<T>
) {
  const tracer = context.tracer
  if (!tracer) {
    return f()
  }
  const span = tracer.createChildSpan({ name })
  try {
    return await f()
  } finally {
    span.endSpan()
  }
}
