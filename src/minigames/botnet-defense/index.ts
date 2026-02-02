/**
 * Botnet Defense minigame exports
 *
 * This module exports everything needed to use the Botnet Defense minigame:
 * - BotnetDefenseGame: The game logic class
 * - BotnetDefenseScene: The PixiJS scene for rendering
 * - Factory functions for creating instances
 * - Registration helper for MinigameRegistry
 */

export { BotnetDefenseGame } from './BotnetDefenseGame';

export { createBotnetDefenseScene } from './BotnetDefenseScene';

export type {
  BotnetDefenseState,
  Enemy,
  Projectile,
  XPGem,
  PlayerState,
} from './types';

// ============================================================================
// Registration Helper
// ============================================================================

import type { MinigameDefinition, GameInstance } from '../../core/types';
import { createBotnetDefenseScene } from './BotnetDefenseScene';

/**
 * Minigame definition for Botnet Defense.
 * Use this to register Botnet Defense with the MinigameRegistry.
 */
export const BOTNET_DEFENSE_DEFINITION: MinigameDefinition = {
  id: 'botnet-defense',
  name: 'Botnet Defense',
  description: 'Defend your network against waves of malware',
  primaryResource: 'money',
  createScene: (game: GameInstance) => createBotnetDefenseScene(game),
};

/**
 * Register Botnet Defense minigame with a registry.
 *
 * @param registry - The MinigameRegistry to register with
 */
export function registerBotnetDefense(
  registry: { register: (definition: MinigameDefinition) => void }
): void {
  registry.register(BOTNET_DEFENSE_DEFINITION);
}
