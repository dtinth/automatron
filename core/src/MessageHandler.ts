import { CodeEvaluationMessageHandler } from './CodeEvaluation'
import { addCronEntry } from './Cron'
import { recordExpense } from './ExpenseTracking'
import { sendHomeCommand } from './HomeAutomation'
import { ImageMessageHandler } from './ImageMessageHandler'
import { LanguageModelAssistantMessageHandler } from './LanguageModelAssistant'
import {
  MessageHistoryMessageHandler,
  saveMessageHistory,
} from './MessageHistory'
import { getDb } from './MongoDatabase'
import { ref } from './PersistentState'
import { PhoneFinderMessageHandler } from './PhoneFinder'
import { getCodeExecutionContext } from './PreludeCode'
import { decodeRomanNumerals } from './RomanNumerals'
import { SpendingTrackingMessageHandler } from './SpendingTracking'
import { putBlob } from './TemporaryBlobStorage'
import { trace } from './Tracing'
import { AutomatronContext, AutomatronResponse } from './types'

const messageHandlers = [
  CodeEvaluationMessageHandler,
  ImageMessageHandler,
  MessageHistoryMessageHandler,
  SpendingTrackingMessageHandler,
  PhoneFinderMessageHandler,
  LanguageModelAssistantMessageHandler,
]

export async function handleTextMessage(
  context: AutomatronContext,
  message: string,
  options: { source: string }
): Promise<AutomatronResponse> {
  message = message.trim()
  let match: RegExpMatchArray | null

  context.addPromise(
    'Save text history',
    getDb(context).then((db) =>
      trace(context, 'Save history', () =>
        saveMessageHistory(context, message, options.source)
      )
    )
  )

  if (message === 'ac on' || message === 'sticker:2:27') {
    await sendHomeCommand(context, 'ac on')
    return 'ok, turning air-con on'
  } else if (message === 'ac off' || message === 'sticker:2:29') {
    await sendHomeCommand(context, 'ac off')
    return 'ok, turning air-con off'
  } else if (message === 'power on' || message === 'plugs on') {
    await sendHomeCommand(context, 'plugs on')
    return 'ok, turning smart plugs on'
  } else if (message === 'power off' || message === 'plugs off') {
    await sendHomeCommand(context, 'plugs off')
    return 'ok, turning smart plugs off'
  } else if (
    message === 'home' ||
    message === 'arriving' ||
    message === 'sticker:2:503'
  ) {
    await sendHomeCommand(context, ['plugs on', 'lights normal', 'ac on'])
    return 'preparing home'
  } else if (message === 'leaving' || message === 'sticker:2:502') {
    await sendHomeCommand(context, ['plugs off', 'lights off', 'ac off'])
    return 'bye'
  } else if (message === 'lights' || message === 'sticker:4:275') {
    await sendHomeCommand(context, 'lights normal')
    return 'ok, lights normal'
  } else if (
    message === 'bedtime' ||
    message === 'gn' ||
    message === 'gngn' ||
    message === 'sticker:11539:52114128'
  ) {
    await sendHomeCommand(context, 'lights dimmed')
    await addCronEntry(context, Date.now() + 300e3, 'lights off')
    const prelude = await getCodeExecutionContext(context)
    await prelude.executeHandlers('bedtime')
    return 'ok, good night'
  } else if (message === 'ooo') {
    const prelude = await getCodeExecutionContext(context)
    await prelude.executeHandlers('ooo')
    return 'ok, out of office'
  } else if (message === 'work') {
    const prelude = await getCodeExecutionContext(context)
    await prelude.executeHandlers('work')
    return 'ok, set working status'
  } else if ((match = message.match(/^lights (\w+)$/))) {
    const cmd = match[1]
    await sendHomeCommand(context, 'lights ' + cmd)
    return 'ok, lights ' + cmd
  } else if ((match = message.match(/^in ([\d\.]+)([mh]),?\s+([^]+)$/))) {
    const targetTime =
      Date.now() + +match[1] * (match[2] === 'm' ? 60 : 3600) * 1e3
    const result = await addCronEntry(context, targetTime, match[3])
    return `will run "${match[3]}" at ${result.localTime}`
  } else if ((match = message.match(/^([\d.]+|[ivxlcdm]+)(j?)([tfghmol])$/i))) {
    const m = match
    const enteredAmount = m[1].match(/[ivxlcdm]/)
      ? decodeRomanNumerals(m[1])
      : +m[1]
    const conversionRate = m[2] ? 0.302909 : 1
    const amount = (enteredAmount * conversionRate).toFixed(2)
    const category = (
      {
        t: 'transportation',
        f: 'food',
        g: 'game',
        h: 'health',
        m: 'miscellaneous',
        o: 'occasion',
        l: 'lodging',
      } as {
        [k: string]: string
      }
    )[m[3].toLowerCase()]
    const remarks = m[2] ? `${m[1]} JPY` : ''
    return await recordExpense(context, amount, category, remarks)
  } else if ((match = message.match(/^([ivxlcdm]+)$/i))) {
    return `${match[1]} = ${decodeRomanNumerals(match[1])}`
  }

  // Go through message handlers and see if any of them can handle the message
  for (const handler of messageHandlers) {
    const action = handler(message, context)
    if (action) {
      return action()
    }
  }

  // At this point, the message is not recognized.
  // Just save it to the stack.
  const size = await ref(context, 'stack').push(message)
  return '(unrecognized message, saved to stack (size=' + size + '))'
}

export async function handleImage(
  context: AutomatronContext,
  imageBuffer: Buffer,
  options: { source: string }
) {
  const blobName = await putBlob(imageBuffer, '.jpg')
  return await handleTextMessage(context, 'image:' + blobName, options)
}
