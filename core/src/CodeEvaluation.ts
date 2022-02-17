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
    ...['prelude', 'self', 'code', 'context'],
    'with (prelude) { with (self) { return [ eval(code) ] } }'
  )
  const self = await getCodeExecutionContext(context)
  const [value] = runner(require('prelude-ls'), self, code, context)
  const returnedValue = await Promise.resolve(value)
  let result = postProcessResult(returnedValue)
  const extraMessages = [...self.extraMessages]
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
      try {
        var { result, extraMessages } = await evaluateCode(input, context)
        return [{ type: 'text', text: result }, ...extraMessages]
      } catch (error: any) {
        const stack = String(error.stack).replace(
          /\/evalaas\/webpack:\/@dtinth\/automatron-core\//g,
          ''
        )
        return [{ type: 'text', text: `❌ EVALUATION FAILED ❌\n${stack}` }]
      }
    }
  }
}
