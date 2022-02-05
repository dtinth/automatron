import { FlexMessage } from '@line/bot-sdk'
import { BotSecrets } from './BotSecrets'

export interface AutomatronContext {
  secrets: BotSecrets
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

export type AutomatronResponse = string | FlexMessage | FlexMessage[]
