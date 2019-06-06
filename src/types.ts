import { BotSecrets } from './BotSecrets'

export interface WebtaskContext {
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
      webtaskContext: WebtaskContext
    }
  }
}
