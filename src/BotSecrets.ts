export interface BotSecrets {
  /** The secret key that must be sent with the request to use the [API](../README.md#cli-api) */
  API_KEY: string
  /** Self-explanatory */
  LINE_CHANNEL_SECRET: string
  /** Self-explanatory */
  LINE_CHANNEL_ACCESS_TOKEN: string
  /** My user ID, so that the bot receives commands from me only */
  LINE_USER_ID: string
  /** The URL to [CloudMQTT](https://www.cloudmqtt.com/) instance used for [home automation](../README.md#home-automation) */
  MQTT_URL: string
  /** Self-explanatory */
  AIRTABLE_API_KEY: string
  /** The ID of the Airtable base used for tracking expenses (should start with ‘app’) */
  AIRTABLE_EXPENSE_BASE: string
  /** The web URL to the Airtable base, used for deep linking */
  AIRTABLE_EXPENSE_URI: string
  /** The ID of the Airtable base used for cron jobs (should start with ‘app’) */
  AIRTABLE_CRON_BASE: string
  /** Two numbers in form of A/B, where A is usage budget per day (rolls over to the next day) and B is starting budget */
  EXPENSE_PACEMAKER: string
  /** The contents of Google Cloud service account JSON file, base64-encoded, for use with Cloud Vision */
  CLOUD_VISION_SERVICE_ACCOUNT: string
  /** Slack webhook URL */
  SLACK_WEBHOOK_URL: string
  /** My user ID, so that the bot receives commands from me only */
  SLACK_USER_ID: string
  /** Google Cloud IoT Core device path to send */
  CLOUD_IOT_CORE_DEVICE_PATH: string
}
