/**
 * Code Breaker minigame exports
 *
 * This module exports everything needed to use the Code Breaker minigame:
 * - CodeBreakerGame: The game logic class
 * - CodeBreakerScene: The PixiJS scene for rendering
 * - Factory functions for creating instances
 * - Registration helper for MinigameRegistry
 */

export {
  CodeBreakerGame,
  createCodeBreakerGame,
  type DigitFeedback,
  type DigitState,
  type CodeBreakerEventType,
} from './CodeBreakerGame';

export { createCodeBreakerScene } from './CodeBreakerScene';

// ============================================================================
// Registration Helper
// ============================================================================

import type { MinigameDefinition, GameInstance } from '../../core/types';
import { createCodeBreakerScene } from './CodeBreakerScene';

/**
 * Minigame definition for Code Breaker.
 * Use this to register Code Breaker with the MinigameRegistry.
 */
export const CODE_BREAKER_DEFINITION: MinigameDefinition = {
  id: 'code-breaker',
  name: 'Code Breaker',
  description: 'Match number sequences to hack into systems. Build combos for bonus points!',
  primaryResource: 'money',
  createScene: (game: GameInstance) => createCodeBreakerScene(game),
};

/**
 * Register Code Breaker minigame with a registry.
 *
 * @param registry - The MinigameRegistry to register with
 */
export function registerCodeBreaker(
  registry: { register: (definition: MinigameDefinition) => void }
): void {
  registry.register(CODE_BREAKER_DEFINITION);
}
