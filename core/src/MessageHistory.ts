import { getDb } from './MongoDatabase'
import { AutomatronContext, TextMessage, TextMessageHandler } from './types'

export interface MessageHistoryEntry {
  time: string
  text: string
  source: string
}

export async function saveMessageHistory(
  context: AutomatronContext,
  text: string,
  source: string
) {
  const db = await getDb(context)
  await db.collection<MessageHistoryEntry>('history').insertOne({
    time: new Date().toISOString(),
    text: text,
    source: source,
  })
}

export async function getMessageHistory(
  context: AutomatronContext,
  options: { limit: number }
) {
  const db = await getDb(context)
  return await db
    .collection<MessageHistoryEntry>('history')
    .find({})
    .sort({ _id: -1 })
    .limit(options.limit)
    .toArray()
}

export const MessageHistoryMessageHandler: TextMessageHandler = (
  text,
  context
) => {
  if (text === 'history') {
    return async () => {
      const history = await getMessageHistory(context, { limit: 5 })
      return [...history]
        .reverse()
        .map((entry): TextMessage => ({ type: 'text', text: entry.text }))
    }
  }
}
