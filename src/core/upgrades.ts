/**
 * Upgrade System for the Hacker Incremental Game
 *
 * This module defines all purchasable upgrades and provides functions
 * for calculating costs, effects, and handling purchases.
 *
 * Upgrade Categories:
 * - Equipment: Purchased with Money, improve base stats (levels)
 * - Apartment: One-time purchases with Money (boolean unlocks)
 * - Minigame: Purchased with Technique, improve specific minigames (post-MVP)
 *
 * Cost Formula: baseCost * (1.15 ^ level)
 * Effects scale slower than costs to maintain progression curve.
 *
 * Usage:
 *   import { getUpgrade, calculateUpgradeCost, purchaseUpgrade, getUpgradeEffect } from '@core/upgrades';
 *
 *   const upgrade = getUpgrade('auto-typer');
 *   const cost = calculateUpgradeCost('auto-typer', currentLevel);
 *   const success = purchaseUpgrade('auto-typer');
 */

import Decimal from 'break_eternity.js';
import { useGameStore, selectEquipmentLevel, selectApartmentUnlocked } from './game-state';
import {
  calculateCost,
  canAfford,
  createDecimal,
  decimalToString,
  formatNumber,
  DEFAULT_GROWTH_RATE,
} from './resource-manager';
import type { ResourceType } from './types';

// ============================================================================
// Upgrade Type Definitions
// ============================================================================

/**
 * Categories of upgrades
 */
export type UpgradeCategory = 'equipment' | 'apartment' | 'minigame';

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
 * Minigame-specific upgrade
 */
export interface MinigameUpgrade extends BaseUpgrade {
  category: 'minigame';
  /** Which minigame this upgrade applies to */
  minigameId: string;
  /** Cost growth rate per level */
  costGrowthRate: string;
  /** Effect type identifier */
  effectType: MinigameEffectType;
  /** Base effect value */
  baseEffect: number;
  /** Effect increase per level */
  effectPerLevel: number;
}

/**
 * Union type for all upgrades
 */
export type Upgrade = EquipmentUpgrade | ApartmentUpgrade | MinigameUpgrade;

// ============================================================================
// Effect Type Definitions
// ============================================================================

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
 * Minigame upgrade effect types
 */
export type MinigameEffectType =
  | 'base_score_multiplier'; // Multiplies base score in minigame

// ============================================================================
// MVP Upgrade Definitions
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
 * Skill Tutorial (Minigame - Code Breaker)
 * Increases base score in Code Breaker.
 */
const skillTutorialUpgrade: MinigameUpgrade = {
  id: 'skill-tutorial',
  name: 'Skill Tutorial',
  description: 'Learn advanced techniques. Increases base score in Code Breaker by 10% per level.',
  category: 'minigame',
  minigameId: 'code-breaker',
  costResource: 'money',
  baseCost: '150',
  maxLevel: 0, // Unlimited
  costGrowthRate: '1.15',
  effectType: 'base_score_multiplier',
  baseEffect: 1.0, // 100% base (1x multiplier)
  effectPerLevel: 0.1, // +10% per level
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
  'skill-tutorial': skillTutorialUpgrade,
};

/**
 * Upgrades grouped by category for UI display
 */
export const UPGRADES_BY_CATEGORY: Record<UpgradeCategory, Upgrade[]> = {
  equipment: [autoTyperUpgrade, betterKeyboardUpgrade],
  apartment: [coffeeMachineUpgrade],
  minigame: [skillTutorialUpgrade],
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
 * @param upgradeId - The upgrade identifier
 * @returns Current level (0 if not purchased)
 */
export function getUpgradeLevel(upgradeId: string): number {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) return 0;

  const state = useGameStore.getState();

  switch (upgrade.category) {
    case 'equipment':
      return selectEquipmentLevel(state, upgradeId);

    case 'apartment':
      return selectApartmentUnlocked(state, upgradeId) ? 1 : 0;

    case 'minigame': {
      const minigameUpgrade = upgrade as MinigameUpgrade;
      const minigame = state.minigames[minigameUpgrade.minigameId];
      return minigame?.upgrades[upgradeId] ?? 0;
    }

    default:
      return 0;
  }
}

/**
 * Check if an upgrade is at max level.
 *
 * @param upgradeId - The upgrade identifier
 * @returns true if at max level
 */
export function isUpgradeMaxed(upgradeId: string): boolean {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) return true;

  if (upgrade.maxLevel === 0) return false; // Unlimited

  return getUpgradeLevel(upgradeId) >= upgrade.maxLevel;
}

// ============================================================================
// Cost Calculations
// ============================================================================

/**
 * Calculate the cost of an upgrade at a specific level.
 *
 * @param upgradeId - The upgrade identifier
 * @param level - The level to calculate cost for (default: current level)
 * @returns The cost as a Decimal
 */
export function calculateUpgradeCost(upgradeId: string, level?: number): Decimal {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) return createDecimal('0');

  const currentLevel = level ?? getUpgradeLevel(upgradeId);

  // Apartment upgrades have fixed cost
  if (upgrade.category === 'apartment') {
    return createDecimal(upgrade.baseCost);
  }

  // Equipment and minigame upgrades have exponential scaling
  const growthRate =
    upgrade.category === 'equipment' || upgrade.category === 'minigame'
      ? (upgrade as EquipmentUpgrade | MinigameUpgrade).costGrowthRate
      : DEFAULT_GROWTH_RATE.toString();

  return calculateCost(upgrade.baseCost, growthRate, currentLevel);
}

/**
 * Get the formatted cost string for display.
 *
 * @param upgradeId - The upgrade identifier
 * @returns Formatted cost string
 */
export function getUpgradeCostFormatted(upgradeId: string): string {
  const cost = calculateUpgradeCost(upgradeId);
  return formatNumber(cost);
}

/**
 * Check if the player can afford an upgrade.
 *
 * @param upgradeId - The upgrade identifier
 * @returns true if affordable
 */
export function canAffordUpgrade(upgradeId: string): boolean {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) return false;

  // Check if maxed
  if (isUpgradeMaxed(upgradeId)) return false;

  const state = useGameStore.getState();
  const currentResource = state.resources[upgrade.costResource];
  const cost = calculateUpgradeCost(upgradeId);

  return canAfford(currentResource, cost);
}

// ============================================================================
// Effect Calculations
// ============================================================================

/**
 * Get the current effect value of an upgrade.
 *
 * @param upgradeId - The upgrade identifier
 * @returns The effect value
 */
export function getUpgradeEffect(upgradeId: string): number {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) return 0;

  const level = getUpgradeLevel(upgradeId);
  if (level === 0) return getBaseEffectValue(upgrade);

  switch (upgrade.category) {
    case 'equipment': {
      const equip = upgrade as EquipmentUpgrade;
      return equip.baseEffect + equip.effectPerLevel * level;
    }

    case 'apartment': {
      const apt = upgrade as ApartmentUpgrade;
      return level > 0 ? apt.effectValue : 0;
    }

    case 'minigame': {
      const mini = upgrade as MinigameUpgrade;
      return mini.baseEffect + mini.effectPerLevel * level;
    }

    default:
      return 0;
  }
}

/**
 * Get the base effect value (at level 0) for an upgrade.
 */
function getBaseEffectValue(upgrade: Upgrade): number {
  switch (upgrade.category) {
    case 'equipment':
      return (upgrade as EquipmentUpgrade).baseEffect;
    case 'apartment':
      return 0; // Apartment upgrades have no effect until purchased
    case 'minigame':
      return (upgrade as MinigameUpgrade).baseEffect;
    default:
      return 0;
  }
}

/**
 * Get the effect description for display.
 *
 * @param upgradeId - The upgrade identifier
 * @returns Formatted effect string
 */
export function getUpgradeEffectFormatted(upgradeId: string): string {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) return '';

  const effect = getUpgradeEffect(upgradeId);
  const level = getUpgradeLevel(upgradeId);

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

    case 'minigame': {
      const mini = upgrade as MinigameUpgrade;
      if (mini.effectType === 'base_score_multiplier') {
        return `${(effect * 100).toFixed(0)}% base score`;
      }
      return `${effect}`;
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
 * @returns The multiplier (1.0 = 100%, 1.5 = 150%, etc.)
 */
export function getAutoGenerationMultiplier(): number {
  return getUpgradeEffect('auto-typer');
}

/**
 * Get the total combo multiplier bonus from all upgrades.
 *
 * @returns The bonus to add to combo multiplier
 */
export function getComboMultiplierBonus(): number {
  return getUpgradeEffect('better-keyboard');
}

/**
 * Get the total minigame time bonus from all upgrades.
 *
 * @returns The bonus seconds to add to minigame time limits
 */
export function getMinigameTimeBonus(): number {
  // Coffee machine is the only time bonus upgrade for MVP
  return getUpgradeEffect('coffee-machine');
}

/**
 * Get the base score multiplier for a specific minigame.
 *
 * @param minigameId - The minigame identifier
 * @returns The score multiplier (1.0 = 100%)
 */
export function getMinigameScoreMultiplier(minigameId: string): number {
  // Find all minigame upgrades that apply to this minigame
  const minigameUpgrades = getUpgradesByCategory('minigame') as MinigameUpgrade[];
  const applicableUpgrades = minigameUpgrades.filter((u) => u.minigameId === minigameId);

  if (applicableUpgrades.length === 0) return 1.0;

  // Multiply all applicable score multipliers
  let totalMultiplier = 1.0;
  for (const upgrade of applicableUpgrades) {
    if (upgrade.effectType === 'base_score_multiplier') {
      const effect = getUpgradeEffect(upgrade.id);
      totalMultiplier *= effect;
    }
  }

  return totalMultiplier;
}

// ============================================================================
// Purchase Logic
// ============================================================================

/**
 * Attempt to purchase an upgrade.
 *
 * @param upgradeId - The upgrade identifier
 * @returns true if purchase was successful
 */
export function purchaseUpgrade(upgradeId: string): boolean {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) {
    console.warn(`Upgrade not found: ${upgradeId}`);
    return false;
  }

  // Check if already maxed
  if (isUpgradeMaxed(upgradeId)) {
    console.warn(`Upgrade already maxed: ${upgradeId}`);
    return false;
  }

  // Calculate cost
  const cost = calculateUpgradeCost(upgradeId);
  const costString = decimalToString(cost);

  // Attempt to deduct cost
  const store = useGameStore.getState();
  const success = store.subtractResource(upgrade.costResource, costString);

  if (!success) {
    console.warn(`Insufficient ${upgrade.costResource} for upgrade: ${upgradeId}`);
    return false;
  }

  // Apply upgrade based on category
  switch (upgrade.category) {
    case 'equipment':
      store.purchaseEquipmentUpgrade(upgradeId);
      break;

    case 'apartment':
      store.purchaseApartmentUpgrade(upgradeId);
      break;

    case 'minigame': {
      const minigameUpgrade = upgrade as MinigameUpgrade;
      store.upgradeMinigame(minigameUpgrade.minigameId, upgradeId);
      break;
    }
  }

  console.log(`Purchased upgrade: ${upgrade.name} (Level ${getUpgradeLevel(upgradeId)})`);
  return true;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get upgrade info for display in UI.
 *
 * @param upgradeId - The upgrade identifier
 * @returns Object with all display info or null if not found
 */
export function getUpgradeDisplayInfo(upgradeId: string): {
  id: string;
  name: string;
  description: string;
  category: UpgradeCategory;
  level: number;
  maxLevel: number;
  cost: string;
  costResource: ResourceType;
  effect: string;
  canAfford: boolean;
  isMaxed: boolean;
} | null {
  const upgrade = getUpgrade(upgradeId);
  if (!upgrade) return null;

  const level = getUpgradeLevel(upgradeId);
  const maxed = isUpgradeMaxed(upgradeId);

  return {
    id: upgrade.id,
    name: upgrade.name,
    description: upgrade.description,
    category: upgrade.category,
    level,
    maxLevel: upgrade.maxLevel,
    cost: maxed ? 'MAX' : getUpgradeCostFormatted(upgradeId),
    costResource: upgrade.costResource,
    effect: getUpgradeEffectFormatted(upgradeId),
    canAfford: canAffordUpgrade(upgradeId),
    isMaxed: maxed,
  };
}

/**
 * Get all upgrade display info for a category.
 *
 * @param category - The upgrade category
 * @returns Array of upgrade display info
 */
export function getCategoryDisplayInfo(category: UpgradeCategory): ReturnType<typeof getUpgradeDisplayInfo>[] {
  const upgrades = getUpgradesByCategory(category);
  return upgrades.map((u) => getUpgradeDisplayInfo(u.id)).filter((info) => info !== null);
}
