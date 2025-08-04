// Platform-agnostic message types
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'file'

export interface BaseMessage {
  type: MessageType
}

export interface TextMessage extends BaseMessage {
  type: 'text'
  text: string
}

export interface MediaMessage extends BaseMessage {
  type: 'image' | 'audio' | 'video' | 'file'
  blobKey: string
  contentType?: string
  filename?: string
  size?: number
}

export type GenericMessage = TextMessage | MediaMessage

export interface MessageResponse {
  type: 'text' | 'media' | 'none'
  content?: string
  mediaUrl?: string
}

// Brain interface for pluggable message handlers
export interface MessageHandler {
  canHandle(message: GenericMessage): boolean
  handle(message: GenericMessage): Promise<MessageResponse | null>
}

export class Brain {
  private handlers: MessageHandler[] = []

  registerHandler(handler: MessageHandler): void {
    this.handlers.push(handler)
  }

  // Plugin system - a plugin is just a function that receives the Brain instance
  registerPlugin(plugin: (brain: Brain) => void): void {
    plugin(this)
  }

  async processMessage(
    message: GenericMessage
  ): Promise<MessageResponse | null> {
    for (const handler of this.handlers) {
      if (handler.canHandle(message)) {
        return await handler.handle(message)
      }
    }
    return null
  }
}
