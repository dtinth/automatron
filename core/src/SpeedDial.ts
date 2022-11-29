import { getDb } from './MongoDatabase'
import { AutomatronContext } from './types'

async function getCollection(context: AutomatronContext) {
  const db = await getDb(context)
  return db.collection<{ _id: string; code: string }>('speedDial')
}

export async function saveSpeedDial(
  context: AutomatronContext,
  name: string,
  code: string
) {
  const collection = await getCollection(context)
  await collection.updateOne(
    { _id: name },
    { $set: { code } },
    { upsert: true }
  )
}

export async function getSpeedDialCode(
  context: AutomatronContext,
  name: string
) {
  const collection = await getCollection(context)
  const result = await collection.findOne({ _id: name })
  if (!result) {
    throw new Error(`Speed dial ${name} not found`)
  }
  return result.code
}

export async function getAllSpeedDials(context: AutomatronContext) {
  const collection = await getCollection(context)
  return collection.find({}).sort({ _id: 1 }).toArray()
}
