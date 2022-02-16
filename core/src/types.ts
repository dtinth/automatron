import { FlexMessage } from '@line/bot-sdk'
import { BotSecrets } from './BotSecrets'
import type { PluginTypes } from '@google-cloud/trace-agent'

export interface AutomatronContext {
  secrets: BotSecrets
  tracer?: PluginTypes.Tracer
  addPromise: (name: string, promise: Promise<any>) => void
}

declare global {
  module Express {
    interface Request {
      env: BotSecrets
      tracer?: PluginTypes.Tracer
    }
    interface Response {
      yields?: Promise<any>[]
    }
  }
  module NodeJS {
    interface Global {
      automatronSlackEventCache?: Set<string>
    }
  }
}

export type AutomatronResponse = string | FlexMessage | FlexMessage[]

export type TextMessageHandler = (
  text: string,
  context: AutomatronContext
) => (() => Promise<AutomatronResponse>) | undefined
