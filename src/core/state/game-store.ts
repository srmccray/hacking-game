/**
 * Zustand Game Store
 *
 * The single source of truth for all game state. Uses zustand/vanilla (no React
 * dependency) with subscribeWithSelector middleware for reactive UI updates.
 *
 * Key patterns:
 * - All Decimal values are stored as strings for JSON serialization
 * - State mutations only through defined actions
 * - subscribeWithSelector enables fine-grained reactivity
 *
 * Usage:
 *   import { createGameStore, type GameStore } from './game-store';
 *
 *   const store = createGameStore();
 *
 *   // Direct state access
 *   const money = store.getState().resources.money;
 *
 *   // Selective subscriptions
 *   const unsubscribe = store.subscribe(
 *     (state) => state.resources.money,
 *     (money) => console.log('Money changed:', money)
 *   );
 *
 *   // State mutations via actions
 *   store.getState().addResource('money', '100');
 */

import { createStore, type StoreApi } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';
import Decimal from 'break_eternity.js';
import {
  type GameState,
  type GameStoreState,
  type ResourceType,
  type MinigameState,
  type AutomationState,
  createInitialGameState,
  createDefaultMinigameState,
  MAX_TOP_SCORES,
} from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Extended subscribe function with selector support from subscribeWithSelector middleware.
 */
type SubscribeWithSelector<T> = {
  (listener: (state: T, prevState: T) => void): () => void;
  <U>(
    selector: (state: T) => U,
    listener: (selectedState: U, previousSelectedState: U) => void,
    options?: {
      equalityFn?: (a: U, b: U) => boolean;
      fireImmediately?: boolean;
    }
  ): () => void;
};

/**
 * The Zustand store type with subscribeWithSelector support.
 * Uses StoreApi with the store state type for proper typing.
 */
export type GameStore = Omit<StoreApi<GameStoreState>, 'subscribe'> & {
  subscribe: SubscribeWithSelector<GameStoreState>;
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a string to a Decimal instance.
 */
function toDecimal(value: string): Decimal {
  return new Decimal(value);
}

/**
 * Convert a Decimal instance to a string for storage.
 */
function toString(value: Decimal): string {
  return value.toString();
}

/**
 * Ensure a minigame state exists, returning the existing or a new default state.
 */
function getMinigameState(
  minigames: GameState['minigames'],
  minigameId: string
): MinigameState {
  const existing = minigames[minigameId];
  if (existing) {
    return existing;
  }
  return createDefaultMinigameState();
}

/**
 * Insert a score into a top scores array, maintaining sorted order (descending)
 * and limiting to MAX_TOP_SCORES.
 *
 * Exported for testing purposes.
 */
export function insertScore(scores: string[], newScore: string): string[] {
  const newScoreDecimal = toDecimal(newScore);
  const result = [...scores];

  // Find insertion point (descending order)
  let insertIndex = result.length;
  for (let i = 0; i < result.length; i++) {
    const existingScore = result[i];
    if (existingScore !== undefined && newScoreDecimal.gt(toDecimal(existingScore))) {
      insertIndex = i;
      break;
    }
  }

  // Insert and limit to MAX_TOP_SCORES
  result.splice(insertIndex, 0, newScore);
  return result.slice(0, MAX_TOP_SCORES);
}

/**
 * Create a fresh copy of the initial game state.
 */
function getInitialState(): GameState {
  return createInitialGameState();
}

// ============================================================================
// Store Factory
// ============================================================================

/**
 * Create a new game store instance.
 *
 * The factory pattern allows for multiple store instances (useful for testing)
 * and encapsulates the store configuration.
 *
 * @param initialState - Optional partial state to merge with defaults
 * @returns A new Zustand store instance with subscribeWithSelector middleware
 */
export function createGameStore(initialState?: Partial<GameState>): GameStore {
  const mergedInitialState: GameState = {
    ...getInitialState(),
    ...initialState,
  };

  return createStore<GameStoreState>()(
    subscribeWithSelector((set, get) => ({
      // Spread initial state
      ...mergedInitialState,

      // ======================================================================
      // Resource Actions
      // ======================================================================

      addResource: (resource: ResourceType, amount: string): void => {
        set((state) => {
          const current = toDecimal(state.resources[resource]);
          const toAdd = toDecimal(amount);
          const newValue = current.add(toAdd);

          return {
            resources: {
              ...state.resources,
              [resource]: toString(newValue),
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
              [resource]: toString(newValue.max(0)),
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

      // ======================================================================
      // Minigame Actions
      // ======================================================================

      recordScore: (minigameId: string, score: string): void => {
        set((state) => {
          const minigame = getMinigameState(state.minigames, minigameId);
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
          const minigame = getMinigameState(state.minigames, minigameId);

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
          const minigame = getMinigameState(state.minigames, minigameId);

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

      ensureMinigameState: (minigameId: string): void => {
        set((state) => {
          if (state.minigames[minigameId]) {
            return state; // Already exists, no change needed
          }

          return {
            minigames: {
              ...state.minigames,
              [minigameId]: createDefaultMinigameState(),
            },
          };
        });
      },

      // ======================================================================
      // Upgrade Actions
      // ======================================================================

      purchaseEquipmentUpgrade: (upgradeId: string): number => {
        const state = get();
        const currentLevel = state.upgrades.equipment[upgradeId] ?? 0;
        const newLevel = currentLevel + 1;

        set((s) => ({
          upgrades: {
            ...s.upgrades,
            equipment: {
              ...s.upgrades.equipment,
              [upgradeId]: newLevel,
            },
          },
        }));

        return newLevel;
      },

      purchaseApartmentUpgrade: (upgradeId: string): boolean => {
        const state = get();

        // Already purchased
        if (state.upgrades.apartment[upgradeId]) {
          return false;
        }

        set((s) => ({
          upgrades: {
            ...s.upgrades,
            apartment: {
              ...s.upgrades.apartment,
              [upgradeId]: true,
            },
          },
        }));

        return true;
      },

      // ======================================================================
      // Stats Actions
      // ======================================================================

      addPlayTime: (ms: number): void => {
        set((state) => ({
          stats: {
            ...state.stats,
            totalPlayTime: state.stats.totalPlayTime + ms,
          },
        }));
      },

      addOfflineTime: (ms: number): void => {
        set((state) => ({
          stats: {
            ...state.stats,
            totalOfflineTime: state.stats.totalOfflineTime + ms,
          },
        }));
      },

      trackResourceEarned: (resource: ResourceType, amount: string): void => {
        set((state) => {
          const current = toDecimal(state.stats.totalResourcesEarned[resource]);
          const toAdd = toDecimal(amount);
          const newTotal = current.add(toAdd);

          return {
            stats: {
              ...state.stats,
              totalResourcesEarned: {
                ...state.stats.totalResourcesEarned,
                [resource]: toString(newTotal),
              },
            },
          };
        });
      },

      // ======================================================================
      // Automation Actions
      // ======================================================================

      enableAutomation: (automationId: string): void => {
        set((state) => ({
          automations: {
            ...state.automations,
            [automationId]: {
              enabled: true,
              lastTriggered: state.automations[automationId]?.lastTriggered ?? Date.now(),
            },
          },
        }));
      },

      disableAutomation: (automationId: string): void => {
        set((state) => {
          const existing = state.automations[automationId];
          if (!existing) {return state;}

          return {
            automations: {
              ...state.automations,
              [automationId]: {
                ...existing,
                enabled: false,
              },
            },
          };
        });
      },

      updateAutomationTrigger: (automationId: string, timestamp?: number): void => {
        set((state) => {
          const existing = state.automations[automationId];
          if (!existing) {return state;}

          return {
            automations: {
              ...state.automations,
              [automationId]: {
                ...existing,
                lastTriggered: timestamp ?? Date.now(),
              },
            },
          };
        });
      },

      getAutomationState: (automationId: string): AutomationState | undefined => {
        return get().automations[automationId];
      },

      // ======================================================================
      // Settings Actions
      // ======================================================================

      toggleOfflineProgress: (): void => {
        set((state) => ({
          settings: {
            ...state.settings,
            offlineProgressEnabled: !state.settings.offlineProgressEnabled,
          },
        }));
      },

      // ======================================================================
      // Save/Load Actions
      // ======================================================================

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
        // Spread the loaded state over actions to preserve action references
        set({
          version: state.version,
          lastSaved: state.lastSaved,
          lastPlayed: state.lastPlayed,
          playerName: state.playerName,
          resources: state.resources,
          minigames: state.minigames,
          upgrades: state.upgrades,
          automations: state.automations ?? {},
          settings: state.settings,
          stats: state.stats,
        });
      },
    }))
  );
}
