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

import { isGreaterOrEqual, powerDecimals, multiplyDecimals, addDecimals, formatDecimal } from '../core/resources/resource-manager';
import type { GameStore } from '../core/state/game-store';
import type { ResourceType } from '../core/types';
import type { GameConfig } from '../game/GameConfig';

// ============================================================================
// Types
// ============================================================================

/**
 * Categories of upgrades
 */
export type UpgradeCategory = 'equipment' | 'apartment' | 'consumable' | 'hardware' | 'minigame';

/**
 * Equipment upgrade effect types
 */
export type EquipmentEffectType =
  | 'auto_generation_multiplier' // Multiplies auto-generation rate
  | 'combo_multiplier_bonus' // Adds to Code Breaker combo multiplier
  | 'per_code_time_bonus'; // Adds seconds to per-code time limit in Code Breaker

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
 * Minigame upgrade effect types
 */
export type MinigameEffectType =
  | 'gap_width_bonus' // Increases Code Runner gap width
  | 'wall_spacing_bonus' // Increases Code Runner vertical wall spacing
  | 'move_speed_bonus' // Increases Code Runner player move speed
  | 'center_bias' // Biases Code Runner gap positions toward center
  | 'time_bonus' // Adds bonus time to Code Breaker per-code timer
  | 'code_length_reduction' // Reduces starting code length in Code Breaker
  | 'damage_multiplier_bonus' // Adds damage multiplier bonus for Botnet Defense
  | 'health_bonus'; // Adds extra HP for Botnet Defense

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
 * Hardware upgrade (requires BOTH money AND technique).
 * Can be one-time (maxLevel: 1) or repeatable with scaling costs.
 */
export interface HardwareUpgrade extends BaseUpgrade {
  category: 'hardware';
  /** Secondary cost resource (typically technique) */
  secondaryCostResource: ResourceType;
  /** Secondary cost amount as Decimal string */
  secondaryCost: string;
  /** Cost growth rate per level for primary cost (default 1.0 for flat cost) */
  costGrowthRate: string;
  /** Cost growth rate per level for secondary cost (default 1.0 for flat cost) */
  secondaryCostGrowthRate: string;
  /** Effect type identifier */
  effectType: HardwareEffectType;
  /** The automation ID this upgrade enables (for enable_automation effect) */
  automationId?: string;
}

/**
 * Minigame upgrade (can be purchased multiple times, stored per-minigame)
 */
export interface MinigameUpgrade extends BaseUpgrade {
  category: 'minigame';
  /** The minigame this upgrade belongs to */
  minigameId: string;
  /** Cost growth: additive increment per level (e.g., 5 means cost goes 10, 15, 20, 25...) */
  costIncrement: string;
  /** Effect type identifier */
  effectType: MinigameEffectType;
  /** Base effect value at level 1 */
  baseEffect: number;
  /** Effect increase per level */
  effectPerLevel: number;
}

/**
 * Union type for all upgrades
 */
export type Upgrade = EquipmentUpgrade | ApartmentUpgrade | ConsumableUpgrade | HardwareUpgrade | MinigameUpgrade;

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
 * Adds time per code attempt in Code Breaker.
 */
const betterKeyboardUpgrade: EquipmentUpgrade = {
  id: 'better-keyboard',
  name: 'Better Keyboard',
  description: 'Mechanical keyboard with faster response. Adds +0.3s per code attempt per level.',
  category: 'equipment',
  costResource: 'money',
  baseCost: '250',
  maxLevel: 0, // Unlimited
  costGrowthRate: '1.15',
  effectType: 'per_code_time_bonus',
  baseEffect: 0.0, // No base bonus
  effectPerLevel: 0.3, // +0.3s per level
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
  description: 'AI-powered tool that summarizes training materials. Every 60s, converts $10 into TP equal to upgrade level.',
  category: 'hardware',
  costResource: 'money',
  baseCost: '100',
  secondaryCostResource: 'technique',
  secondaryCost: '10',
  costGrowthRate: '1.5',
  secondaryCostGrowthRate: '1.5',
  maxLevel: 10,
  effectType: 'enable_automation',
  automationId: 'book-summarizer',
};

/**
 * Gap Expander (Minigame - Code Runner)
 * Increases the gap width in Code Runner walls.
 * Cost: 10 TP base, +5 TP per level (10, 15, 20, 25...)
 */
const gapExpanderUpgrade: MinigameUpgrade = {
  id: 'gap-expander',
  name: 'Gap Expander',
  description: 'Widens the gap in code walls. Each level adds +1 character width to the gap.',
  category: 'minigame',
  minigameId: 'code-runner',
  costResource: 'technique',
  baseCost: '10',
  maxLevel: 0, // Unlimited
  costIncrement: '5', // +5 TP per level
  effectType: 'gap_width_bonus',
  baseEffect: 0, // No base bonus (gap width already has a base from config)
  effectPerLevel: 10, // +10 pixels per level (approximately 1 character width)
};

/**
 * Buffer Overflow (Minigame - Code Runner)
 * Increases the vertical space between walls in Code Runner.
 * Cost: 10 TP base, +10 TP per level (10, 20, 30, 40...)
 */
const bufferOverflowUpgrade: MinigameUpgrade = {
  id: 'buffer-overflow',
  name: 'Buffer Overflow',
  description: 'Overflows the code buffer, adding more space between walls. Each level adds ~1 character height of vertical spacing.',
  category: 'minigame',
  minigameId: 'code-runner',
  costResource: 'technique',
  baseCost: '10',
  maxLevel: 0, // Unlimited
  costIncrement: '10', // +10 TP per level (10, 20, 30, 40...)
  effectType: 'wall_spacing_bonus',
  baseEffect: 0, // No base bonus (spacing already has a base from config)
  effectPerLevel: 15, // +15 pixels per level (approximately 1 character height)
};

/**
 * Overclock (Minigame - Code Runner)
 * Increases the player's movement speed in Code Runner.
 * Cost: 10 TP base, +5 TP per level (10, 15, 20, 25...)
 */
const overclockUpgrade: MinigameUpgrade = {
  id: 'overclock',
  name: 'Overclock',
  description: 'Overclocks your processor for faster reflexes. Each level increases move speed.',
  category: 'minigame',
  minigameId: 'code-runner',
  costResource: 'technique',
  baseCost: '10',
  maxLevel: 0, // Unlimited
  costIncrement: '5', // +5 TP per level (10, 15, 20, 25...)
  effectType: 'move_speed_bonus',
  baseEffect: 0, // No base bonus (speed already has a base from config)
  effectPerLevel: 25, // +25 pixels/sec per level (roughly 10% of base 250)
};

/**
 * Central Router (Minigame - Code Runner)
 * Biases gap positions toward the center of the screen.
 * Cost: 100 TP base, +50 TP per level (100, 150, 200...)
 */
const centralRouterUpgrade: MinigameUpgrade = {
  id: 'central-router',
  name: 'Central Router',
  description: 'Routes data packets through central channels, making gaps appear closer to the middle.',
  category: 'minigame',
  minigameId: 'code-runner',
  costResource: 'technique',
  baseCost: '100',
  maxLevel: 3,
  costIncrement: '50', // +50 TP per level (100, 150, 200)
  effectType: 'center_bias',
  baseEffect: 0.3, // Base bias strength at level 1
  effectPerLevel: 0.3, // +0.3 per level (0.3, 0.6, 0.9)
};

// ----------------------------------------------------------------------------
// Code Breaker Minigame Upgrades
// ----------------------------------------------------------------------------

/**
 * Timing Exploit (Minigame - Code Breaker)
 * Adds bonus time to the per-code timer.
 * Cost: 10 TP base, +10 TP per level (10, 20, 30, 40...)
 */
const timingExploitUpgrade: MinigameUpgrade = {
  id: 'timing-exploit',
  name: 'Timing Exploit',
  description: 'Exploits clock synchronization flaws to buy more time for each code',
  category: 'minigame',
  minigameId: 'code-breaker',
  costResource: 'technique',
  baseCost: '10',
  maxLevel: 10,
  costIncrement: '10', // +10 TP per level (10, 20, 30, 40...)
  effectType: 'time_bonus',
  baseEffect: 500, // 500ms base at level 1
  effectPerLevel: 500, // +500ms per level
};

/**
 * Entropy Reducer (Minigame - Code Breaker)
 * Reduces the starting code length so codes start shorter.
 * Cost: 100 TP base, +100 TP per level (100, 200, 300, 400)
 */
const entropyReducerUpgrade: MinigameUpgrade = {
  id: 'entropy-reducer',
  name: 'Entropy Reducer',
  description: 'Pre-analyzes encryption patterns so codes start shorter — fewer letters to crack',
  category: 'minigame',
  minigameId: 'code-breaker',
  costResource: 'technique',
  baseCost: '100',
  maxLevel: 4,
  costIncrement: '100', // +100 TP per level (100, 200, 300, 400)
  effectType: 'code_length_reduction',
  baseEffect: 1, // 1 letter reduced at level 1
  effectPerLevel: 1, // +1 letter per level
};

// ----------------------------------------------------------------------------
// Botnet Defense Minigame Upgrades
// ----------------------------------------------------------------------------

/**
 * Payload Amplifier (Minigame - Botnet Defense)
 * Increases all weapon damage by 10% per level (additive multiplier bonus).
 * Cost: 10 TP base, +10 TP per level (10, 20, 30...)
 */
const payloadAmplifierUpgrade: MinigameUpgrade = {
  id: 'payload-amplifier',
  name: 'Payload Amplifier',
  description: 'Injects more potent payloads into your attacks \u2014 all weapons deal 10% more damage per level',
  category: 'minigame',
  minigameId: 'botnet-defense',
  costResource: 'technique',
  baseCost: '10',
  maxLevel: 10,
  costIncrement: '10', // +10 TP per level (10, 20, 30...)
  effectType: 'damage_multiplier_bonus',
  baseEffect: 0.1, // 10% at level 1
  effectPerLevel: 0.1, // +10% per level
};

/**
 * Redundant Systems (Minigame - Botnet Defense)
 * Adds extra HP to the player's network node.
 * Cost: 100 TP base, +100 TP per level (100, 200, 300...)
 */
const redundantSystemsUpgrade: MinigameUpgrade = {
  id: 'redundant-systems',
  name: 'Redundant Systems',
  description: 'Adds backup systems to your network node \u2014 each level grants one additional hit point',
  category: 'minigame',
  minigameId: 'botnet-defense',
  costResource: 'technique',
  baseCost: '100',
  maxLevel: 10,
  costIncrement: '100', // +100 TP per level (100, 200, 300...)
  effectType: 'health_bonus',
  baseEffect: 1, // 1 HP at level 1
  effectPerLevel: 1, // +1 HP per level
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
  'training-manual': trainingManualUpgrade,
  'book-summarizer': bookSummarizerUpgrade,
  'gap-expander': gapExpanderUpgrade,
  'buffer-overflow': bufferOverflowUpgrade,
  'overclock': overclockUpgrade,
  'central-router': centralRouterUpgrade,
  'timing-exploit': timingExploitUpgrade,
  'entropy-reducer': entropyReducerUpgrade,
  'payload-amplifier': payloadAmplifierUpgrade,
  'redundant-systems': redundantSystemsUpgrade,
};

/**
 * Upgrades grouped by category for UI display
 */
export const UPGRADES_BY_CATEGORY: Record<UpgradeCategory, Upgrade[]> = {
  equipment: [autoTyperUpgrade, betterKeyboardUpgrade],
  apartment: [],
  consumable: [trainingManualUpgrade],
  hardware: [bookSummarizerUpgrade],
  minigame: [gapExpanderUpgrade, bufferOverflowUpgrade, overclockUpgrade, centralRouterUpgrade, timingExploitUpgrade, entropyReducerUpgrade, payloadAmplifierUpgrade, redundantSystemsUpgrade],
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

/**
 * Get minigame upgrades for a specific minigame.
 *
 * @param minigameId - The minigame identifier
 * @returns Array of minigame upgrades for that minigame
 */
export function getMinigameUpgrades(minigameId: string): MinigameUpgrade[] {
  return UPGRADES_BY_CATEGORY.minigame
    .filter((u): u is MinigameUpgrade => u.category === 'minigame' && u.minigameId === minigameId);
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
      // Hardware upgrades stored in equipment (numeric level)
      return state.upgrades.equipment[upgradeId] ?? 0;

    case 'minigame': {
      // Minigame upgrades are stored in minigames[minigameId].upgrades
      const minigameUpgrade = upgrade as MinigameUpgrade;
      const minigameState = state.minigames[minigameUpgrade.minigameId];
      return minigameState?.upgrades[upgradeId] ?? 0;
    }

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

  // Hardware upgrades have exponential scaling on primary cost
  if (upgrade.category === 'hardware') {
    const hardware = upgrade as HardwareUpgrade;
    const multiplier = powerDecimals(hardware.costGrowthRate, level);
    return multiplyDecimals(hardware.baseCost, multiplier);
  }

  // Consumable upgrades use their growth rate (usually 1.0 for flat cost)
  if (upgrade.category === 'consumable') {
    const consumable = upgrade as ConsumableUpgrade;
    const multiplier = powerDecimals(consumable.costGrowthRate, level);
    return multiplyDecimals(consumable.baseCost, multiplier);
  }

  // Minigame upgrades have linear cost: baseCost + costIncrement * level
  if (upgrade.category === 'minigame') {
    const minigame = upgrade as MinigameUpgrade;
    const incrementTotal = multiplyDecimals(minigame.costIncrement, String(level));
    return addDecimals(minigame.baseCost, incrementTotal);
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
 * Calculate the secondary cost for a hardware upgrade at the current level.
 *
 * @param hardware - The hardware upgrade definition
 * @param level - The current level (cost is for purchasing this level)
 * @returns The secondary cost as a string
 */
export function calculateHardwareSecondaryCost(hardware: HardwareUpgrade, level: number): string {
  const multiplier = powerDecimals(hardware.secondaryCostGrowthRate, level);
  return multiplyDecimals(hardware.secondaryCost, multiplier);
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
    const secondaryCost = calculateHardwareSecondaryCost(hardwareUpgrade, getUpgradeLevel(store, upgradeId));
    if (!isGreaterOrEqual(secondaryResource, secondaryCost)) {
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
      // Hardware upgrades return their level (used for scaling effects)
      return level;
    }

    case 'minigame': {
      const mg = upgrade as MinigameUpgrade;
      return mg.baseEffect + mg.effectPerLevel * level;
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
      if (equip.effectType === 'per_code_time_bonus') {
        return `+${effect.toFixed(1)}s per code`;
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
        if (level === 0) {return 'Enables automation';}
        return `Lv${level}: +${level} TP/60s`;
      }
      return level > 0 ? `Lv${level}` : 'Not owned';
    }

    case 'minigame': {
      const mg = upgrade as MinigameUpgrade;
      if (mg.effectType === 'gap_width_bonus') {
        return level > 0 ? `+${level} gap width` : '+1 gap width';
      }
      if (mg.effectType === 'wall_spacing_bonus') {
        return level > 0 ? `+${level} wall spacing` : '+1 wall spacing';
      }
      if (mg.effectType === 'move_speed_bonus') {
        return level > 0 ? `+${level} move speed` : '+1 move speed';
      }
      if (mg.effectType === 'center_bias') {
        const pct = Math.round(effect * 100);
        return level > 0 ? `${pct}% center bias` : '30% center bias';
      }
      if (mg.effectType === 'time_bonus') {
        const seconds = effect / 1000;
        return level > 0 ? `+${seconds.toFixed(1)}s per code` : '+0.5s per code';
      }
      if (mg.effectType === 'code_length_reduction') {
        return level > 0 ? `-${effect} starting length` : '-1 starting length';
      }
      if (mg.effectType === 'damage_multiplier_bonus') {
        const pct = Math.round(effect * 100);
        return level > 0 ? `+${pct}% damage` : '+10% damage';
      }
      if (mg.effectType === 'health_bonus') {
        return level > 0 ? `+${effect} HP` : '+1 HP';
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
 * Get the total per-code time bonus from all upgrades.
 * This is the extra seconds added to each code attempt in Code Breaker.
 *
 * @param store - The game store
 * @returns The bonus seconds to add to per-code time limit
 */
export function getPerCodeTimeBonus(store: GameStore): number {
  // Currently only better-keyboard provides this, but sum all per_code_time_bonus
  // equipment upgrades for future extensibility
  let total = 0;
  for (const upgrade of UPGRADES_BY_CATEGORY.equipment) {
    const equip = upgrade as EquipmentUpgrade;
    if (equip.effectType === 'per_code_time_bonus') {
      total += getUpgradeEffect(store, equip.id);
    }
  }
  return total;
}

/**
 * Get the total minigame time bonus from all upgrades.
 * Currently returns 0 as the coffee-machine upgrade has been removed.
 * Kept for API compatibility with callers (e.g., CodeBreakerScene).
 *
 * @param _store - The game store (unused)
 * @returns The bonus seconds to add to minigame time limits (always 0)
 */
export function getMinigameTimeBonus(_store: GameStore): number {
  return 0;
}

/**
 * Get the Code Runner gap width bonus from upgrades.
 *
 * @param store - The game store
 * @returns The bonus pixels to add to gap width
 */
export function getGapWidthBonus(store: GameStore): number {
  return getUpgradeEffect(store, 'gap-expander');
}

/**
 * Get the Code Runner wall spacing bonus from upgrades.
 *
 * @param store - The game store
 * @returns The bonus pixels to add to vertical wall spacing
 */
export function getWallSpacingBonus(store: GameStore): number {
  return getUpgradeEffect(store, 'buffer-overflow');
}

/**
 * Get the Code Runner move speed bonus from upgrades.
 *
 * @param store - The game store
 * @returns The bonus pixels/sec to add to player move speed
 */
export function getMoveSpeedBonus(store: GameStore): number {
  return getUpgradeEffect(store, 'overclock');
}

/**
 * Get the Code Runner center bias strength from upgrades.
 * 0 = fully random gap positions, 0.9 = strongly center-biased.
 *
 * @param store - The game store
 * @returns The center bias strength (0 to 1 scale)
 */
export function getCenterBiasStrength(store: GameStore): number {
  return getUpgradeEffect(store, 'central-router');
}

/**
 * Get the Code Breaker time bonus from the Timing Exploit upgrade.
 * Returns the bonus in milliseconds.
 *
 * @param store - The game store
 * @returns The bonus time in milliseconds
 */
export function getTimeBonusMs(store: GameStore): number {
  return getUpgradeEffect(store, 'timing-exploit');
}

/**
 * Get the Code Breaker code length reduction from the Entropy Reducer upgrade.
 * Returns the number of characters to reduce from starting code length.
 *
 * @param store - The game store
 * @returns The number of characters to reduce
 */
export function getCodeLengthReduction(store: GameStore): number {
  return getUpgradeEffect(store, 'entropy-reducer');
}

/**
 * Get the Botnet Defense damage multiplier bonus from the Payload Amplifier upgrade.
 * Returns the ADDITIONAL multiplier (not total). E.g., 0.3 means +30% damage.
 *
 * @param store - The game store
 * @returns The additional damage multiplier bonus (0 if no levels purchased)
 */
export function getDamageMultBonus(store: GameStore): number {
  return getUpgradeEffect(store, 'payload-amplifier');
}

/**
 * Get the Botnet Defense health bonus from the Redundant Systems upgrade.
 * Returns the number of extra HP to add to the player.
 *
 * @param store - The game store
 * @returns The number of bonus HP (0 if no levels purchased)
 */
export function getHealthBonus(store: GameStore): number {
  return getUpgradeEffect(store, 'redundant-systems');
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

  // For hardware upgrades, also deduct secondary cost (calculated at current level before purchase)
  if (upgrade.category === 'hardware') {
    const hardwareUpgrade = upgrade as HardwareUpgrade;
    const currentLevel = getUpgradeLevel(store, upgradeId);
    const secondaryCost = calculateHardwareSecondaryCost(hardwareUpgrade, currentLevel);
    const secondarySuccess = state.subtractResource(
      hardwareUpgrade.secondaryCostResource,
      secondaryCost
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
      // Hardware upgrades stored in equipment (numeric level)
      const hardwareUpgrade = upgrade as HardwareUpgrade;
      const prevLevel = getUpgradeLevel(store, upgradeId);
      state.purchaseEquipmentUpgrade(upgradeId);
      // Enable automation on first purchase (level 0 -> 1)
      if (prevLevel === 0 && hardwareUpgrade.automationId) {
        state.enableAutomation(hardwareUpgrade.automationId);
      }
      break;
    }

    case 'minigame': {
      // Minigame upgrades are stored in minigames[minigameId].upgrades
      const minigameUpgrade = upgrade as MinigameUpgrade;
      state.purchaseMinigameUpgrade(minigameUpgrade.minigameId, upgradeId);
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

  // Add secondary cost info for hardware upgrades (scaled by level)
  if (upgrade.category === 'hardware') {
    const hardwareUpgrade = upgrade as HardwareUpgrade;
    const secondaryCost = calculateHardwareSecondaryCost(hardwareUpgrade, level);
    displayInfo.secondaryCost = secondaryCost;
    displayInfo.secondaryCostFormatted = maxed ? 'MAX' : formatDecimal(secondaryCost);
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
