import consola from 'consola';
import type { Brain, GenericMessage, MediaMessage, MessageResponse } from '../brain.ts';

/**
 * Media handler plugin - processes image, audio, video and file media
 */
export function mediaHandlerPlugin(brain: Brain): void {
  brain.registerHandler({
    canHandle(message: GenericMessage): boolean {
      return message.type === 'image' || message.type === 'audio' || 
             message.type === 'video' || message.type === 'file';
    },
    
    async handle(message: GenericMessage): Promise<MessageResponse> {
      if (message.type !== 'image' && message.type !== 'audio' && 
          message.type !== 'video' && message.type !== 'file') {
        return { type: 'none' };
      }
  
      try {
        // Media is already uploaded by the adapter, we just need to return info
        const mediaMessage = message as MediaMessage;
        const blobPath = mediaMessage.blobKey;
        
        return { 
          type: 'text', 
          content: `Saved ${message.type} to: ${blobPath}` 
        };
      } catch (error) {
        consola.error('Error handling media message:', error);
        return { 
          type: 'text', 
          content: `Failed to process ${message.type}: ${(error as Error).message}` 
        };
      }
    }
  });
}