import * as iot from '@google-cloud/iot'
import { AutomatronContext } from './types'

const iotClient = new iot.v1.DeviceManagerClient()

export async function sendHomeCommand(
  context: AutomatronContext,
  cmd: string | string[]
): Promise<void> {
  const cmds = Array.isArray(cmd) ? cmd : [cmd]
  const formattedName = context.secrets.CLOUD_IOT_CORE_DEVICE_PATH
  await Promise.all(
    cmds.map(async (command) => {
      const id =
        new Date().toJSON() +
        Math.floor(Math.random() * 10000)
          .toString()
          .padStart(2, '0')
      const commandMessage = JSON.stringify({
        id: id,
        topic: 'home',
        data: command,
      })
      const binaryData = Buffer.from(commandMessage)
      const request = {
        name: formattedName,
        binaryData: binaryData,
      }
      await iotClient.sendCommandToDevice(request)
    })
  )
}
