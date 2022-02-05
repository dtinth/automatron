import { getCodeExecutionContext } from './PreludeCode'
import { AutomatronContext, TextMessageHandler } from './types'

export async function evaluateCode(input: string, context: AutomatronContext) {
  const code = input.startsWith(';')
    ? input
    : require('livescript')
        .compile(input, {
          run: true,
          print: true,
          header: false,
        })
        .replace(/^\(function/, '(async function')
  console.log('Code compilation result', code)
  const runner = new Function(
    ...['prelude', 'self', 'code', 'context', 'state'],
    'with (prelude) { with (self) { with (state) { return [ eval(code), state ] } } }'
  )
  // TODO: Load storage to `prevStateSnapshot`
  const prevStateSnapshot = '{}'
  const prevState = JSON.parse(prevStateSnapshot)

  const self = await getCodeExecutionContext(context)
  const [value, nextState] = runner(
    require('prelude-ls'),
    self,
    code,
    context,
    prevState
  )
  const returnedValue = await Promise.resolve(value)
  let result = postProcessResult(returnedValue)
  const extraMessages = [...self.extraMessages]
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

function postProcessResult(returnedValue: any) {
  if (typeof returnedValue === 'string') {
    return returnedValue
  }
  return require('util').inspect(returnedValue)
}

export const CodeEvaluationMessageHandler: TextMessageHandler = (
  text,
  context
) => {
  if (text.startsWith(';')) {
    return async () => {
      const input = text.slice(1)
      var { result, extraMessages } = await evaluateCode(input, context)
      return [{ type: 'text', text: result }, ...extraMessages]
    }
  }
}
