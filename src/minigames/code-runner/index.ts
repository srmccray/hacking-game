/**
 * Code Runner minigame exports
 *
 * This module exports everything needed to use the Code Runner minigame:
 * - CodeRunnerGame: The game logic class
 * - CodeRunnerScene: The PixiJS scene for rendering
 * - Factory functions for creating instances
 * - Registration helper for MinigameRegistry
 */

export {
  CodeRunnerGame,
  createCodeRunnerGame,
  type Obstacle,
  type CodeRunnerState,
  type CodeRunnerEventType,
  type DifficultyType,
} from './CodeRunnerGame';

export { createCodeRunnerScene } from './CodeRunnerScene';

// ============================================================================
// Registration Helper
// ============================================================================

import type { MinigameDefinition, GameInstance } from '../../core/types';
import { createCodeRunnerScene } from './CodeRunnerScene';

/**
 * Minigame definition for Code Runner.
 * Use this to register Code Runner with the MinigameRegistry.
 */
export const CODE_RUNNER_DEFINITION: MinigameDefinition = {
  id: 'code-runner',
  name: 'Code Runner',
  description: 'Navigate through lines of code to earn money',
  primaryResource: 'money',
  createScene: (game: GameInstance) => createCodeRunnerScene(game),
};

/**
 * Register Code Runner minigame with a registry.
 *
 * @param registry - The MinigameRegistry to register with
 */
export function registerCodeRunner(
  registry: { register: (definition: MinigameDefinition) => void }
): void {
  registry.register(CODE_RUNNER_DEFINITION);
}
