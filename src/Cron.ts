import Airtable from 'airtable'
import { WebtaskContext } from './types'

export async function addCronEntry(
  context: WebtaskContext,
  time: number,
  text: string
) {
  const targetTime = new Date(time)
  targetTime.setUTCSeconds(0)
  targetTime.setUTCMilliseconds(0)
  await getCronTable(context).create({
    Name: text,
    'Scheduled time': targetTime.toJSON()
  })
  return {
    localTime: new Date(targetTime.getTime() + 7 * 3600e3)
      .toJSON()
      .replace(/\.000Z/, '')
  }
}

export function getCronTable(context: WebtaskContext) {
  return new Airtable({ apiKey: context.secrets.AIRTABLE_API_KEY })
    .base(context.secrets.AIRTABLE_CRON_BASE)
    .table('Cron jobs')
}
