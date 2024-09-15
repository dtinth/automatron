import { ObjectId } from 'mongodb'
import { getDb } from './MongoDatabase'
import { AutomatronContext } from './types'

interface CronEntry {
  name: string
  scheduledTime: string
  completed: boolean
  notes?: string
}

export async function addCronEntry(
  context: AutomatronContext,
  time: number,
  text: string
) {
  const targetTime = new Date(time)
  targetTime.setUTCSeconds(0)
  targetTime.setUTCMilliseconds(0)

  const collection = await getCronCollection(context)
  await collection.insertOne({
    name: text,
    scheduledTime: targetTime.toISOString(),
    completed: false,
  })

  return {
    localTime: new Date(targetTime.getTime() + 7 * 3600e3)
      .toJSON()
      .replace(/\.000Z/, ''),
  }
}

export async function getCronCollection(context: AutomatronContext) {
  const db = await getDb(context)
  return db.collection<CronEntry>('cronJobs')
}

export async function getPendingCronJobs(context: AutomatronContext) {
  const collection = await getCronCollection(context)
  return collection.find({ completed: false }).toArray()
}

export async function updateCronJob(
  context: AutomatronContext,
  jobId: string,
  update: Partial<CronEntry>
) {
  const collection = await getCronCollection(context)
  await collection.updateOne({ _id: new ObjectId(jobId) }, { $set: update })
}
