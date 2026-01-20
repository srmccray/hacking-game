/**
 * Central Zustand Store for the Hacker Incremental Game
 *
 * This store is the single source of truth for all game state.
 * Decimal values are stored as strings for JSON serialization.
 *
 * Usage:
 *   import { useGameStore } from '@core/game-state';
 *
 *   // In a React component (if used)
 *   const money = useGameStore((state) => state.resources.money);
 *
 *   // Outside React
 *   const state = useGameStore.getState();
 *   useGameStore.getState().addResource('money', '100');
 */

import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import Decimal from 'break_eternity.js';
import {
  type GameStore,
  type GameState,
  type ResourceType,
  type MinigameState,
  DEFAULT_GAME_STATE,
  SAVE_VERSION,
} from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a Decimal string to a Decimal instance.
 */
function toDecimal(value: string): Decimal {
  return new Decimal(value);
}

/**
 * Convert a Decimal instance to a string for storage.
 */
function fromDecimal(value: Decimal): string {
  return value.toString();
}

/**
 * Ensure a minigame exists in state, creating default state if needed.
 */
function ensureMinigame(
  minigames: GameState['minigames'],
  minigameId: string
): MinigameState {
  const existing = minigames[minigameId];
  if (existing) {
    return existing;
  }
  return {
    unlocked: false,
    topScores: [],
    playCount: 0,
    upgrades: {},
  };
}

/**
 * Insert a score into a top scores array, maintaining sorted order (descending)
 * and limiting to the top 5 scores.
 * Exported for testing purposes.
 */
export function insertScore(scores: string[], newScore: string): string[] {
  const newScoreDecimal = toDecimal(newScore);
  const result = [...scores];

  // Find insertion point
  let insertIndex = result.length;
  for (let i = 0; i < result.length; i++) {
    const existingScore = result[i];
    if (existingScore !== undefined && newScoreDecimal.gt(toDecimal(existingScore))) {
      insertIndex = i;
      break;
    }
  }

  // Insert and limit to top 5
  result.splice(insertIndex, 0, newScore);
  return result.slice(0, 5);
}

/**
 * Deep clone the default state to avoid mutations.
 */
function getInitialState(): GameState {
  return JSON.parse(JSON.stringify(DEFAULT_GAME_STATE)) as GameState;
}

// ============================================================================
// Store Creation
// ============================================================================

/**
 * The main game store.
 *
 * Uses subscribeWithSelector middleware to allow efficient subscriptions
 * to specific state slices.
 *
 * Note: This is a vanilla store (no React dependency). Access state via:
 *   - gameStore.getState() - get current state
 *   - gameStore.setState() - update state
 *   - gameStore.subscribe() - subscribe to changes
 */
export const gameStore = createStore<GameStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    ...getInitialState(),

    // ========================================================================
    // Resource Actions
    // ========================================================================

    addResource: (resource: ResourceType, amount: string): void => {
      set((state) => {
        const current = toDecimal(state.resources[resource]);
        const toAdd = toDecimal(amount);
        const newValue = current.add(toAdd);

        return {
          resources: {
            ...state.resources,
            [resource]: fromDecimal(newValue),
          },
        };
      });
    },

    subtractResource: (resource: ResourceType, amount: string): boolean => {
      const state = get();
      const current = toDecimal(state.resources[resource]);
      const toSubtract = toDecimal(amount);

      // Check if we have enough
      if (current.lt(toSubtract)) {
        return false;
      }

      set((s) => {
        const currentVal = toDecimal(s.resources[resource]);
        const newValue = currentVal.sub(toSubtract);

        return {
          resources: {
            ...s.resources,
            [resource]: fromDecimal(newValue.max(0)),
          },
        };
      });

      return true;
    },

    setResource: (resource: ResourceType, amount: string): void => {
      set((state) => ({
        resources: {
          ...state.resources,
          [resource]: amount,
        },
      }));
    },

    // ========================================================================
    // Minigame Actions
    // ========================================================================

    recordScore: (minigameId: string, score: string): void => {
      set((state) => {
        const minigame = ensureMinigame(state.minigames, minigameId);
        const newTopScores = insertScore(minigame.topScores, score);

        return {
          minigames: {
            ...state.minigames,
            [minigameId]: {
              ...minigame,
              topScores: newTopScores,
            },
          },
        };
      });
    },

    incrementPlayCount: (minigameId: string): void => {
      set((state) => {
        const minigame = ensureMinigame(state.minigames, minigameId);

        return {
          minigames: {
            ...state.minigames,
            [minigameId]: {
              ...minigame,
              playCount: minigame.playCount + 1,
            },
          },
        };
      });
    },

    unlockMinigame: (minigameId: string): void => {
      set((state) => {
        const minigame = ensureMinigame(state.minigames, minigameId);

        return {
          minigames: {
            ...state.minigames,
            [minigameId]: {
              ...minigame,
              unlocked: true,
            },
          },
        };
      });
    },

    upgradeMinigame: (minigameId: string, upgradeId: string): void => {
      set((state) => {
        const minigame = ensureMinigame(state.minigames, minigameId);
        const currentLevel = minigame.upgrades[upgradeId] ?? 0;

        return {
          minigames: {
            ...state.minigames,
            [minigameId]: {
              ...minigame,
              upgrades: {
                ...minigame.upgrades,
                [upgradeId]: currentLevel + 1,
              },
            },
          },
        };
      });
    },

    // ========================================================================
    // Equipment/Upgrade Actions
    // ========================================================================

    purchaseEquipmentUpgrade: (upgradeId: string): void => {
      set((state) => {
        const currentLevel = state.upgrades.equipment[upgradeId] ?? 0;

        return {
          upgrades: {
            ...state.upgrades,
            equipment: {
              ...state.upgrades.equipment,
              [upgradeId]: currentLevel + 1,
            },
          },
        };
      });
    },

    purchaseApartmentUpgrade: (upgradeId: string): void => {
      set((state) => ({
        upgrades: {
          ...state.upgrades,
          apartment: {
            ...state.upgrades.apartment,
            [upgradeId]: true,
          },
        },
      }));
    },

    // ========================================================================
    // Stats Actions
    // ========================================================================

    addPlayTime: (ms: number): void => {
      set((state) => ({
        stats: {
          ...state.stats,
          totalPlayTime: state.stats.totalPlayTime + ms,
        },
      }));
    },

    trackResourceEarned: (resource: ResourceType, amount: string): void => {
      set((state) => {
        const current = toDecimal(state.stats.totalResourcesEarned[resource]);
        const toAdd = toDecimal(amount);
        const newValue = current.add(toAdd);

        return {
          stats: {
            ...state.stats,
            totalResourcesEarned: {
              ...state.stats.totalResourcesEarned,
              [resource]: fromDecimal(newValue),
            },
          },
        };
      });
    },

    // ========================================================================
    // Settings Actions
    // ========================================================================

    toggleOfflineProgress: (): void => {
      set((state) => ({
        settings: {
          ...state.settings,
          offlineProgressEnabled: !state.settings.offlineProgressEnabled,
        },
      }));
    },

    // ========================================================================
    // Save/Load Actions
    // ========================================================================

    updateLastSaved: (): void => {
      set({ lastSaved: Date.now() });
    },

    updateLastPlayed: (): void => {
      set({ lastPlayed: Date.now() });
    },

    setPlayerName: (name: string): void => {
      set({ playerName: name });
    },

    resetGame: (): void => {
      set(getInitialState());
    },

    loadState: (state: GameState): void => {
      // Ensure the loaded state has the current version
      set({
        ...state,
        version: SAVE_VERSION,
      });
    },
  }))
);

// ============================================================================
// Selectors (for computed values)
// ============================================================================

/**
 * Get the top scores for a minigame as Decimal instances.
 */
export function selectTopScores(
  state: GameState,
  minigameId: string
): Decimal[] {
  const minigame = state.minigames[minigameId];
  if (!minigame) {
    return [];
  }
  return minigame.topScores.map(toDecimal);
}

/**
 * Get a resource as a Decimal instance.
 */
export function selectResource(
  state: GameState,
  resource: ResourceType
): Decimal {
  return toDecimal(state.resources[resource]);
}

/**
 * Check if a minigame is unlocked.
 */
export function selectMinigameUnlocked(
  state: GameState,
  minigameId: string
): boolean {
  const minigame = state.minigames[minigameId];
  return minigame?.unlocked ?? false;
}

/**
 * Get the level of an equipment upgrade.
 */
export function selectEquipmentLevel(
  state: GameState,
  upgradeId: string
): number {
  return state.upgrades.equipment[upgradeId] ?? 0;
}

/**
 * Get the level of a minigame upgrade.
 */
export function selectMinigameUpgradeLevel(
  state: GameState,
  minigameId: string,
  upgradeId: string
): number {
  const minigame = state.minigames[minigameId];
  return minigame?.upgrades[upgradeId] ?? 0;
}

/**
 * Check if an apartment upgrade is purchased.
 */
export function selectApartmentUnlocked(
  state: GameState,
  upgradeId: string
): boolean {
  return state.upgrades.apartment[upgradeId] ?? false;
}

/**
 * Get the total resources earned for a resource type as a Decimal.
 */
export function selectTotalResourceEarned(
  state: GameState,
  resource: ResourceType
): Decimal {
  return toDecimal(state.stats.totalResourcesEarned[resource]);
}

/**
 * Check if the player can afford a cost.
 */
export function selectCanAfford(
  state: GameState,
  resource: ResourceType,
  cost: string
): boolean {
  const current = toDecimal(state.resources[resource]);
  const costDecimal = toDecimal(cost);
  return current.gte(costDecimal);
}

// ============================================================================
// Export types and constants for convenience
// ============================================================================

export { SAVE_VERSION, DEFAULT_GAME_STATE };
export type { GameState, GameStore, ResourceType };

// Compatibility alias - allows existing code using useGameStore to work
// In vanilla Zustand, the store IS the same object that has getState/setState
export const useGameStore = gameStore;
