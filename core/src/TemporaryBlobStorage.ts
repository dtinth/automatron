import { Storage } from '@google-cloud/storage'
import { nanoid } from 'nanoid'

const storage = new Storage()

export async function putBlob(buffer: Buffer, extension: string) {
  const path = nanoid() + extension
  await storage.bucket('tmpblob').file(path).save(buffer)
  return path
}

export async function getBlobUrl(blobPath: string) {
  const result = await storage
    .bucket('tmpblob')
    .file(blobPath)
    .getSignedUrl({
      action: 'read',
      expires: new Date(Date.now() + 86400e3),
      version: 'v4',
      virtualHostedStyle: true,
    })
  return result[0]
}
