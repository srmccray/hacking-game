/**
 * Code Breaker Minigame Module
 *
 * This module exports all components of the Code Breaker minigame.
 *
 * Usage:
 *   import { CodeBreaker, createCodeBreakerScene } from '@minigames/code-breaker';
 */

// Game logic
export { CodeBreaker, createCodeBreaker, MAX_TOP_SCORES } from './code-breaker';

// Scene
export { createCodeBreakerScene } from './code-breaker-scene';
export type { CodeBreakerSceneOptions } from './code-breaker-scene';
