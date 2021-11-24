import axios from 'axios'
import { Storage } from '@google-cloud/storage'
import { AutomatronContext } from './types'
import tweetnacl from 'tweetnacl'
import jsonwebtoken from 'jsonwebtoken'
import crypto from 'crypto'
import util from 'util'
import Encrypted from '@dtinth/encrypted'
import { logger } from './logger'
import * as mongodb from 'mongodb'
import { getDb } from './MongoDatabase'

const storage = new Storage()
const preludeFile = storage.bucket('dtinth-automatron-data').file('prelude.js')

export async function deployPrelude(context: AutomatronContext) {
  const userPreludeResponse = await axios.get(
    'https://api.github.com/repos/dtinth/automatron-prelude/contents/prelude.js',
    {
      auth: {
        username: context.secrets.GITHUB_OAUTH_APP_CREDENTIALS.split(':')[0],
        password: context.secrets.GITHUB_OAUTH_APP_CREDENTIALS.split(':')[1],
      },
    }
  )
  const buffer = Buffer.from(userPreludeResponse.data.content, 'base64')
  await preludeFile.save(buffer)
}

export async function getPreludeCode() {
  const [buffer] = await preludeFile.download()
  return buffer.toString('utf8')
}

export async function getCodeExecutionContext(
  context: AutomatronContext
): Promise<any> {
  // Prepare "self" context
  const self: any = {}
  self.encrypted = Encrypted(context.secrets.ENCRYPTION_SECRET)
  self.extraMessages = []
  self.getDb = () => getDb(context)
  self.require = (id: string) => {
    const availableModules: { [id: string]: any } = {
      axios,
      tweetnacl,
      jsonwebtoken,
      crypto,
      util,
      mongodb,
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

  // Plugin system
  type Handler = (...args: any[]) => Promise<void>
  const registeredHandlers: Record<string, Set<Handler>> = {}
  self.registerHandler = (event: string, handler: Handler) => {
    if (!registeredHandlers[event]) {
      registeredHandlers[event] = new Set()
    }
    registeredHandlers[event].add(handler)
  }
  self.executeHandlers = async (event: string, ...args: any[]) => {
    await Promise.all(
      [...(registeredHandlers[event] || [])].map(async (handler, i) => {
        try {
          const start = Date.now()
          await handler(...args)
          const elapsed = Date.now() - start
          logger.info(
            `Done executing handler index ${i} for event ${event} in ${elapsed} ms`
          )
        } catch (error) {
          logger.error(
            { err: error },
            `Unable to execute handler index ${i} for event ${event}: ${error}`
          )
        }
      })
    )
  }

  // Execute user prelude
  const userPrelude = await getPreludeCode()
  new Function(...['self', 'code'], 'with (self) { return eval(code) }')(
    self,
    userPrelude
  )

  return self
}
