import { messagingApi, QuickReplyItem } from '@line/bot-sdk'
import { AutomatronContext } from './types'
import { recordExpense } from './ExpenseTracking'
import { createBubble } from './LINEMessageUtilities'
import { LINEClient } from './LINEClient'

export async function handleSMS(
  context: AutomatronContext,
  client: LINEClient,
  text: string
) {
  const { parseSMS } = require('transaction-parser-th')
  const result = parseSMS(text)
  if (!result || !result.amount) return { match: false }
  console.log('SMS parsing result', result)
  const title = result.type
  const pay = result.type === 'pay'
  const moneyOut = ['pay', 'transfer', 'withdraw'].includes(result.type)
  const body: messagingApi.FlexBox = {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: '฿' + result.amount,
        size: 'xxl',
        weight: 'bold',
      },
    ],
  }
  const ordering = ['provider', 'from', 'to', 'via', 'date', 'time', 'balance']
  const skip = ['type', 'amount']
  const getOrder = (key: string) => ordering.indexOf(key) + 1 || 999
  for (const key of Object.keys(result)
    .filter((key) => !skip.includes(key))
    .sort((a, b) => getOrder(a) - getOrder(b))) {
    body.contents.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: key,
          align: 'end',
          color: '#888888',
          flex: 2,
        },
        {
          type: 'text',
          text: String(result[key]),
          flex: 5,
        },
      ],
    })
  }
  const quickReply = (suffix: string, label: string): QuickReplyItem => ({
    type: 'action',
    action: {
      type: 'message',
      label: label,
      text: result.amount + suffix,
    },
  })
  const messages: messagingApi.Message[] = [
    {
      ...createBubble(title, body, {
        headerBackground: pay ? '#91918F' : moneyOut ? '#DA9E00' : '#9471FF',
        headerColor: '#FFFFFF',
        altText: require('util').inspect(result),
      }),
      quickReply: {
        items: [
          quickReply('f', 'food'),
          quickReply('h', 'health'),
          quickReply('t', 'transport'),
          quickReply('m', 'misc'),
          quickReply('o', 'occasion'),
        ],
      },
    },
  ]
  if (result.type === 'pay' && result.to === 'LINEPAY*BTS01') {
    messages.push(
      await recordExpense(context, result.amount, 'transportation', 'BTS')
    )
  }
  await client.pushMessage(context.secrets.LINE_USER_ID, messages)
  return { match: true }
}
