import type { VercelRequest, VercelResponse } from '@vercel/node'
import { OAuth2Client } from 'google-auth-library'
import cors from 'cors'
import axios from 'axios'

const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS ?? '').split(',')
const CLIENT_ID =
  '347735770628-l928d9ddaf33p8bvsr90aos4mmmacrgq.apps.googleusercontent.com'
const client = new OAuth2Client(CLIENT_ID)
const enableCors = cors()

const apiKey = process.env.AUTOMATRON_API_KEY
const automatron = axios.create({
  baseURL: process.env.AUTOMATRON_URL,
})

export default async (req: VercelRequest, res: VercelResponse) => {
  await new Promise<void>((resolve, reject) => {
    enableCors(req, res, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })

  try {
    const authorization = req.headers.authorization?.split?.(' ')
    if (authorization?.length !== 2 || authorization?.[0] !== 'Bearer') {
      res.status(400).send('Needs a Bearer token')
      return
    }
    const token = authorization[1]
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    })
    const payload = ticket.getPayload()
    if (
      !payload ||
      !payload.email_verified ||
      !payload.email ||
      !ALLOWED_EMAILS.includes(payload.email)
    ) {
      res.status(401).send('Not allowed')
      return
    }

    if (req.query.action === 'text') {
      const response = await automatron.post('/text', {
        ...req.body,
        key: apiKey,
        source: 'web',
      })
      res.json(response.data)
      return
    }

    res.status(400).send('Unknown action')
  } catch (error) {
    console.error(error)
    res.status(500).send(`Error`)
  }
}

function deduplicate<T>(f: (element: T) => string): (value: T) => boolean {
  const seen: { [key: string]: boolean } = {}
  return (value) => {
    const key = f(value)
    return seen[key] === undefined ? (seen[key] = true) : false
  }
}
