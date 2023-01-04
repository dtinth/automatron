import axios from 'axios'
import { decrypt } from './DataEncryption'
import { logger } from './logger'
import { TextMessageHandler } from './types'

export const LanguageModelAssistantMessageHandler: TextMessageHandler = (
  text,
  context
) => {
  if (text.startsWith('...')) {
    return async () => {
      const key = decrypt(
        context,
        'c0wgjM3RJp/V40lLhcHbtjUDBvlT/NlI.yF9iWwImsHrUOiZkD6UMZdGyjLd3yCJm7WMkN6dxerzXlxCK4U6bSzNFHwyvUjPDop4+gLCs5Qa9Pcxwii3DvSVjjE+7'
      )
      const prompt = text.slice(3)
      const payload = {
        model: 'text-davinci-003',
        prompt:
          // https://beta.openai.com/examples/default-chat
          'The following is a conversation with an AI assistant, automatron. ' +
          'The assistant is helpful, creative, clever, and very friendly.\n\n' +
          'Human: Hello, who are you?\n' +
          "automatron: Hi there! I'm automatron, your friendly AI assistant! Let me know what I can do for you!\n" +
          'Human: ' +
          prompt +
          '\n' +
          'automatron:',
        temperature: 0.9,
        max_tokens: 160,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0.6,
        stop: ['Human:', 'automatron:'],
      }
      const response = await axios.post(
        'https://api.openai.com/v1/completions',
        payload,
        { headers: { Authorization: `Bearer ${key}` } }
      )
      const responseText = response.data.choices[0].text.trim()
      logger.info(
        { assistant: { prompt, response: response.data } },
        'Received an event from Slack'
      )
      return responseText
    }
  }
}
