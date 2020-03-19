import { BotSecrets } from './BotSecrets'

export interface AutomatronContext {
  storage: {
    get(callback: (error?: Error, data?: any) => void): void
    set(state: any, callback: (error?: Error) => void): void
  }
  secrets: BotSecrets
  reload(): void
}

declare global {
  module Express {
    interface Request {
      webtaskContext: AutomatronContext
      env?: BotSecrets
    }
  }
}
