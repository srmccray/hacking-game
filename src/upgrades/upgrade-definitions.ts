/**
 * Upgrade System Definitions
 *
 * This module defines all purchasable upgrades and provides functions
 * for calculating costs, effects, and handling purchases.
 *
 * Upgrade Categories:
 * - Equipment: Purchased with Money, improve base stats (levels)
 * - Apartment: One-time purchases with Money (boolean unlocks)
 *
 * Cost Formula: baseCost * (growthRate ^ level)
 * Effects scale slower than costs to maintain progression curve.
 *
 * Usage:
 *   import { getUpgrade, calculateUpgradeCost, purchaseUpgrade } from './upgrade-definitions';
 *
 *   const upgrade = getUpgrade('auto-typer');
 *   const cost = calculateUpgradeCost('auto-typer', currentLevel);
 *   const success = purchaseUpgrade(store, 'auto-typer');
 */

import { isGreaterOrEqual, powerDecimals, multiplyDecimals, formatDecimal } from '../core/resources/resource-manager';
import type { GameStore } from '../core/state/game-store';
import type { ResourceType } from '../core/types';
import type { GameConfig } from '../game/GameConfig';

// ============================================================================
// Types
// ============================================================================

/**
 * Categories of upgrades
 */
export type UpgradeCategory = 'equipment' | 'apartment' | 'consumable' | 'hardware';

/**
 * Equipment upgrade effect types
 */
export type EquipmentEffectType =
  | 'auto_generation_multiplier' // Multiplies auto-generation rate
  | 'combo_multiplier_bonus'; // Adds to Code Breaker combo multiplier

/**
 * Apartment upgrade effect types
 */
export type ApartmentEffectType =
  | 'minigame_time_bonus'; // Adds seconds to minigame time limits

/**
 * Consumable upgrade effect types
 */
export type ConsumableEffectType =
  | 'grant_resource'; // Grants a resource on purchase

/**
 * Hardware upgrade effect types (requires dual currency)
 */
export type HardwareEffectType =
  | 'enable_automation'; // Enables an automation system

/**
 * Base upgrade definition interface
 */
export interface BaseUpgrade {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what this upgrade does */
  description: string;
  /** Category of upgrade */
  category: UpgradeCategory;
  /** Resource required to purchase */
  costResource: ResourceType;
  /** Base cost at level 0 */
  baseCost: string;
  /** Maximum level (0 = unlimited for equipment, 1 = one-time for apartment) */
  maxLevel: number;
}

/**
 * Equipment upgrade (can be purchased multiple times)
 */
export interface EquipmentUpgrade extends BaseUpgrade {
  category: 'equipment';
  /** Cost growth rate per level (default 1.15) */
  costGrowthRate: string;
  /** Effect type identifier */
  effectType: EquipmentEffectType;
  /** Base effect value at level 1 */
  baseEffect: number;
  /** Effect increase per level */
  effectPerLevel: number;
}

/**
 * Apartment upgrade (one-time purchase)
 */
export interface ApartmentUpgrade extends BaseUpgrade {
  category: 'apartment';
  maxLevel: 1;
  /** Effect type identifier */
  effectType: ApartmentEffectType;
  /** Effect value when purchased */
  effectValue: number;
}

/**
 * Consumable upgrade (can be purchased multiple times, grants resource on purchase)
 */
export interface ConsumableUpgrade extends BaseUpgrade {
  category: 'consumable';
  maxLevel: 0; // Unlimited
  /** Cost growth rate per level (default 1.0 for flat cost) */
  costGrowthRate: string;
  /** Effect type identifier */
  effectType: ConsumableEffectType;
  /** Resource type granted on purchase */
  grantResource: ResourceType;
  /** Amount of resource granted per purchase as Decimal string */
  grantAmount: string;
}

/**
 * Hardware upgrade (one-time purchase, requires BOTH money AND technique)
 */
export interface HardwareUpgrade extends BaseUpgrade {
  category: 'hardware';
  maxLevel: 1; // One-time purchase
  /** Secondary cost resource (typically technique) */
  secondaryCostResource: ResourceType;
  /** Secondary cost amount as Decimal string */
  secondaryCost: string;
  /** Effect type identifier */
  effectType: HardwareEffectType;
  /** The automation ID this upgrade enables (for enable_automation effect) */
  automationId?: string;
}

/**
 * Union type for all upgrades
 */
export type Upgrade = EquipmentUpgrade | ApartmentUpgrade | ConsumableUpgrade | HardwareUpgrade;

// ============================================================================
// Upgrade Definitions
// ============================================================================

/**
 * Auto-Typer (Equipment)
 * Increases base money generation rate.
 */
const autoTyperUpgrade: EquipmentUpgrade = {
  id: 'auto-typer',
  name: 'Auto-Typer',
  description: 'Automated typing software. Increases passive money generation by 5% per level.',
  category: 'equipment',
  costResource: 'money',
  baseCost: '100',
  maxLevel: 0, // Unlimited
  costGrowthRate: '1.15',
  effectType: 'auto_generation_multiplier',
  baseEffect: 1.0, // 100% base (1x multiplier)
  effectPerLevel: 0.05, // +5% per level
};

/**
 * Better Keyboard (Equipment)
 * Increases Code Breaker combo multiplier bonus.
 */
const betterKeyboardUpgrade: EquipmentUpgrade = {
  id: 'better-keyboard',
  name: 'Better Keyboard',
  description: 'Mechanical keyboard with faster response. Increases combo multiplier by +0.1x per level.',
  category: 'equipment',
  costResource: 'money',
  baseCost: '250',
  maxLevel: 0, // Unlimited
  costGrowthRate: '1.15',
  effectType: 'combo_multiplier_bonus',
  baseEffect: 0.0, // No base bonus
  effectPerLevel: 0.1, // +0.1x combo per level
};

/**
 * Coffee Machine (Apartment)
 * Increases time limit in minigames.
 */
const coffeeMachineUpgrade: ApartmentUpgrade = {
  id: 'coffee-machine',
  name: 'Coffee Machine',
  description: 'Stay alert longer. Adds +10 seconds to all minigame time limits.',
  category: 'apartment',
  costResource: 'money',
  baseCost: '500',
  maxLevel: 1, // One-time purchase
  effectType: 'minigame_time_bonus',
  effectValue: 10, // +10 seconds
};

/**
 * Training Manual (Consumable)
 * Grants TP (Technique Points) on purchase. Can be purchased multiple times.
 */
const trainingManualUpgrade: ConsumableUpgrade = {
  id: 'training-manual',
  name: 'Training Manual',
  description: 'Study hacking techniques. Grants +1 TP per purchase.',
  category: 'consumable',
  costResource: 'money',
  baseCost: '10',
  maxLevel: 0, // Unlimited
  costGrowthRate: '1.0', // Flat cost - no scaling
  effectType: 'grant_resource',
  grantResource: 'technique',
  grantAmount: '1', // +1 TP per purchase
};

/**
 * Book Summarizer (Hardware)
 * Enables auto-buy automation for technique points.
 * Requires BOTH money AND technique to purchase.
 */
const bookSummarizerUpgrade: HardwareUpgrade = {
  id: 'book-summarizer',
  name: 'Book Summarizer',
  description: 'AI-powered tool that summarizes training materials. Every 60s, converts $10 into +1 TP.',
  category: 'hardware',
  costResource: 'money',
  baseCost: '100',
  secondaryCostResource: 'technique',
  secondaryCost: '10',
  maxLevel: 1, // One-time purchase
  effectType: 'enable_automation',
  automationId: 'book-summarizer',
};

// ============================================================================
// Upgrade Registry
// ============================================================================

/**
 * All available upgrades indexed by ID
 */
const UPGRADES: Record<string, Upgrade> = {
  'auto-typer': autoTyperUpgrade,
  'better-keyboard': betterKeyboardUpgrade,
  'coffee-machine': coffeeMachineUpgrade,
  'training-manual': trainingManualUpgrade,
  'book-summarizer': bookSummarizerUpgrade,
};

/**
 * Upgrades grouped by category for UI display
 */
export const UPGRADES_BY_CATEGORY: Record<UpgradeCategory, Upgrade[]> = {
  equipment: [autoTyperUpgrade, betterKeyboardUpgrade],
  apartment: [coffeeMachineUpgrade],
  consumable: [trainingManualUpgrade],
  hardware: [bookSummarizerUpgrade],
};

/**
 * All upgrade IDs
 */
export const UPGRADE_IDS = Object.keys(UPGRADES);

// ============================================================================
// Upgrade Accessors
// ============================================================================

/**
 * Get an upgrade definition by ID.
 *
 * @param upgradeId - The upgrade identifier
 * @returns The upgrade definition or undefined if not found
 */
export function getUpgrade(upgradeId: string): Upgrade | undefined {
  return UPGRADES[upgradeId];
}

/**
 * Get all upgrades.
 *
 * @returns Array of all upgrade definitions
 */
export function getAllUpgrades(): Upgrade[] {
  return Object.values(UPGRADES);
}

/**
 * Get upgrades by category.
 *
 * @param category - The upgrade category
 * @returns Array of upgrades in that category
 */
export function getUpgradesByCategory(category: UpgradeCategory): Upgrade[] {
  return UPGRADES_BY_CATEGORY[category] || [];
}

// ============================================================================
// Level Accessors
// ============================================================================

/**
 * Get the current level of an upgrade.
 *
 * @param store - The game store
 * @param upgradeId - The upgrade identifier
 * @returns Current level (0 if not purchased)
 */
export function getUpgradeLevel(store: GameStore, upgradeId: string): number {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) {return 0;}

  const state = store.getState();

  switch (upgrade.category) {
    case 'equipment':
      return state.upgrades.equipment[upgradeId] ?? 0;

    case 'apartment':
      return state.upgrades.apartment[upgradeId] ? 1 : 0;

    case 'consumable':
      // Consumables track purchase count in equipment (reusing storage)
      return state.upgrades.equipment[upgradeId] ?? 0;

    case 'hardware':
      // Hardware upgrades are one-time, stored in apartment (boolean)
      return state.upgrades.apartment[upgradeId] ? 1 : 0;

    default:
      return 0;
  }
}

/**
 * Check if an upgrade is at max level.
 *
 * @param store - The game store
 * @param upgradeId - The upgrade identifier
 * @returns true if at max level
 */
export function isUpgradeMaxed(store: GameStore, upgradeId: string): boolean {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) {return true;}

  if (upgrade.maxLevel === 0) {return false;} // Unlimited

  return getUpgradeLevel(store, upgradeId) >= upgrade.maxLevel;
}

// ============================================================================
// Cost Calculations
// ============================================================================

/**
 * Calculate the cost of an upgrade at a specific level.
 *
 * @param upgradeId - The upgrade identifier
 * @param level - The level to calculate cost for
 * @param config - Optional game config for growth rate
 * @returns The cost as a string
 */
export function calculateUpgradeCost(
  upgradeId: string,
  level: number,
  config?: GameConfig
): string {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) {return '0';}

  // Apartment upgrades have fixed cost
  if (upgrade.category === 'apartment') {
    return upgrade.baseCost;
  }

  // Hardware upgrades have fixed cost (primary currency)
  if (upgrade.category === 'hardware') {
    return upgrade.baseCost;
  }

  // Consumable upgrades use their growth rate (usually 1.0 for flat cost)
  if (upgrade.category === 'consumable') {
    const consumable = upgrade as ConsumableUpgrade;
    const multiplier = powerDecimals(consumable.costGrowthRate, level);
    return multiplyDecimals(consumable.baseCost, multiplier);
  }

  // Equipment upgrades have exponential scaling
  const growthRate = (upgrade as EquipmentUpgrade).costGrowthRate ||
    (config?.upgrades.defaultGrowthRate.toString() ?? '1.15');

  // cost = baseCost * (growthRate ^ level)
  const multiplier = powerDecimals(growthRate, level);
  return multiplyDecimals(upgrade.baseCost, multiplier);
}

/**
 * Get the cost of the next level for an upgrade.
 *
 * @param store - The game store
 * @param upgradeId - The upgrade identifier
 * @param config - Optional game config
 * @returns The cost as a string
 */
export function getNextLevelCost(
  store: GameStore,
  upgradeId: string,
  config?: GameConfig
): string {
  const currentLevel = getUpgradeLevel(store, upgradeId);
  return calculateUpgradeCost(upgradeId, currentLevel, config);
}

/**
 * Get the formatted cost string for display.
 *
 * @param store - The game store
 * @param upgradeId - The upgrade identifier
 * @returns Formatted cost string
 */
export function getUpgradeCostFormatted(store: GameStore, upgradeId: string): string {
  const cost = getNextLevelCost(store, upgradeId);
  return formatDecimal(cost);
}

/**
 * Check if the player can afford an upgrade.
 *
 * @param store - The game store
 * @param upgradeId - The upgrade identifier
 * @returns true if affordable
 */
export function canAffordUpgrade(store: GameStore, upgradeId: string): boolean {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) {return false;}

  // Check if maxed
  if (isUpgradeMaxed(store, upgradeId)) {return false;}

  const state = store.getState();
  const currentResource = state.resources[upgrade.costResource];
  const cost = getNextLevelCost(store, upgradeId);

  // Check primary cost
  if (!isGreaterOrEqual(currentResource, cost)) {
    return false;
  }

  // Hardware upgrades require checking secondary cost as well
  if (upgrade.category === 'hardware') {
    const hardwareUpgrade = upgrade as HardwareUpgrade;
    const secondaryResource = state.resources[hardwareUpgrade.secondaryCostResource];
    if (!isGreaterOrEqual(secondaryResource, hardwareUpgrade.secondaryCost)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Effect Calculations
// ============================================================================

/**
 * Get the current effect value of an upgrade.
 *
 * @param store - The game store
 * @param upgradeId - The upgrade identifier
 * @returns The effect value
 */
export function getUpgradeEffect(store: GameStore, upgradeId: string): number {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) {return 0;}

  const level = getUpgradeLevel(store, upgradeId);

  switch (upgrade.category) {
    case 'equipment': {
      const equip = upgrade as EquipmentUpgrade;
      return equip.baseEffect + equip.effectPerLevel * level;
    }

    case 'apartment': {
      const apt = upgrade as ApartmentUpgrade;
      return level > 0 ? apt.effectValue : 0;
    }

    case 'consumable': {
      const consumable = upgrade as ConsumableUpgrade;
      // Return the grant amount as a number (for display purposes)
      return parseFloat(consumable.grantAmount);
    }

    case 'hardware': {
      // Hardware upgrades are boolean - return 1 if owned, 0 if not
      return level > 0 ? 1 : 0;
    }

    default:
      return 0;
  }
}

/**
 * Get the effect description for display.
 *
 * @param store - The game store
 * @param upgradeId - The upgrade identifier
 * @returns Formatted effect string
 */
export function getUpgradeEffectFormatted(store: GameStore, upgradeId: string): string {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) {return '';}

  const effect = getUpgradeEffect(store, upgradeId);
  const level = getUpgradeLevel(store, upgradeId);

  switch (upgrade.category) {
    case 'equipment': {
      const equip = upgrade as EquipmentUpgrade;
      if (equip.effectType === 'auto_generation_multiplier') {
        return `${(effect * 100).toFixed(0)}% generation`;
      }
      if (equip.effectType === 'combo_multiplier_bonus') {
        return `+${effect.toFixed(1)}x combo`;
      }
      return `${effect}`;
    }

    case 'apartment': {
      const apt = upgrade as ApartmentUpgrade;
      if (level > 0) {
        return `+${apt.effectValue}s time`;
      }
      return `+${apt.effectValue}s time (locked)`;
    }

    case 'consumable': {
      const consumable = upgrade as ConsumableUpgrade;
      // Show what resource is granted
      const resourceLabel = consumable.grantResource === 'technique' ? 'TP'
        : consumable.grantResource === 'renown' ? 'RP'
        : '$';
      return `+${consumable.grantAmount} ${resourceLabel}`;
    }

    case 'hardware': {
      const hardware = upgrade as HardwareUpgrade;
      if (hardware.effectType === 'enable_automation') {
        return level > 0 ? 'ACTIVE' : 'Enables automation';
      }
      return level > 0 ? 'Owned' : 'Not owned';
    }

    default:
      return '';
  }
}

// ============================================================================
// Aggregate Effect Getters
// ============================================================================

/**
 * Get the total auto-generation multiplier from all upgrades.
 *
 * @param store - The game store
 * @returns The multiplier (1.0 = 100%, 1.5 = 150%, etc.)
 */
export function getAutoGenerationMultiplier(store: GameStore): number {
  return getUpgradeEffect(store, 'auto-typer');
}

/**
 * Get the total combo multiplier bonus from all upgrades.
 *
 * @param store - The game store
 * @returns The bonus to add to combo multiplier
 */
export function getComboMultiplierBonus(store: GameStore): number {
  return getUpgradeEffect(store, 'better-keyboard');
}

/**
 * Get the total minigame time bonus from all upgrades.
 *
 * @param store - The game store
 * @returns The bonus seconds to add to minigame time limits
 */
export function getMinigameTimeBonus(store: GameStore): number {
  return getUpgradeEffect(store, 'coffee-machine');
}

// ============================================================================
// Purchase Logic
// ============================================================================

/**
 * Attempt to purchase an upgrade.
 *
 * @param store - The game store
 * @param upgradeId - The upgrade identifier
 * @returns true if purchase was successful
 */
export function purchaseUpgrade(store: GameStore, upgradeId: string): boolean {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) {
    console.warn(`[Upgrades] Upgrade not found: ${upgradeId}`);
    return false;
  }

  // Check if already maxed
  if (isUpgradeMaxed(store, upgradeId)) {
    console.warn(`[Upgrades] Upgrade already maxed: ${upgradeId}`);
    return false;
  }

  // Check affordability (includes both costs for hardware)
  if (!canAffordUpgrade(store, upgradeId)) {
    console.warn(`[Upgrades] Cannot afford upgrade: ${upgradeId}`);
    return false;
  }

  // Get cost
  const cost = getNextLevelCost(store, upgradeId);

  // Deduct primary cost
  const state = store.getState();
  const success = state.subtractResource(upgrade.costResource, cost);

  if (!success) {
    console.warn(`[Upgrades] Insufficient ${upgrade.costResource} for upgrade: ${upgradeId}`);
    return false;
  }

  // For hardware upgrades, also deduct secondary cost
  if (upgrade.category === 'hardware') {
    const hardwareUpgrade = upgrade as HardwareUpgrade;
    const secondarySuccess = state.subtractResource(
      hardwareUpgrade.secondaryCostResource,
      hardwareUpgrade.secondaryCost
    );
    if (!secondarySuccess) {
      // Refund primary cost if secondary fails (shouldn't happen due to canAffordUpgrade check)
      state.addResource(upgrade.costResource, cost);
      console.warn(`[Upgrades] Insufficient ${hardwareUpgrade.secondaryCostResource} for upgrade: ${upgradeId}`);
      return false;
    }
  }

  // Apply upgrade based on category
  switch (upgrade.category) {
    case 'equipment':
      state.purchaseEquipmentUpgrade(upgradeId);
      break;

    case 'apartment':
      state.purchaseApartmentUpgrade(upgradeId);
      break;

    case 'consumable': {
      // Consumables grant a resource on purchase and track count in equipment
      const consumable = upgrade as ConsumableUpgrade;
      state.addResource(consumable.grantResource, consumable.grantAmount);
      state.purchaseEquipmentUpgrade(upgradeId); // Reuse equipment counter
      break;
    }

    case 'hardware': {
      // Hardware upgrades are one-time, stored in apartment
      // They may enable automations (handled by the game system)
      state.purchaseApartmentUpgrade(upgradeId);
      break;
    }
  }

  console.log(`[Upgrades] Purchased: ${upgrade.name} (Level ${getUpgradeLevel(store, upgradeId)})`);
  return true;
}

// ============================================================================
// Display Info
// ============================================================================

/**
 * Upgrade display information for UI.
 */
export interface UpgradeDisplayInfo {
  id: string;
  name: string;
  description: string;
  category: UpgradeCategory;
  level: number;
  maxLevel: number;
  cost: string;
  costFormatted: string;
  costResource: ResourceType;
  /** Secondary cost for hardware upgrades (optional) */
  secondaryCost?: string;
  secondaryCostFormatted?: string;
  secondaryCostResource?: ResourceType;
  effect: string;
  canAfford: boolean;
  isMaxed: boolean;
}

/**
 * Get upgrade info for display in UI.
 *
 * @param store - The game store
 * @param upgradeId - The upgrade identifier
 * @returns Object with all display info or null if not found
 */
export function getUpgradeDisplayInfo(store: GameStore, upgradeId: string): UpgradeDisplayInfo | null {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) {return null;}

  const level = getUpgradeLevel(store, upgradeId);
  const maxed = isUpgradeMaxed(store, upgradeId);
  const cost = getNextLevelCost(store, upgradeId);

  const displayInfo: UpgradeDisplayInfo = {
    id: upgrade.id,
    name: upgrade.name,
    description: upgrade.description,
    category: upgrade.category,
    level,
    maxLevel: upgrade.maxLevel,
    cost,
    costFormatted: maxed ? 'MAX' : formatDecimal(cost),
    costResource: upgrade.costResource,
    effect: getUpgradeEffectFormatted(store, upgradeId),
    canAfford: canAffordUpgrade(store, upgradeId),
    isMaxed: maxed,
  };

  // Add secondary cost info for hardware upgrades
  if (upgrade.category === 'hardware') {
    const hardwareUpgrade = upgrade as HardwareUpgrade;
    displayInfo.secondaryCost = hardwareUpgrade.secondaryCost;
    displayInfo.secondaryCostFormatted = maxed ? 'MAX' : formatDecimal(hardwareUpgrade.secondaryCost);
    displayInfo.secondaryCostResource = hardwareUpgrade.secondaryCostResource;
  }

  return displayInfo;
}

/**
 * Get all upgrade display info for a category.
 *
 * @param store - The game store
 * @param category - The upgrade category
 * @returns Array of upgrade display info
 */
export function getCategoryDisplayInfo(store: GameStore, category: UpgradeCategory): UpgradeDisplayInfo[] {
  const upgrades = getUpgradesByCategory(category);
  return upgrades
    .map(u => getUpgradeDisplayInfo(store, u.id))
    .filter((info): info is UpgradeDisplayInfo => info !== null);
}
