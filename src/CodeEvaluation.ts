import { AutomatronContext } from './types'
import tweetnacl from 'tweetnacl'
import axios from 'axios'

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
    'with (prelude) { with (self) { with (state) { return [ eval(code), state ] } } }'
  )
  // TODO: Load storage to `prevStateSnapshot`
  const prevStateSnapshot = '{}'
  const prevState = JSON.parse(prevStateSnapshot)

  // Prepare "self" context
  const self: any = {}
  self.require = (id: string) => {
    const availableModules = { axios, tweetnacl }
    const module = {}.hasOwnProperty.call(availableModules, id)
    if (!module) {
      throw new Error(
        `Module ${id} not available; available modules: ${Object.keys(
          availableModules
        )}`
      )
    }
    return module
  }

  // Execute user prelude
  const userPreludeResponse = await axios.get(
    'https://api.github.com/repos/dtinth/automatron-prelude/contents/prelude.js',
    {
      auth: {
        username: context.secrets.GITHUB_OAUTH_APP_CREDENTIALS.split(':')[0],
        password: context.secrets.GITHUB_OAUTH_APP_CREDENTIALS.split(':')[1],
      },
    }
  )
  const userPrelude = Buffer.from(
    userPreludeResponse.data.content,
    'base64'
  ).toString()
  new Function('self', userPrelude)(self)

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
