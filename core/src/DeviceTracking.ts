import { getDb } from './MongoDatabase'
import { ref } from './PersistentState'
import { AutomatronContext } from './types'
import { logger } from './logger'

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

async function getDeviceStateUpdater(
  context: AutomatronContext,
  deviceId: string
) {
  const collection = await getCollection(context)
  const device = getDeviceRef(context, deviceId)
  const state = (await device.get()) || {}
  const time = new Date().toISOString()
  let changed = false
  return {
    time,
    state,
    update: async (key: string, value: any) => {
      if (JSON.stringify(state[key]) !== JSON.stringify(value)) {
        state[key] = value
        await collection.insertOne({
          time,
          deviceId,
          key,
          value,
        })
        logger.info(
          { deviceId, key, value },
          `Device "${deviceId}" property "${key}" changed to "${value}"`
        )
        changed = true
      }
    },
    updateSilently: async (key: string, value: any) => {
      if (JSON.stringify(state[key]) !== JSON.stringify(value)) {
        state[key] = value
        changed = true
      }
    },
    save: async () => {
      if (changed) {
        await device.set(state)
      }
    },
  }
}

export async function trackDevice(
  context: AutomatronContext,
  deviceId: string,
  properties: Record<string, any>
) {
  const updater = await getDeviceStateUpdater(context, deviceId)
  if (!('ip' in properties)) {
    properties.ip = context.requestInfo.ip
  }
  for (const [key, value] of Object.entries(properties)) {
    await updater.update(key, value)
  }
  await updater.updateSilently('lastSeen', updater.time)
  await updater.save()
  return updater.state
}

function getDeviceRef(context: AutomatronContext, deviceId: string) {
  return ref(context, 'devices.' + deviceId)
}

export async function checkDeviceOnlineStatus(context: AutomatronContext) {
  const deviceIds = await getDeviceIds(context)
  for (const deviceId of deviceIds) {
    const updater = await getDeviceStateUpdater(context, deviceId)
    if (
      updater.state.online &&
      Date.now() - new Date(updater.state.lastSeen).getTime() > 1000 * 60 * 3
    ) {
      await updater.update('online', false)
    }
    await updater.save()
  }
}

async function getDeviceIds(context: AutomatronContext) {
  const value = await ref(context, 'deviceIds').get()
  return (value || '').split(',').filter(Boolean)
}
