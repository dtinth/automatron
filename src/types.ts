export interface WebtaskContext {
  storage: {
    get(callback: (error?: Error, data?: any) => void): void
    set(state: any, callback: (error?: Error) => void): void
  }
  secrets: BotSecrets
  reload(): void
}

interface BotSecrets {
  LINE_CHANNEL_SECRET: string
  LINE_CHANNEL_ACCESS_TOKEN: string
  API_KEY: string
  AIRTABLE_CRON_BASE: string
  EXPENSE_PACEMAKER: string
  MQTT_URL: string
  AIRTABLE_EXPENSE_BASE: string
  LINE_USER_ID: string
  CLOUD_VISION_SERVICE_ACCOUNT: string
  AIRTABLE_EXPENSE_URI: string
  AIRTABLE_API_KEY: string
}

declare global {
  module Express {
    interface Request {
      webtaskContext: WebtaskContext
    }
  }
}
