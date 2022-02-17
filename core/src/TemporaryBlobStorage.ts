import { Storage } from '@google-cloud/storage'
import { nanoid } from 'nanoid'

const storage = new Storage()
let latest: { blobName: string; buffer: Buffer } | undefined

export async function putBlob(buffer: Buffer, extension: string) {
  const blobName = nanoid() + extension
  await storage.bucket('tmpblob').file(blobName).save(buffer)
  latest = { blobName, buffer }
  return blobName
}

export async function getBlob(blobName: string) {
  if (latest && latest.blobName === blobName) {
    return latest.buffer
  }
  const response = await storage.bucket('tmpblob').file(blobName).download()
  return response[0]
}

export async function getBlobUrl(blobName: string) {
  const result = await storage
    .bucket('tmpblob')
    .file(blobName)
    .getSignedUrl({
      action: 'read',
      expires: new Date(Date.now() + 86400e3),
      version: 'v4',
      virtualHostedStyle: true,
    })
  return result[0]
}
