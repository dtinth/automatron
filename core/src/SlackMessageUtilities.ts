import { KnownBlock, MessageAttachment } from '@slack/types'

export type SlackMessage = SlackMessageWithoutBlocks | SlackMessageWithBlocks
export type SlackMessageWithoutBlocks = {
  text: string
  attachments?: MessageAttachment[]
}
export type SlackMessageWithBlocks = { text?: string; blocks: KnownBlock[] }

export function createErrorMessage(error: Error): SlackMessage {
  const title =
    (error.name || 'Error') + (error.message ? `: ${error.message}` : '')
  return {
    text: title,
    attachments: [
      {
        color: 'danger',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ['```', String(error.stack || error), '```'].join('')
            }
          }
        ]
      }
    ]
  }
}
