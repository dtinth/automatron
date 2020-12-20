import vision from '@google-cloud/vision'
import { AutomatronContext } from './types'
import { recordExpense } from './ExpenseTracking'
import { sendHomeCommand } from './HomeAutomation'
import { addCronEntry } from './Cron'
import { decodeRomanNumerals } from './RomanNumerals'

export async function handleTextMessage(
  context: AutomatronContext,
  message: string
) {
  message = message.trim()
  let match: RegExpMatchArray | null
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
    return 'ok, good night'
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
    const category = ({
      t: 'transportation',
      f: 'food',
      g: 'game',
      h: 'health',
      m: 'miscellaneous',
      o: 'occasion',
      l: 'lodging',
    } as {
      [k: string]: string
    })[m[3].toLowerCase()]
    const remarks = m[2] ? `${m[1]} JPY` : ''
    return await recordExpense(context, amount, category, remarks)
  } else if ((match = message.match(/^([ivxlcdm]+)$/i))) {
    return `${match[1]} = ${decodeRomanNumerals(match[1])}`
  } else if (message.startsWith(';')) {
    const code = require('livescript')
      .compile(message.substr(1), {
        run: true,
        print: true,
        header: false,
      })
      .replace(/^\(function/, '(async function')
    console.log('Code compilation result', code)
    const runner = new Function(
      ...['prelude', 'code', 'context', 'state'],
      'with (prelude) { with (state) { return [ eval(code), state ] } }'
    )
    // TODO: Load storage to `prevStateSnapshot`
    const prevStateSnapshot = '{}'
    const prevState = JSON.parse(prevStateSnapshot)
    const [value, nextState] = runner(
      require('prelude-ls'),
      code,
      context,
      prevState
    )
    let result = require('util').inspect(await Promise.resolve(value))
    const extraMessages = []
    const nextStateSnapshot = JSON.stringify(nextState)
    if (nextStateSnapshot !== prevStateSnapshot) {
      extraMessages.push({
        type: 'text',
        text: 'state = ' + JSON.stringify(nextState, null, 2),
      })
      // TODO: Save `nextStateSnapshot` to storage
    }
    return [
      // createBubble('livescript', result, {
      //   headerBackground: '#37BF00',
      //   headerColor: '#ffffff',
      //   textSize: 'sm'
      // }),
      { type: 'text', text: result },
      ...extraMessages,
    ]
  }
  return 'unrecognized message...'
}
export async function handleImage(
  _context: AutomatronContext,
  imageBuffer: Buffer
) {
  const imageAnnotator = new vision.ImageAnnotatorClient()
  const results = await imageAnnotator.documentTextDetection(imageBuffer)
  const fullTextAnnotation = results[0].fullTextAnnotation
  const blocks: string[] = []
  for (const page of fullTextAnnotation.pages) {
    blocks.push(
      ...page.blocks.map((block) => {
        return block.paragraphs
          .map((p) =>
            p.words.map((w) => w.symbols.map((s) => s.text).join('')).join(' ')
          )
          .join('\n\n')
      })
    )
  }
  const blocksToResponses = (blocks: string[]) => {
    if (blocks.length <= 5) return blocks
    let processedIndex = 0
    const outBlocks = []
    for (let i = 0; i < 5; i++) {
      const targetIndex = Math.ceil(((i + 1) * blocks.length) / 5)
      outBlocks.push(
        blocks
          .slice(processedIndex, targetIndex)
          .map((x) => `・ ${x}`)
          .join('\n')
      )
      processedIndex = targetIndex
    }
    return outBlocks
  }
  const responses = blocksToResponses(blocks)
  return responses.map((r) => ({ type: 'text', text: r }))
}
