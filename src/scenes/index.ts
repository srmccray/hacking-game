/**
 * Scene system exports
 */

export { SceneManager, BaseScene } from './SceneManager';
export { createMinigameSelectionScene } from './minigame-selection';
export { createMinigameInterstitialScene } from './minigame-interstitial';
export { createMinigameUpgradesScene } from './minigame-upgrades';
export { createCouchUpgradesScene } from './couch-upgrades';
export { createWorkbenchUpgradesScene } from './workbench-upgrades';

// Re-export Scene interface from core types
export type { Scene, SceneFactory } from '../core/types';
