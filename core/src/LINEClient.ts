import { messagingApi } from '@line/bot-sdk'

export class LINEClient {
  private readonly api: messagingApi.MessagingApiClient
  private readonly blobApi: messagingApi.MessagingApiBlobClient
  constructor(config: { channelAccessToken: string }) {
    this.api = new messagingApi.MessagingApiClient({
      channelAccessToken: config.channelAccessToken,
    })
    this.blobApi = new messagingApi.MessagingApiBlobClient({
      channelAccessToken: config.channelAccessToken,
    })
  }
  replyMessage(replyToken: string, messages: messagingApi.Message[]) {
    return this.api.replyMessage({ replyToken, messages })
  }
  pushMessage(to: string, messages: messagingApi.Message[]) {
    return this.api.pushMessage({ to, messages })
  }
  getMessageContent(messageId: string) {
    return this.blobApi.getMessageContent(messageId)
  }
  showLoadingAnimation(chatId: string) {
    return this.api.showLoadingAnimation({ chatId })
  }
}
