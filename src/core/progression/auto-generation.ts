/**
 * Auto-Generation Rate Calculator
 *
 * This module calculates the automatic resource generation rate based on
 * top minigame scores and upgrade multipliers.
 *
 * Formula per FRD:
 *   baseRate = sum of top 5 scores / scoreToRateDivisor (per second)
 *   finalRate = baseRate * upgradeMultipliers
 *
 * Usage:
 *   import { calculateAutoRate, getMoneyGenerationRate } from './auto-generation';
 *
 *   const rate = getMoneyGenerationRate(store, config); // Rate per second as string
 */

import { toDecimal, addDecimals, multiplyDecimals, divideDecimals, ZERO } from '../resources/resource-manager';
import type { GameStore } from '../state/game-store';
import type { GameConfig, AutoGenerationConfig } from '../../game/GameConfig';
import { getAllAutomations, isAutomationEnabled } from './automations';
import { getUpgradeLevel } from '../../upgrades/upgrade-definitions';

// ============================================================================
// Rate Calculation
// ============================================================================

/**
 * Calculate the base generation rate from top scores of a minigame.
 * Does not include upgrade multipliers.
 *
 * @param store - The game store
 * @param minigameId - The minigame to calculate rate for
 * @param config - Auto-generation configuration
 * @returns Base rate per second as string
 */
export function calculateBaseRateFromScores(
  store: GameStore,
  minigameId: string,
  config: AutoGenerationConfig
): string {
  const state = store.getState();
  const minigameState = state.minigames[minigameId];

  if (!minigameState || minigameState.topScores.length === 0) {
    return ZERO;
  }

  // Sum all top scores
  let scoreSum = ZERO;
  for (const score of minigameState.topScores) {
    scoreSum = addDecimals(scoreSum, score);
  }

  // Convert to per-second rate
  return divideDecimals(scoreSum, config.scoreToRateDivisor);
}

/**
 * Calculate the total auto-generation rate for money.
 * Includes all contributing minigames and upgrade multipliers.
 *
 * @param store - The game store
 * @param config - Game configuration
 * @returns Money generation rate per second as string
 */
export function getMoneyGenerationRate(store: GameStore, config: GameConfig): string {
  const autoConfig = config.autoGeneration;

  // Calculate base rate from all money-generating minigames
  let baseRate = ZERO;

  for (const minigameId of autoConfig.moneyGeneratingMinigames) {
    const minigameRate = calculateBaseRateFromScores(store, minigameId, autoConfig);
    baseRate = addDecimals(baseRate, minigameRate);
  }

  // Apply upgrade multiplier (auto-typer upgrade)
  const multiplier = getAutoGenerationMultiplier(store);

  return multiplyDecimals(baseRate, multiplier);
}

/**
 * Get the auto-generation multiplier from upgrades.
 * Currently based on 'auto-typer' equipment upgrade.
 *
 * @param store - The game store
 * @returns The multiplier (1.0 = 100%, 1.5 = 150%, etc.)
 */
export function getAutoGenerationMultiplier(store: GameStore): string {
  const state = store.getState();
  const autoTyperLevel = state.upgrades.equipment['auto-typer'] ?? 0;

  // Base effect: 1.0 (100%)
  // Per level: +0.05 (5%)
  const baseEffect = 1.0;
  const effectPerLevel = 0.05;
  const multiplier = baseEffect + effectPerLevel * autoTyperLevel;

  return String(multiplier);
}

/**
 * Get all auto-generation rates for display purposes.
 * Returns rates for all resource types.
 *
 * @param store - The game store
 * @param config - Game configuration
 * @returns Object with rates for each resource type
 */
/**
 * Resource output definition for an automation.
 * Maps automation ID to the resource it produces and the upgrade ID used for level scaling.
 * Amount per trigger = max(1, upgradeLevel) for level-scaled automations.
 */
const AUTOMATION_RESOURCE_OUTPUT: Record<string, {
  resource: 'technique' | 'renown';
  baseAmountPerTrigger: string;
  /** If set, amount per trigger is multiplied by the upgrade level */
  scalesWithUpgrade?: string;
}> = {
  'book-summarizer': { resource: 'technique', baseAmountPerTrigger: '1', scalesWithUpgrade: 'book-summarizer' },
};

export function getAllGenerationRates(store: GameStore, config: GameConfig): {
  money: string;
  technique: string;
  renown: string;
} {
  let techniqueRate = ZERO;
  let renownRate = ZERO;

  // Calculate rates from enabled automations
  const state = store.getState();
  for (const definition of getAllAutomations()) {
    // Skip if automation upgrade not purchased
    if (!isAutomationEnabled(store, definition.id)) {
      continue;
    }

    // Skip if user has toggled this automation off
    const automationState = state.automations[definition.id];
    if (!automationState?.enabled) {
      continue;
    }

    const output = AUTOMATION_RESOURCE_OUTPUT[definition.id];
    if (!output) {
      continue;
    }

    // Calculate effective amount per trigger (scaled by upgrade level if applicable)
    let amountPerTrigger = output.baseAmountPerTrigger;
    if (output.scalesWithUpgrade) {
      const level = getUpgradeLevel(store, output.scalesWithUpgrade);
      if (level > 0) {
        amountPerTrigger = multiplyDecimals(output.baseAmountPerTrigger, String(level));
      }
    }

    // Rate = amountPerTrigger / (intervalMs / 1000) => amount per second
    const intervalSeconds = String(definition.intervalMs / 1000);
    const ratePerSecond = divideDecimals(amountPerTrigger, intervalSeconds);

    if (output.resource === 'technique') {
      techniqueRate = addDecimals(techniqueRate, ratePerSecond);
    } else if (output.resource === 'renown') {
      renownRate = addDecimals(renownRate, ratePerSecond);
    }
  }

  return {
    money: getMoneyGenerationRate(store, config),
    technique: techniqueRate,
    renown: renownRate,
  };
}

/**
 * Calculate how much of a resource would be generated over a time period.
 *
 * @param ratePerSecond - Generation rate per second as string
 * @param seconds - Time period in seconds
 * @returns Total amount generated as string
 */
export function calculateGenerationOverTime(
  ratePerSecond: string,
  seconds: number
): string {
  return multiplyDecimals(ratePerSecond, seconds);
}

/**
 * Check if there is any active auto-generation.
 * Returns true if any minigame has recorded scores.
 *
 * @param store - The game store
 * @param config - Game configuration
 * @returns true if auto-generation is active
 */
export function hasActiveGeneration(store: GameStore, config: GameConfig): boolean {
  const rate = getMoneyGenerationRate(store, config);
  return toDecimal(rate).gt(0);
}

// ============================================================================
// Debug/Display Helpers
// ============================================================================

/**
 * Get a breakdown of generation rate contributions for debugging.
 *
 * @param store - The game store
 * @param config - Game configuration
 * @returns Object with breakdown of rate components
 */
export function getGenerationBreakdown(store: GameStore, config: GameConfig): {
  minigameContributions: Record<string, string>;
  baseRate: string;
  multiplier: string;
  finalRate: string;
} {
  const autoConfig = config.autoGeneration;
  const contributions: Record<string, string> = {};
  let baseRate = ZERO;

  for (const minigameId of autoConfig.moneyGeneratingMinigames) {
    const rate = calculateBaseRateFromScores(store, minigameId, autoConfig);
    contributions[minigameId] = rate;
    baseRate = addDecimals(baseRate, rate);
  }

  const multiplier = getAutoGenerationMultiplier(store);
  const finalRate = multiplyDecimals(baseRate, multiplier);

  return {
    minigameContributions: contributions,
    baseRate,
    multiplier,
    finalRate,
  };
}
