/**
 * State management exports
 *
 * This module provides the Zustand game store and associated selectors
 * for managing all game state.
 */

export { createGameStore, insertScore, type GameStore } from './game-store';

export {
  // Resource selectors
  selectResources,
  selectMoney,
  selectTechnique,
  selectRenown,
  selectResource,
  // Minigame selectors
  selectMinigames,
  selectMinigame,
  selectTopScores,
  selectAllMoneyGeneratingScores,
  selectMinigameUnlocked,
  selectPlayCount,
  // Upgrade selectors
  selectEquipmentUpgrades,
  selectEquipmentLevel,
  selectApartmentUpgrades,
  selectApartmentUnlocked,
  // Stats selectors
  selectTotalPlayTime,
  selectTotalOfflineTime,
  selectTotalResourceEarned,
  // Settings selectors
  selectSettings,
  selectOfflineProgressEnabled,
  // Meta selectors
  selectPlayerName,
  selectLastSaved,
  selectLastPlayed,
  selectVersion,
  // Computed selectors
  selectSaveMetadata,
  selectIsNewGame,
} from './selectors';
