import { fromAnyIterable } from '@sec-ant/readable-stream'
import { Hypertext, renderHtmlStream, type Html } from '@thai/html'
import { Elysia } from 'elysia'

async function* toBinary(
  stream: AsyncIterable<string>
): AsyncIterable<Uint8Array> {
  for await (const chunk of stream) {
    yield new TextEncoder().encode(chunk)
  }
}

export function htmlResponse(html: Html) {
  return new Response(fromAnyIterable(toBinary(renderHtmlStream(html))), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}

export const htmlPlugin = new Elysia({ name: 'html' })
  .mapResponse(async ({ response }) => {
    if (response instanceof Hypertext) {
      return htmlResponse(response)
    }
  })
  .as('plugin')
