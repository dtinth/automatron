import { FlexMessage, messagingApi, TextMessage } from '@line/bot-sdk'
import { BotSecrets } from './BotSecrets'
import type { PluginTypes } from '@google-cloud/trace-agent'
import { IncomingHttpHeaders } from 'http'

export interface AutomatronContext {
  secrets: BotSecrets
  requestInfo: HttpRequestInfo
  tracer?: PluginTypes.Tracer
  addPromise: (name: string, promise: Promise<any>) => void
}

export interface HttpRequestInfo {
  ip: string
  ips: string[]
  headers: IncomingHttpHeaders
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

export { FlexMessage, TextMessage } from '@line/bot-sdk'

export type AutomatronResponse =
  | string
  | messagingApi.TextMessage
  | messagingApi.TextMessage[]
  | messagingApi.FlexMessage
  | messagingApi.FlexMessage[]

export type TextMessageHandler = (
  text: string,
  context: AutomatronContext
) => (() => Promise<AutomatronResponse>) | undefined
