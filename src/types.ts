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
      env: BotSecrets
    }
  }
  module NodeJS {
    interface Global {
      automatronSlackEventCache?: Set<string>
    }
  }
}