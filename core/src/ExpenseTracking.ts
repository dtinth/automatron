import { messagingApi } from '@line/bot-sdk'
import { GristDocAPI } from 'grist-api'
import { ExpenseTrackingGristTables } from './ExpenseTrackingGrist'
import { createBubble } from './LINEMessageUtilities'
import { TypedGristDocAPI } from './TypedGristDocAPI'
import { AutomatronContext } from './types'

type ExpenseRecord = ExpenseTrackingGristTables['Daily_Expenses']

function getGristDoc(context: AutomatronContext) {
  const grist = new GristDocAPI(context.secrets.GRIST_EXPENSE_DOC_ID, {
    server: context.secrets.GRIST_BASE_URL,
    apiKey: context.secrets.GRIST_API_KEY,
  })
  return grist as TypedGristDocAPI<ExpenseTrackingGristTables>
}

export async function recordExpense(
  context: AutomatronContext,
  amount: string,
  category: string,
  remarks = ''
): Promise<messagingApi.FlexMessage> {
  const date = new Date().toJSON().split('T')[0]
  // Airtable
  const doc = getGristDoc(context)
  const [id] = await doc.addRecords('Daily_Expenses', [
    {
      Date: new Date(date + 'T00:00:00Z').getTime() / 1000,
      Category: category,
      Amount: parseInt(amount),
      Note: remarks,
    },
  ])
  const gristUri =
    context.secrets.GRIST_EXPENSE_URI +
    `?openExternalBrowser=1#a1.s12.r${id}.c28`
  const body: messagingApi.FlexBox = {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'text',
        text: '฿' + amount,
        size: 'xxl',
        weight: 'bold',
      },
      {
        type: 'text',
        text: `${category}\nrecorded`,
        wrap: true,
      },
    ],
    action: {
      type: 'uri',
      label: 'Open Grist',
      uri: gristUri,
    },
  }
  const footer = await getExpensesSummaryData(context)
  const bubble = createBubble('expense tracking', body, {
    headerColor: '#ffffbb',
    footer: {
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: footer.map(([label, text]) => ({
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: label,
            color: '#8b8685',
            size: 'xs',
            align: 'end',
          },
          {
            type: 'text',
            text: text,
            color: '#8b8685',
            size: 'sm',
            align: 'end',
          },
        ],
      })),
      action: {
        type: 'uri',
        label: 'Open Grist',
        uri: gristUri,
      },
    },
  })
  return bubble
}
async function getExpensesSummaryData(context: AutomatronContext) {
  const date = new Date().toJSON().split('T')[0]
  const gristToDate = (t: number) =>
    new Date(t * 1000).toISOString().split('T')[0]
  const grist = getGristDoc(context)
  const tableData = await grist.fetchTable('Daily_Expenses')
  const normalRecords = tableData.filter((r) => !r['Occasion'])
  const total = (records: ExpenseRecord[]) =>
    records.map((r) => +r['Amount'] || 0).reduce((a, b) => a + b, 0)
  const firstDate = normalRecords
    .map((r) => gristToDate(r['Date']))
    .reduce((a, b) => (a < b ? a : b), date)
  const todayUsage = total(
    normalRecords.filter((r) => gristToDate(r['Date']) === date)
  )
  const totalUsage = total(normalRecords)
  const dayNumber =
    Math.round((Date.parse(date) - Date.parse(firstDate)) / 86400e3) + 1
  const [pacemakerPerDay, pacemakerBase] =
    context.secrets.EXPENSE_PACEMAKER.split('/')
  const pacemaker = +pacemakerBase + +pacemakerPerDay * dayNumber - totalUsage
  const $ = (v: number) => `฿${v.toFixed(0)}`
  return [
    ['today', $(todayUsage)],
    ['pace', $(pacemaker)],
    ['day', `${dayNumber}`],
  ]
}
