import { AutomatronContext } from './types'
import tweetnacl from 'tweetnacl'
import jsonwebtoken from 'jsonwebtoken'
import axios from 'axios'
import Encrypted from '@dtinth/encrypted'

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
  self.encrypted = Encrypted(context.secrets.ENCRYPTION_SECRET)
  self.require = (id: string) => {
    const availableModules: { [id: string]: any } = {
      axios,
      tweetnacl,
      jsonwebtoken,
    }
    const available = {}.hasOwnProperty.call(availableModules, id)
    if (!available) {
      throw new Error(
        `Module ${id} not available; available modules: ${Object.keys(
          availableModules
        )}`
      )
    }
    return availableModules[id]
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
  new Function(...['self', 'code'], 'with (self) { return eval(code) }')(
    self,
    userPrelude
  )

  const [value, nextState] = runner(
    require('prelude-ls'),
    self,
    code,
    context,
    prevState
  )
  const returnedValue = await Promise.resolve(value)
  let result = postProcessResult(returnedValue)
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

function postProcessResult(returnedValue: any) {
  if (typeof returnedValue === 'string') {
    return returnedValue
  }
  return require('util').inspect(returnedValue)
}
