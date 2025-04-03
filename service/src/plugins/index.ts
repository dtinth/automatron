import type { Brain } from '../brain.ts';
import { basicCommandPlugin } from './basicCommand.ts';
import { mediaHandlerPlugin } from './mediaHandler.ts';

/**
 * Register all core plugins to the Brain
 */
export function registerCorePlugins(brain: Brain): void {
  brain.registerPlugin(basicCommandPlugin);
  brain.registerPlugin(mediaHandlerPlugin);
}