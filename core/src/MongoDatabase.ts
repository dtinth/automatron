import { Db, MongoClient } from 'mongodb'
import { AutomatronContext } from './types'

let cachedDb: Db | null = null

export async function getDb(context: AutomatronContext): Promise<Db> {
  if (cachedDb) {
    return cachedDb
  }
  const client = await MongoClient.connect(context.secrets.MONGODB_URL)
  const db = client.db('automatron')
  cachedDb = db
  return db
}
