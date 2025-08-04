import { messagingApi } from '@line/bot-sdk'
import consola from 'consola'
import { blobService, getMimeTypeFromExtension } from '../blob.ts'
import type { GenericMessage, MessageResponse } from '../brain.ts'

// Convert LINE messages to generic format
export async function handleLINEMessage(
  event: any,
  lineConfig: { channelAccessToken: string }
): Promise<GenericMessage> {
  if (event.message.type === 'text') {
    return {
      type: 'text',
      text: event.message.text,
    }
  } else if (['image', 'audio', 'video', 'file'].includes(event.message.type)) {
    try {
      // Create blob client for LINE content
      const lineBlobClient = new messagingApi.MessagingApiBlobClient(lineConfig)

      // Get content from LINE
      const content = await lineBlobClient.getMessageContent(event.message.id)

      // Determine content type - LINE might not provide content type headers properly
      // for media messages, but we could try to infer from the file extension or message type
      const contentType = determineContentType(event.message)

      // Create a unique blob name
      const blobName = `${event.source.userId}/${Date.now()}-${
        event.message.id
      }.${getFileExtension(event.message)}`

      // Upload to Azure Blob Storage using our service
      const { blobKey, contentLength } = await blobService.uploadStream(
        'ephemeral',
        blobName,
        content,
        contentType
      )

      // After successful upload, return the message with the blob key
      return {
        type: event.message.type as 'audio' | 'video' | 'file',
        blobKey,
        contentType,
        filename:
          event.message.fileName ||
          `${event.message.id}.${getFileExtension(event.message)}`,
        size: contentLength,
      }
    } catch (error) {
      consola.error('Error uploading media to blob storage:', error)
      throw new Error(`Failed to upload media: ${(error as Error).message}`)
    }
  } else {
    // For unsupported message types, return a text message with error
    throw new Error(`Unsupported message type: ${event.message.type}`)
  }
}

// Helper functions for file handling
function determineContentType(message: any): string {
  // Fallback to standard MIME types based on message type
  switch (message.type) {
    case 'image':
      return 'image/jpeg'
    case 'audio':
      return 'audio/mpeg'
    case 'video':
      return 'video/mp4'
    case 'file':
      // Try to determine from file extension
      const extension = getFileExtension(message).toLowerCase()
      return getMimeTypeFromExtension(extension) || 'application/octet-stream'
    default:
      return 'application/octet-stream'
  }
}

function getFileExtension(message: any): string {
  if (message.fileName) {
    const parts = message.fileName.split('.')
    if (parts.length > 1) {
      return parts[parts.length - 1]
    }
  }

  // Default extensions based on type
  switch (message.type) {
    case 'image':
      return 'jpg'
    case 'audio':
      return 'mp3'
    case 'video':
      return 'mp4'
    case 'file':
      return 'bin'
    default:
      return 'bin'
  }
}

// Removed: getMimeTypeFromExtension is now imported from blob.ts

// Send response back to LINE
export async function sendLINEResponse(
  response: MessageResponse,
  replyToken: string,
  lineConfig: { channelAccessToken: string }
): Promise<void> {
  const client = new messagingApi.MessagingApiClient(lineConfig)
  if (response.type === 'text' && response.content) {
    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: response.content,
        },
      ],
    })
  } else if (response.type === 'media' && response.mediaUrl) {
    // Handle media responses if needed
    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: `Media URL: ${response.mediaUrl}`,
        },
      ],
    })
  } else if (response.type === 'none') {
    // No response needed
    await client.replyMessage({
      replyToken,
      messages: [
        {
          type: 'text',
          text: 'Message received, but no response is needed.',
        },
      ],
    })
  }
}
