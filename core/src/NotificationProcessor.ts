import { getDb } from './MongoDatabase'
import { AutomatronContext } from './types'
import { logger } from './logger'

export interface INotification {
  packageName: string
  text: string
  title: string
  time: string
  postTime: string
  when: string
  key: string
}

export async function handleNotification(
  context: AutomatronContext,
  notification: INotification
) {
  const text = notification.title + ' : ' + notification.text
  const time = notification.when || notification.postTime || notification.time
  const key = notification.key
  const promises: Promise<void>[] = []
  const process = (name: string, promise: Promise<void>) => {
    promises.push(
      promise.catch((err) => {
        logger.error({ err, name }, `Unable to run processor "${name}": ${err}`)
      })
    )
  }

  process('save to DB', saveNotificationToDb(context, notification))

  if (notification.packageName === 'com.kasikorn.retail.mbanking.wap') {
    process('process KBank', handleKbankNotification(context, key, text, time))
  }

  return Promise.all(promises)
}

async function saveNotificationToDb(
  context: AutomatronContext,
  notification: INotification
) {
  const db = await getDb(context)
  await db
    .collection('notis')
    .insertOne({ received: new Date().toISOString(), ...notification })
}

export async function handleKbankNotification(
  context: AutomatronContext,
  key: string,
  text: string,
  time: string = new Date().toISOString()
) {
  let m: RegExpMatchArray | null

  m = text.match(
    /^รายการใช้บัตร : หมายเลขบัตร (\S+) จำนวนเงิน (\S+) (\S+) ที่ ([^]*)$/
  )
  if (m) {
    const db = await getDb(context)
    db.collection('txs').insertOne({
      notificationKey: key,
      time,
      type: 'charge',
      card: m[1],
      amount: parseAmount(m[2]),
      currency: m[3],
      merchant: m[4],
    })
    return
  }

  m = text.match(
    /^รายการยกเลิก : หมายเลขบัตร (\S+) จำนวนเงิน (\S+) (\S+) ที่ ([^]*)$/
  )
  if (m) {
    const db = await getDb(context)
    db.collection('txs').insertOne({
      notificationKey: key,
      time,
      type: 'refund',
      card: m[1],
      amount: parseAmount(m[2]),
      currency: m[3],
      merchant: m[4],
    })
    return
  }
}

function parseAmount(text: string) {
  return +text.replace(/,/g, '')
}
