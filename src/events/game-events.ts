/**
 * Game Event Definitions
 *
 * This module defines all game events and their payload types.
 * Events are used for cross-system communication via the EventBus.
 *
 * Based on refinement notes, we keep events minimal:
 * - minigame:started
 * - minigame:completed
 * - upgrade:purchased
 * - save:loaded
 *
 * Additional events can be added as needed, but avoid over-engineering.
 */

import type { ResourceType, Resources } from '../core/types';
import { EventBus, type EventMap } from './EventBus';

// ============================================================================
// Event Name Constants
// ============================================================================

/**
 * All game event names as constants for type safety and autocomplete.
 */
export const GameEvents = {
  // Minigame events
  /** Fired when a minigame session starts */
  MINIGAME_STARTED: 'minigame:started',
  /** Fired when a minigame session completes */
  MINIGAME_COMPLETED: 'minigame:completed',

  // Upgrade events
  /** Fired when an upgrade is purchased */
  UPGRADE_PURCHASED: 'upgrade:purchased',

  // Save events
  /** Fired when a save file is loaded */
  SAVE_LOADED: 'save:loaded',

  // UI events
  /** Fired when upgrade panel is toggled */
  UPGRADE_PANEL_TOGGLED: 'ui:upgrade-panel-toggled',

  // Scene events (optional, for debugging/analytics)
  /** Fired when entering a scene */
  SCENE_ENTERED: 'scene:entered',
  /** Fired when exiting a scene */
  SCENE_EXITED: 'scene:exited',
} as const;

/**
 * Type for event name values.
 */
export type GameEventName = (typeof GameEvents)[keyof typeof GameEvents];

// ============================================================================
// Event Payload Interfaces
// ============================================================================

/**
 * Payload for minigame:started event.
 */
export interface MinigameStartedPayload {
  /** ID of the minigame that started */
  minigameId: string;
  /** Timestamp when the minigame started */
  startTime: number;
}

/**
 * Payload for minigame:completed event.
 */
export interface MinigameCompletedPayload {
  /** ID of the minigame that completed */
  minigameId: string;
  /** Final score achieved */
  score: number;
  /** Maximum combo achieved during the session */
  maxCombo: number;
  /** Duration of the session in milliseconds */
  durationMs: number;
  /** Resource rewards earned (as Decimal strings) */
  rewards: Partial<Resources>;
  /** Whether this score made it into top scores */
  isNewTopScore: boolean;
}

/**
 * Payload for upgrade:purchased event.
 */
export interface UpgradePurchasedPayload {
  /** Category of the upgrade (equipment, apartment, minigame) */
  category: 'equipment' | 'apartment' | 'minigame';
  /** ID of the upgrade purchased */
  upgradeId: string;
  /** New level after purchase (for equipment) or 1 for apartments */
  newLevel: number;
  /** Cost paid for the upgrade (as Decimal string) */
  cost: string;
  /** Which resource was spent */
  resource: ResourceType;
  /** For minigame upgrades, which minigame */
  minigameId?: string;
}

/**
 * Payload for save:loaded event.
 */
export interface SaveLoadedPayload {
  /** Which save slot was loaded (0-indexed) */
  slotIndex: number;
  /** Player name from the loaded save */
  playerName: string;
  /** How long since last play (for offline progress calculation) */
  secondsSinceLastPlay: number;
}

/**
 * Payload for ui:upgrade-panel-toggled event.
 */
export interface UpgradePanelToggledPayload {
  /** Whether the panel is now visible */
  visible: boolean;
}

/**
 * Payload for scene:entered event.
 */
export interface SceneEnteredPayload {
  /** ID of the scene that was entered */
  sceneId: string;
  /** ID of the previous scene, if any */
  previousSceneId?: string;
}

/**
 * Payload for scene:exited event.
 */
export interface SceneExitedPayload {
  /** ID of the scene that was exited */
  sceneId: string;
  /** ID of the scene being transitioned to */
  nextSceneId: string;
}

// ============================================================================
// Event Map Type
// ============================================================================

/**
 * Complete mapping of event names to their payload types.
 * Use this with EventBus for full type safety.
 *
 * @example
 * ```typescript
 * const eventBus = new EventBus<GameEventMap>();
 *
 * // TypeScript knows the payload type
 * eventBus.on(GameEvents.MINIGAME_COMPLETED, (payload) => {
 *   console.log(payload.score); // TypeScript knows this is a number
 * });
 * ```
 */
export interface GameEventMap extends EventMap {
  [GameEvents.MINIGAME_STARTED]: MinigameStartedPayload;
  [GameEvents.MINIGAME_COMPLETED]: MinigameCompletedPayload;
  [GameEvents.UPGRADE_PURCHASED]: UpgradePurchasedPayload;
  [GameEvents.SAVE_LOADED]: SaveLoadedPayload;
  [GameEvents.UPGRADE_PANEL_TOGGLED]: UpgradePanelToggledPayload;
  [GameEvents.SCENE_ENTERED]: SceneEnteredPayload;
  [GameEvents.SCENE_EXITED]: SceneExitedPayload;
}

/**
 * Type alias for a game-specific EventBus with full type safety.
 */
export type GameEventBus = EventBus<GameEventMap>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a typed event bus for game events.
 * This is a convenience function that returns an EventBus with the correct type.
 *
 * @returns A new EventBus with GameEventMap typing
 */
export function createGameEventBus(): GameEventBus {
  return new EventBus<GameEventMap>();
}
