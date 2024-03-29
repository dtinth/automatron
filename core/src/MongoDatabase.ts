import { Db, MongoClient } from 'mongodb'
import { trace } from './Tracing'
import { AutomatronContext } from './types'

export { Db } from 'mongodb'

const globalCacheKey = Symbol.for('automatron/MongoDatabase')
const cache: { dbPromise: Promise<Db> | null } = (() => {
  return ((global as any)[globalCacheKey] = (global as any)[globalCacheKey] || {
    dbPromise: null,
  })
})()

export async function getDb(context: AutomatronContext): Promise<Db> {
  if (cache.dbPromise) {
    return cache.dbPromise
  }
  cache.dbPromise = trace(context, 'getDb', async () => {
    const client = await MongoClient.connect(context.secrets.MONGODB_URL)
    const db = client.db('automatron')
    return db
  })
  cache.dbPromise.catch(() => {
    cache.dbPromise = null
  })
  return cache.dbPromise
}
