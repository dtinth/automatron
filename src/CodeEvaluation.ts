import { AutomatronContext } from './types'

export async function evaluateCode(input: string, context: AutomatronContext) {
  const code = require('livescript')
    .compile(input, {
      run: true,
      print: true,
      header: false,
    })
    .replace(/^\(function/, '(async function')
  console.log('Code compilation result', code)
  const runner = new Function(
    ...['prelude', 'self', 'code', 'context', 'state'],
    'with (prelude) { with (state) { return [ eval(code), state ] } }'
  )
  // TODO: Load storage to `prevStateSnapshot`
  const prevStateSnapshot = '{}'
  const prevState = JSON.parse(prevStateSnapshot)
  const self = {}
  const [value, nextState] = runner(
    require('prelude-ls'),
    self,
    code,
    context,
    prevState
  )
  let result = require('util').inspect(await Promise.resolve(value))
  const extraMessages = []
  const nextStateSnapshot = JSON.stringify(nextState)
  if (nextStateSnapshot !== prevStateSnapshot) {
    extraMessages.push({
      type: 'text',
      text: 'state = ' + JSON.stringify(nextState, null, 2),
    })
    // TODO: Save `nextStateSnapshot` to storage
  }
  return { result, extraMessages }
}
