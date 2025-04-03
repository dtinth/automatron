import type { Brain, GenericMessage, MessageResponse } from '../brain.ts';

/**
 * Basic command plugin - handles simple text commands
 */
export function basicCommandPlugin(brain: Brain): void {
  brain.registerHandler({
    canHandle(message: GenericMessage): boolean {
      if (message.type !== 'text') return false;
      const text = message.text.toLowerCase().trim();
      return ['ac on', 'ac off', 'arriving', 'leaving'].includes(text);
    },
    
    async handle(message: GenericMessage): Promise<MessageResponse> {
      if (message.type !== 'text') {
        return { type: 'none' };
      }
  
      const text = message.text.toLowerCase().trim();
      
      switch (text) {
        case 'ac on':
          return { type: 'text', content: 'Turning AC on...' };
        case 'ac off':
          return { type: 'text', content: 'Turning AC off...' };
        case 'arriving':
          return { type: 'text', content: 'Welcome home!' };
        case 'leaving':
          return { type: 'text', content: 'See you later!' };
        default:
          return { type: 'none' };
      }
    }
  });
}