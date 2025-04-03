import { BlobServiceClient, BlockBlobClient } from '@azure/storage-blob'
import { Readable } from 'stream'
import { azureStorageConnectionString } from './storage.ts'

/**
 * Azure Blob Storage service wrapper
 */
export class BlobService {
  private blobServiceClientPromise: Promise<BlobServiceClient>

  constructor() {
    this.blobServiceClientPromise = this.createBlobServiceClient()
  }

  private async createBlobServiceClient(): Promise<BlobServiceClient> {
    return BlobServiceClient.fromConnectionString(azureStorageConnectionString)
  }

  /**
   * Uploads a stream to the specified container and creates a blob with the given name
   */
  async uploadStream(
    containerName: string,
    blobName: string,
    content: Readable,
    contentType: string
  ): Promise<{
    blobKey: string
    contentLength: number
  }> {
    const blobServiceClient = await this.blobServiceClientPromise
    const containerClient = blobServiceClient.getContainerClient(containerName)

    // Ensure container exists
    await containerClient.createIfNotExists()

    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    // Upload using stream
    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
    }

    await blockBlobClient.uploadStream(
      content,
      undefined, // default buffer size
      undefined, // default max concurrency
      uploadOptions
    )

    // Get properties for content length
    const properties = await blockBlobClient.getProperties()

    return {
      blobKey: `${containerName}/${blobName}`,
      contentLength: properties.contentLength || 0,
    }
  }

  /**
   * Gets a BlockBlobClient for the specified container and blob name
   */
  async getBlobClient(
    containerName: string,
    blobName: string
  ): Promise<BlockBlobClient> {
    const blobServiceClient = await this.blobServiceClientPromise
    const containerClient = blobServiceClient.getContainerClient(containerName)
    return containerClient.getBlockBlobClient(blobName)
  }
}

// Export a singleton instance
export const blobService = new BlobService()

/**
 * Utility functions for MIME type handling
 */
export function getMimeTypeFromExtension(extension: string): string | null {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    wav: 'audio/wav',
    txt: 'text/plain',
    zip: 'application/zip',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
  }

  return mimeTypes[extension] || null
}
