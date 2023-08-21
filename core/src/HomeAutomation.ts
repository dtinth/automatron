import Encrypted from '@dtinth/encrypted'
import { AutomatronContext } from './types'
import axios from 'axios'

export async function sendHomeCommand(
  context: AutomatronContext,
  cmd: string | string[]
): Promise<void> {
  const cmds = Array.isArray(cmd) ? cmd : [cmd]
  const encrypted = Encrypted(context.secrets.ENCRYPTION_SECRET)
  const { url, key } = encrypted`mz8Dc0LiBPPI63I5lMJHdC3RC9VF//S2.QYg30oYhuEUS8b1u80vM7sO0cv4OLYNtxy52fTMnf2Vcg8QZHlLeXUV1qPnEjR/5jYTid5hG6of8mHDHjTE1A+luDzplgM4WJQBgDNM2pkRnKnbcmAUw8MXxBb4ZMqrrAyFELigKoELWwbDg51ErhFXrm+n3hzfpbRIcge1BdH6aEPtNipsUcMj7q7BfBqFLZA==`
  await Promise.all(
    cmds.map(async (command) => {
      const id =
        new Date().toJSON() +
        Math.floor(Math.random() * 10000)
          .toString()
          .padStart(2, '0')
      await axios.post(url, { id, topic: 'home', data: command }, {
        headers: {
          'X-Api-Key': key
        }
      })
    })
  )
}
