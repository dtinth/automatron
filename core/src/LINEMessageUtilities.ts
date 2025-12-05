import { messagingApi } from '@line/bot-sdk'

export function toMessages(data: any): messagingApi.Message[] {
  if (!data) data = '...'
  if (typeof data === 'string') data = [{ type: 'text', text: data }]
  if (!Array.isArray(data)) data = [data]
  return data
}

export function createBubble(
  title: string,
  text: string | messagingApi.FlexBox,
  {
    headerBackground = '#353433',
    headerColor = '#d7fc70',
    textSize = 'xl',
    altText = String(text),
    footer,
  }: {
    headerBackground?: string
    headerColor?: string
    textSize?: messagingApi.FlexText['size']
    altText?: string
    footer?: string | messagingApi.FlexBox
  } = {}
): messagingApi.FlexMessage {
  const data: messagingApi.FlexContainer = {
    type: 'bubble',
    styles: {
      header: { backgroundColor: headerBackground },
    },
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: title, color: headerColor, weight: 'bold' },
      ],
    },
    body:
      typeof text === 'string'
        ? {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: text, wrap: true, size: textSize },
            ],
          }
        : text,
  }
  if (footer) {
    data.styles!.footer = { backgroundColor: '#e9e8e7' }
    data.footer =
      typeof footer === 'string'
        ? {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: footer,
                wrap: true,
                size: 'sm',
                color: '#8b8685',
              },
            ],
          }
        : footer
  }
  return {
    type: 'flex',
    altText: truncate(`[${title}] ${altText}`, 400),
    contents: data,
  }
}

function truncate(text: string, maxLength: number) {
  return text.length + 5 > maxLength
    ? text.substr(0, maxLength - 5) + '…'
    : text
}
