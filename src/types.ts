import { BotSecrets } from './BotSecrets'

export interface AutomatronContext {
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