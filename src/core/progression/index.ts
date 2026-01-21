/**
 * Progression system exports
 */

// Auto-generation
export {
  calculateBaseRateFromScores,
  getMoneyGenerationRate,
  getAutoGenerationMultiplier,
  getAllGenerationRates,
  calculateGenerationOverTime,
  hasActiveGeneration,
  getGenerationBreakdown,
} from './auto-generation';

// Offline progress
export {
  calculateOfflineProgress,
  applyOfflineProgress,
  processOfflineProgress,
  shouldShowWelcomeBackModal,
  formatDuration,
  formatRelativeTime,
  getMaxOfflineTimeString,
  getEfficiencyPercentString,
  previewOfflineEarnings,
  type OfflineProgressResult,
} from './offline-progress';

// Tick engine
export { TickEngine, type RateUpdateCallback } from './tick-engine';
