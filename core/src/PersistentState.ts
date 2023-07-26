import { getDb } from './MongoDatabase'
import { trace } from './Tracing'
import { AutomatronContext } from './types'

interface StateDoc {
  _id: string
  value: any
}

interface StateDocStack extends StateDoc {
  value: any[]
}

async function push(
  context: AutomatronContext,
  key: string,
  value: any
): Promise<number> {
  const db = await getDb(context)
  const result = await trace(context, `read(${key})`, () =>
    db
      .collection<StateDocStack>('state')
      .findOneAndUpdate(
        { _id: key },
        { $push: { value } },
        { upsert: true, returnDocument: 'after' }
      )
  )
  return result.value!.value.length
}

async function pop(context: AutomatronContext, key: string): Promise<any> {
  const db = await getDb(context)
  const result = await trace(context, `pop(${key})`, () =>
    db
      .collection<StateDocStack>('state')
      .findOneAndUpdate({ _id: key }, { $pop: { value: 1 } })
  )
  return result.value!.value.pop()
}

async function get(context: AutomatronContext, key: string): Promise<any> {
  const db = await getDb(context)
  const result = await trace(context, `get(${key})`, () =>
    db.collection<StateDoc>('state').findOne({ _id: key })
  )
  return result?.value
}

async function set(
  context: AutomatronContext,
  key: string,
  value: any
): Promise<boolean> {
  const db = await getDb(context)
  const result = await trace(context, `set(${key})`, () =>
    db
      .collection<StateDoc>('state')
      .findOneAndUpdate(
        { _id: key },
        { $set: { value } },
        { upsert: true, returnDocument: 'after' }
      )
  )
  return !!result.ok
}

export function ref(context: AutomatronContext, key: string) {
  return {
    push: push.bind(null, context, key),
    pop: pop.bind(null, context, key),
    get: get.bind(null, context, key),
    set: set.bind(null, context, key),
  }
}
