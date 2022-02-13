import { getDb } from './MongoDatabase'
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
  const result = await db
    .collection<StateDocStack>('state')
    .findOneAndUpdate(
      { _id: key },
      { $push: { value } },
      { upsert: true, returnDocument: 'after' }
    )
  return result.value!.value.length
}

async function pop(context: AutomatronContext, key: string): Promise<any> {
  const db = await getDb(context)
  const result = await db
    .collection<StateDocStack>('state')
    .findOneAndUpdate({ _id: key }, { $pop: { value: 1 } })
  return result.value!.value.pop()
}

export function ref(context: AutomatronContext, key: string) {
  return {
    push: push.bind(null, context, key),
    pop: pop.bind(null, context, key),
  }
}
