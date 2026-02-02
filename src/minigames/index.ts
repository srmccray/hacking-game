/**
 * Minigame System Exports
 *
 * This module exports the minigame infrastructure:
 * - MinigameRegistry: Plugin-like registration system
 * - BaseMinigame: Abstract base class for minigame logic
 * - Code Breaker: First minigame implementation
 *
 * Usage:
 *   import { MinigameRegistry, BaseMinigame, registerCodeBreaker } from './minigames';
 *
 *   const registry = new MinigameRegistry();
 *   registerCodeBreaker(registry);
 *
 *   const codeBreakerDef = registry.get('code-breaker');
 *   const scene = codeBreakerDef?.createScene(game);
 */

// Core infrastructure
export { MinigameRegistry, type MinigameSummary } from './MinigameRegistry';

export {
  BaseMinigame,
  formatTimeMMSS,
  formatCombo,
  type MinigamePhase,
  type MinigameEventType,
  type MinigameEventPayload,
  type MinigameEventListener,
  type ScoreEventPayload,
  type ComboEventPayload,
  type EndEventPayload,
} from './BaseMinigame';

// Code Breaker minigame
export {
  CodeBreakerGame,
  createCodeBreakerGame,
  createCodeBreakerScene,
  CODE_BREAKER_DEFINITION,
  registerCodeBreaker,
  type FailReason,
  type CodeBreakerEventType,
} from './code-breaker';

// Code Runner minigame
export {
  CodeRunnerGame,
  createCodeRunnerGame,
  createCodeRunnerScene,
  CODE_RUNNER_DEFINITION,
  registerCodeRunner,
  type Obstacle,
  type CodeRunnerState,
  type CodeRunnerEventType,
} from './code-runner';

// Botnet Defense minigame
export {
  BotnetDefenseGame,
  createBotnetDefenseScene,
  BOTNET_DEFENSE_DEFINITION,
  registerBotnetDefense,
  type BotnetDefenseState,
  type Enemy,
  type Projectile,
  type XPGem,
} from './botnet-defense';
