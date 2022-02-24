import { getDb } from './MongoDatabase'
import { ref } from './PersistentState'
import { TextMessageHandler } from './types'

export const SpendingTrackingMessageHandler: TextMessageHandler = (
  text,
  context
) => {
  if (text === 'pace') {
    return async () => {
      const db = await getDb(context)
      const paceResetTimeRef = ref(context, 'SpendingTracking.paceResetTime')
      const paceResetTime = await paceResetTimeRef.get()
      const allowancePerMillis = 24000 / (32 * 86400e3)
      const elapsed = Date.now() - Date.parse(paceResetTime)
      const txs = await db
        .collection('txs')
        .find({ time: { $gt: paceResetTime } })
        .sort({ _id: 1 })
        .toArray()
      const warnings = []
      let sum = 0
      for (const tx of txs) {
        let currencyMul
        if (tx.currency === 'บาท') {
          currencyMul = 1
        } else {
          warnings.push(`Unknown currency ${tx.currency}`)
          continue
        }
        const typeMul = tx.type === 'refund' ? -1 : 1
        sum += tx.amount * typeMul * currencyMul
      }
      const remaining = Math.round(allowancePerMillis * elapsed - sum)
      // return { sum, warnings }
      return `used ${sum} บาท\nremaining ${remaining} บาท`
    }
  }
  if (text === 'reset pace') {
    return async () => {
      const now = new Date().toISOString()
      await ref(context, 'SpendingTracking.paceResetTime').set(now)
      return `Pace reset to ${now}`
    }
  }
}
