import mqtt from 'mqtt'
import { AutomatronContext } from './types'

export async function sendHomeCommand(
  context: AutomatronContext,
  cmd: string | string[]
) {
  var client = await getMQTTClient(context)
  if (Array.isArray(cmd)) {
    cmd.forEach(c => client.publish('home', c))
  } else {
    client.publish('home', cmd)
  }
}

async function getMQTTClient(context: AutomatronContext) {
  const unsafeGlobal = global as any
  if (unsafeGlobal.automatronMqttPromise) {
    return unsafeGlobal.automatronMqttPromise
  }
  const promise = new Promise((resolve, reject) => {
    var client = mqtt.connect(context.secrets.MQTT_URL)
    client.on('connect', function() {
      resolve(client)
    })
    client.on('error', function(error) {
      reject(error)
      unsafeGlobal.automatronMqttPromise = null
    })
  })
  unsafeGlobal.automatronMqttPromise = promise
  return promise
}
