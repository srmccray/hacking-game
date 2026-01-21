/**
 * Upgrade system exports
 */

export {
  // Types
  type UpgradeCategory,
  type EquipmentEffectType,
  type ApartmentEffectType,
  type BaseUpgrade,
  type EquipmentUpgrade,
  type ApartmentUpgrade,
  type Upgrade,
  type UpgradeDisplayInfo,
  // Constants
  UPGRADES_BY_CATEGORY,
  UPGRADE_IDS,
  // Accessors
  getUpgrade,
  getAllUpgrades,
  getUpgradesByCategory,
  getUpgradeLevel,
  isUpgradeMaxed,
  // Cost calculations
  calculateUpgradeCost,
  getNextLevelCost,
  getUpgradeCostFormatted,
  canAffordUpgrade,
  // Effect calculations
  getUpgradeEffect,
  getUpgradeEffectFormatted,
  getAutoGenerationMultiplier,
  getComboMultiplierBonus,
  getMinigameTimeBonus,
  // Purchase
  purchaseUpgrade,
  // Display
  getUpgradeDisplayInfo,
  getCategoryDisplayInfo,
} from './upgrade-definitions';
