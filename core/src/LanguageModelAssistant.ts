import axios from 'axios'
import { decrypt } from './DataEncryption'
import { logger } from './logger'
import { getDb } from './MongoDatabase'
import { ref } from './PersistentState'
import {
  AutomatronContext,
  AutomatronResponse,
  TextMessageHandler,
} from './types'

type Role = 'system' | 'user' | 'assistant'
interface ChatMessage {
  role: Role
  content: string
}
interface LlmHistoryEntry {
  time: string
  contextMessages?: ChatMessage[]
  inText: string
  outText: string
}

async function getCollection(context: AutomatronContext) {
  const db = await getDb(context)
  return db.collection<LlmHistoryEntry>('llmHistory')
}

export const LanguageModelAssistantMessageHandler: TextMessageHandler = (
  text,
  context
) => {
  const runLlm = async (
    inText: string,
    continueFrom?: LlmHistoryEntry
  ): Promise<AutomatronResponse> => {
    const key = decrypt(
      context,
      'c0wgjM3RJp/V40lLhcHbtjUDBvlT/NlI.yF9iWwImsHrUOiZkD6UMZdGyjLd3yCJm7WMkN6dxerzXlxCK4U6bSzNFHwyvUjPDop4+gLCs5Qa9Pcxwii3DvSVjjE+7'
    )
    const nowIct = new Date(Date.now() + 7 * 3600e3)
    const day = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ][nowIct.getDay()]

    const prompt: string[] = [
      // https://beta.openai.com/examples/default-chat
      'Current date and time: ' +
        nowIct.toISOString().replace('Z', '+07:00') +
        ' (Asia/Bangkok).',
      'Today is ' + day + '.',
      'The following is a conversation with an AI assistant, automatron. ' +
        'The assistant is helpful, creative, clever, funny, and very friendly. ' +
        (await ref(context, 'llmPrompt').get()),
    ]
    const newContext: ChatMessage[] = [
      ...(continueFrom
        ? [
            ...(continueFrom.contextMessages ?? []),
            { role: 'user' as Role, content: continueFrom.inText },
            { role: 'assistant' as Role, content: continueFrom.outText },
          ]
        : []),
    ]
    const messages: ChatMessage[] = [
      { role: 'system', content: prompt.join('\n') },
      ...newContext,
      { role: 'user', content: inText },
    ]
    const payload = {
      model: 'chatgpt-4o-latest',
      messages,
      temperature: +(await ref(context, 'llmTemperature').get()) || 0.5,
    }
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      { headers: { Authorization: `Bearer ${key}` } }
    )
    const responseText = response.data.choices[0].message.content.trim()
    logger.info(
      { assistant: { prompt, response: response.data } },
      'Ran OpenAI assistant'
    )
    const collection = await getCollection(context)
    await collection.insertOne({
      time: new Date().toISOString(),
      contextMessages: newContext,
      inText,
      outText: responseText,
    })
    return [{ type: 'text', text: responseText }]
  }

  if (text.match(/^hey\b/i)) {
    return async () => {
      return runLlm(text)
    }
  }
  if (text.match(/^hmm?\b/i)) {
    return async () => {
      const collection = await getCollection(context)
      const [lastEntry] = await collection
        .find({})
        .sort({ _id: -1 })
        .limit(1)
        .toArray()
      return runLlm(text, lastEntry)
    }
  }
}
