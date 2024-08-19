import { FlexBox, messagingApi } from '@line/bot-sdk'
import Airtable, { AirtableRecord } from 'airtable'
import { AutomatronContext } from './types'
import { createBubble } from './LINEMessageUtilities'

export async function recordExpense(
  context: AutomatronContext,
  amount: string,
  category: string,
  remarks = ''
) {
  const date = new Date().toJSON().split('T')[0]
  // Airtable
  const table = getExpensesTable(context)
  const record = await table.create(
    {
      Date: date,
      Category: category,
      Amount: amount,
      Remarks: remarks,
    },
    { typecast: true }
  )
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
      label: 'Open Airtable',
      uri: context.secrets.AIRTABLE_EXPENSE_URI + '/' + record.getId(),
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
        label: 'Open Airtable',
        uri: context.secrets.AIRTABLE_EXPENSE_URI,
      },
    },
  })
  return bubble
}
function getExpensesTable(context: AutomatronContext) {
  return new Airtable({ apiKey: context.secrets.AIRTABLE_API_KEY })
    .base(context.secrets.AIRTABLE_EXPENSE_BASE)
    .table('Expense records')
}
async function getExpensesSummaryData(context: AutomatronContext) {
  const date = new Date().toJSON().split('T')[0]
  const tableData = await getExpensesTable(context).select().all()
  const normalRecords = tableData.filter((r) => !r.get('Occasional'))
  const total = (records: AirtableRecord[]) =>
    records.map((r) => +r.get('Amount') || 0).reduce((a, b) => a + b, 0)
  const firstDate = normalRecords
    .map((r) => r.get('Date'))
    .reduce((a, b) => (a < b ? a : b), date)
  const todayUsage = total(normalRecords.filter((r) => r.get('Date') === date))
  const totalUsage = total(normalRecords)
  const dayNumber =
    Math.round((Date.parse(date) - Date.parse(firstDate)) / 86400e3) + 1
  const [pacemakerPerDay, pacemakerBase] =
    context.secrets.EXPENSE_PACEMAKER.split('/')
  const pacemaker = +pacemakerBase + +pacemakerPerDay * dayNumber - totalUsage
  const $ = (v: number) => `฿${v.toFixed(2)}`
  return [
    ['today', $(todayUsage)],
    ['pace', $(pacemaker)],
    ['day', `${dayNumber}`],
  ]
}
