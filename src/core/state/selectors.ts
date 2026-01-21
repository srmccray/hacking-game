/**
 * State Selectors
 *
 * Reusable selector functions for extracting specific data from game state.
 * These selectors are used with the store's subscribe method for reactive updates.
 *
 * Usage:
 *   import { selectResources, selectTopScores } from './selectors';
 *
 *   // Subscribe to resources changes
 *   const unsubscribe = store.subscribe(
 *     selectResources,
 *     (resources) => updateUI(resources)
 *   );
 *
 *   // Direct state access with selector
 *   const money = selectMoney(store.getState());
 */

import type { GameState, Resources, MinigameState, ResourceType } from '../types';

// ============================================================================
// Resource Selectors
// ============================================================================

/**
 * Select all resources from state.
 */
export function selectResources(state: GameState): Resources {
  return state.resources;
}

/**
 * Select money resource.
 */
export function selectMoney(state: GameState): string {
  return state.resources.money;
}

/**
 * Select technique resource.
 */
export function selectTechnique(state: GameState): string {
  return state.resources.technique;
}

/**
 * Select renown resource.
 */
export function selectRenown(state: GameState): string {
  return state.resources.renown;
}

/**
 * Create a selector for a specific resource type.
 */
export function selectResource(resource: ResourceType): (state: GameState) => string {
  return (state) => state.resources[resource];
}

// ============================================================================
// Minigame Selectors
// ============================================================================

/**
 * Select all minigame states.
 */
export function selectMinigames(state: GameState): Record<string, MinigameState> {
  return state.minigames;
}

/**
 * Select a specific minigame's state.
 */
export function selectMinigame(minigameId: string): (state: GameState) => MinigameState | undefined {
  return (state) => state.minigames[minigameId];
}

/**
 * Select top scores for a specific minigame.
 */
export function selectTopScores(minigameId: string): (state: GameState) => string[] {
  return (state) => state.minigames[minigameId]?.topScores ?? [];
}

/**
 * Select all top scores from all minigames that contribute to money generation.
 * Returns a flat array of all top score strings.
 */
export function selectAllMoneyGeneratingScores(
  moneyGeneratingMinigames: readonly string[]
): (state: GameState) => string[] {
  return (state) => {
    const scores: string[] = [];
    for (const minigameId of moneyGeneratingMinigames) {
      const minigame = state.minigames[minigameId];
      if (minigame?.topScores) {
        scores.push(...minigame.topScores);
      }
    }
    return scores;
  };
}

/**
 * Select whether a minigame is unlocked.
 */
export function selectMinigameUnlocked(minigameId: string): (state: GameState) => boolean {
  return (state) => state.minigames[minigameId]?.unlocked ?? false;
}

/**
 * Select play count for a specific minigame.
 */
export function selectPlayCount(minigameId: string): (state: GameState) => number {
  return (state) => state.minigames[minigameId]?.playCount ?? 0;
}

// ============================================================================
// Upgrade Selectors
// ============================================================================

/**
 * Select all equipment upgrades.
 */
export function selectEquipmentUpgrades(state: GameState): Record<string, number> {
  return state.upgrades.equipment;
}

/**
 * Select level for a specific equipment upgrade.
 */
export function selectEquipmentLevel(upgradeId: string): (state: GameState) => number {
  return (state) => state.upgrades.equipment[upgradeId] ?? 0;
}

/**
 * Select all apartment upgrades.
 */
export function selectApartmentUpgrades(state: GameState): Record<string, boolean> {
  return state.upgrades.apartment;
}

/**
 * Select whether a specific apartment upgrade is purchased.
 */
export function selectApartmentUnlocked(upgradeId: string): (state: GameState) => boolean {
  return (state) => state.upgrades.apartment[upgradeId] ?? false;
}

// ============================================================================
// Stats Selectors
// ============================================================================

/**
 * Select total play time in milliseconds.
 */
export function selectTotalPlayTime(state: GameState): number {
  return state.stats.totalPlayTime;
}

/**
 * Select total offline time in milliseconds.
 */
export function selectTotalOfflineTime(state: GameState): number {
  return state.stats.totalOfflineTime;
}

/**
 * Select lifetime resources earned for a specific resource type.
 */
export function selectTotalResourceEarned(resource: ResourceType): (state: GameState) => string {
  return (state) => state.stats.totalResourcesEarned[resource];
}

// ============================================================================
// Settings Selectors
// ============================================================================

/**
 * Select all settings.
 */
export function selectSettings(state: GameState): GameState['settings'] {
  return state.settings;
}

/**
 * Select whether offline progress is enabled.
 */
export function selectOfflineProgressEnabled(state: GameState): boolean {
  return state.settings.offlineProgressEnabled;
}

// ============================================================================
// Meta Selectors
// ============================================================================

/**
 * Select player name.
 */
export function selectPlayerName(state: GameState): string {
  return state.playerName;
}

/**
 * Select last saved timestamp.
 */
export function selectLastSaved(state: GameState): number {
  return state.lastSaved;
}

/**
 * Select last played timestamp.
 */
export function selectLastPlayed(state: GameState): number {
  return state.lastPlayed;
}

/**
 * Select save version.
 */
export function selectVersion(state: GameState): string {
  return state.version;
}

// ============================================================================
// Computed Selectors
// ============================================================================

/**
 * Select metadata suitable for save slot display.
 * This is a derived value, not stored directly.
 */
export function selectSaveMetadata(state: GameState): {
  playerName: string;
  lastPlayed: number;
  totalPlayTime: number;
  money: string;
} {
  return {
    playerName: state.playerName,
    lastPlayed: state.lastPlayed,
    totalPlayTime: state.stats.totalPlayTime,
    money: state.resources.money,
  };
}

/**
 * Check if the game state represents a new/empty game.
 * Useful for determining if a slot should show "Empty" vs actual data.
 */
export function selectIsNewGame(state: GameState): boolean {
  return state.playerName === '' && state.stats.totalPlayTime === 0;
}
