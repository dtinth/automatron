import { getDb } from './MongoDatabase'
import { ref } from './PersistentState'
import { AutomatronContext } from './types'

async function getCollection(context: AutomatronContext) {
  const db = await getDb(context)
  return db.collection<DeviceLogEntry>('deviceLog')
}

interface DeviceLogEntry {
  time: string
  deviceId: string
  key: string
  value: any
}

export async function trackDevice(
  context: AutomatronContext,
  deviceId: string,
  properties: Record<string, any>
) {
  const collection = await getCollection(context)
  const device = ref(context, 'devices.' + deviceId)
  const state = (await device.get()) || {}
  const time = new Date().toISOString()
  let changed = false
  properties.ip = context.requestInfo.ip
  for (const [key, value] of Object.entries(properties)) {
    if (JSON.stringify(state[key]) !== JSON.stringify(value)) {
      state[key] = value
      await collection.insertOne({
        time,
        deviceId,
        key,
        value,
      })
      changed = true
    }
  }
  state.lastSeen = time
  await device.set(state)
  return state
}
