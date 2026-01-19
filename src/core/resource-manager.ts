/**
 * Resource Manager for the Hacker Incremental Game
 *
 * This module wraps break_eternity.js to provide game-specific utilities
 * for handling large numbers, formatting, and resource calculations.
 *
 * Usage:
 *   import { formatNumber, createDecimal, addResources } from '@core/resource-manager';
 *
 *   const amount = createDecimal('1000000');
 *   console.log(formatNumber(amount)); // "1.00M"
 */

import Decimal from 'break_eternity.js';
import type { ResourceType } from './types';

// ============================================================================
// Decimal Creation and Conversion
// ============================================================================

/**
 * Create a new Decimal from various input types.
 * Handles strings, numbers, and existing Decimals safely.
 */
export function createDecimal(value: string | number | Decimal): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

/**
 * Convert a Decimal to a string for storage/serialization.
 */
export function decimalToString(value: Decimal): string {
  return value.toString();
}

/**
 * Convert a string back to a Decimal.
 */
export function stringToDecimal(value: string): Decimal {
  return new Decimal(value);
}

/**
 * Check if a value is a valid Decimal representation.
 */
export function isValidDecimalString(value: string): boolean {
  try {
    new Decimal(value);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Decimal Arithmetic Operations
// ============================================================================

/**
 * Add two Decimal values.
 */
export function add(
  a: string | number | Decimal,
  b: string | number | Decimal
): Decimal {
  return createDecimal(a).add(createDecimal(b));
}

/**
 * Subtract b from a.
 */
export function subtract(
  a: string | number | Decimal,
  b: string | number | Decimal
): Decimal {
  return createDecimal(a).sub(createDecimal(b));
}

/**
 * Multiply two Decimal values.
 */
export function multiply(
  a: string | number | Decimal,
  b: string | number | Decimal
): Decimal {
  return createDecimal(a).mul(createDecimal(b));
}

/**
 * Divide a by b.
 */
export function divide(
  a: string | number | Decimal,
  b: string | number | Decimal
): Decimal {
  return createDecimal(a).div(createDecimal(b));
}

/**
 * Raise a to the power of b.
 */
export function power(
  base: string | number | Decimal,
  exponent: string | number | Decimal
): Decimal {
  return createDecimal(base).pow(createDecimal(exponent));
}

/**
 * Get the maximum of two Decimal values.
 */
export function max(
  a: string | number | Decimal,
  b: string | number | Decimal
): Decimal {
  return Decimal.max(createDecimal(a), createDecimal(b));
}

/**
 * Get the minimum of two Decimal values.
 */
export function min(
  a: string | number | Decimal,
  b: string | number | Decimal
): Decimal {
  return Decimal.min(createDecimal(a), createDecimal(b));
}

/**
 * Get the floor of a Decimal value.
 */
export function floor(value: string | number | Decimal): Decimal {
  return createDecimal(value).floor();
}

/**
 * Get the ceiling of a Decimal value.
 */
export function ceil(value: string | number | Decimal): Decimal {
  return createDecimal(value).ceil();
}

// ============================================================================
// Decimal Comparison Operations
// ============================================================================

/**
 * Check if a is greater than b.
 */
export function greaterThan(
  a: string | number | Decimal,
  b: string | number | Decimal
): boolean {
  return createDecimal(a).gt(createDecimal(b));
}

/**
 * Check if a is greater than or equal to b.
 */
export function greaterThanOrEqual(
  a: string | number | Decimal,
  b: string | number | Decimal
): boolean {
  return createDecimal(a).gte(createDecimal(b));
}

/**
 * Check if a is less than b.
 */
export function lessThan(
  a: string | number | Decimal,
  b: string | number | Decimal
): boolean {
  return createDecimal(a).lt(createDecimal(b));
}

/**
 * Check if a is less than or equal to b.
 */
export function lessThanOrEqual(
  a: string | number | Decimal,
  b: string | number | Decimal
): boolean {
  return createDecimal(a).lte(createDecimal(b));
}

/**
 * Check if two Decimal values are equal.
 */
export function equals(
  a: string | number | Decimal,
  b: string | number | Decimal
): boolean {
  return createDecimal(a).eq(createDecimal(b));
}

/**
 * Check if a Decimal is zero.
 */
export function isZero(value: string | number | Decimal): boolean {
  return createDecimal(value).eq(0);
}

/**
 * Check if a Decimal is positive (greater than zero).
 */
export function isPositive(value: string | number | Decimal): boolean {
  return createDecimal(value).gt(0);
}

/**
 * Check if a Decimal is negative (less than zero).
 */
export function isNegative(value: string | number | Decimal): boolean {
  return createDecimal(value).lt(0);
}

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Standard suffixes for number formatting.
 * Goes from K (thousand) through very large numbers.
 */
const NUMBER_SUFFIXES = [
  '', // 10^0 - 10^2
  'K', // 10^3 - Thousand
  'M', // 10^6 - Million
  'B', // 10^9 - Billion
  'T', // 10^12 - Trillion
  'Qa', // 10^15 - Quadrillion
  'Qi', // 10^18 - Quintillion
  'Sx', // 10^21 - Sextillion
  'Sp', // 10^24 - Septillion
  'Oc', // 10^27 - Octillion
  'No', // 10^30 - Nonillion
  'Dc', // 10^33 - Decillion
  'UDc', // 10^36 - Undecillion
  'DDc', // 10^39 - Duodecillion
  'TDc', // 10^42 - Tredecillion
  'QaDc', // 10^45 - Quattuordecillion
  'QiDc', // 10^48 - Quindecillion
  'SxDc', // 10^51 - Sexdecillion
  'SpDc', // 10^54 - Septendecillion
  'OcDc', // 10^57 - Octodecillion
  'NoDc', // 10^60 - Novemdecillion
  'Vg', // 10^63 - Vigintillion
];

/**
 * Format a Decimal number for display with appropriate suffix.
 *
 * Examples:
 *   formatNumber(1234) -> "1,234"
 *   formatNumber(1234567) -> "1.23M"
 *   formatNumber(1.5e15) -> "1.50Qa"
 *
 * For very large numbers beyond suffixes, uses scientific notation.
 *
 * @param value - The number to format
 * @param precision - Number of decimal places (default: 2)
 * @returns Formatted string representation
 */
export function formatNumber(
  value: string | number | Decimal,
  precision: number = 2
): string {
  const decimal = createDecimal(value);

  // Handle zero
  if (decimal.eq(0)) {
    return '0';
  }

  // Handle negative numbers
  if (decimal.lt(0)) {
    return '-' + formatNumber(decimal.neg(), precision);
  }

  // For small numbers (< 1000), show with commas
  if (decimal.lt(1000)) {
    const num = decimal.toNumber();
    if (Number.isInteger(num)) {
      return num.toLocaleString('en-US');
    }
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: precision,
    });
  }

  // Calculate which suffix to use
  const exponent = decimal.exponent;
  const suffixIndex = Math.floor(exponent / 3);

  // If we have a suffix for this magnitude, use it
  if (suffixIndex < NUMBER_SUFFIXES.length) {
    const suffix = NUMBER_SUFFIXES[suffixIndex];
    const divisor = new Decimal(10).pow(suffixIndex * 3);
    const mantissa = decimal.div(divisor).toNumber();

    return mantissa.toFixed(precision) + suffix;
  }

  // For very large numbers, use scientific notation
  return formatScientific(decimal, precision);
}

/**
 * Format a number in scientific notation.
 *
 * @param value - The number to format
 * @param precision - Number of decimal places for mantissa (default: 2)
 * @returns Scientific notation string (e.g., "1.23e100")
 */
export function formatScientific(
  value: string | number | Decimal,
  precision: number = 2
): string {
  const decimal = createDecimal(value);

  if (decimal.eq(0)) {
    return '0';
  }

  const exponent = Math.floor(decimal.log10().toNumber());
  const mantissa = decimal.div(new Decimal(10).pow(exponent)).toNumber();

  return `${mantissa.toFixed(precision)}e${exponent}`;
}

/**
 * Format a number as a percentage.
 *
 * @param value - The decimal value (e.g., 0.15 for 15%)
 * @param precision - Number of decimal places (default: 0)
 * @returns Percentage string (e.g., "15%")
 */
export function formatPercent(
  value: string | number | Decimal,
  precision: number = 0
): string {
  const decimal = createDecimal(value);
  const percentage = decimal.mul(100).toNumber();

  return percentage.toFixed(precision) + '%';
}

/**
 * Format a resource value with its type for display.
 *
 * @param type - The resource type
 * @param value - The amount
 * @returns Formatted string with resource symbol
 */
export function formatResource(
  type: ResourceType,
  value: string | number | Decimal
): string {
  const formatted = formatNumber(value);

  switch (type) {
    case 'money':
      return `$${formatted}`;
    case 'technique':
      return `${formatted} TP`;
    case 'renown':
      return `${formatted} RP`;
    default:
      return formatted;
  }
}

/**
 * Format a per-second rate for display.
 *
 * @param value - The rate per second
 * @returns Formatted string (e.g., "1.23K/sec")
 */
export function formatRate(value: string | number | Decimal): string {
  return `${formatNumber(value)}/sec`;
}

// ============================================================================
// Cost and Multiplier Calculations
// ============================================================================

/**
 * Calculate the cost of an upgrade at a given level using exponential scaling.
 *
 * Formula: baseCost * (growthRate ^ level)
 *
 * @param baseCost - The cost at level 0
 * @param growthRate - The multiplier per level (e.g., 1.15 for 15% increase)
 * @param level - Current level (0-indexed)
 * @returns The cost for purchasing the next level
 */
export function calculateCost(
  baseCost: string | number | Decimal,
  growthRate: string | number | Decimal,
  level: number
): Decimal {
  const base = createDecimal(baseCost);
  const rate = createDecimal(growthRate);

  return base.mul(rate.pow(level));
}

/**
 * Calculate the total cost to buy multiple levels at once.
 *
 * Uses geometric series sum: baseCost * (1 - growthRate^levels) / (1 - growthRate)
 *
 * @param baseCost - The base cost at level 0
 * @param growthRate - The multiplier per level
 * @param currentLevel - Current level
 * @param levelsToBuy - Number of levels to purchase
 * @returns Total cost for all levels
 */
export function calculateBulkCost(
  baseCost: string | number | Decimal,
  growthRate: string | number | Decimal,
  currentLevel: number,
  levelsToBuy: number
): Decimal {
  if (levelsToBuy <= 0) {
    return createDecimal(0);
  }

  const base = createDecimal(baseCost);
  const rate = createDecimal(growthRate);

  // Cost of first level being purchased
  const startCost = base.mul(rate.pow(currentLevel));

  // If growth rate is 1, it's just startCost * levelsToBuy
  if (rate.eq(1)) {
    return startCost.mul(levelsToBuy);
  }

  // Geometric series: startCost * (1 - rate^levels) / (1 - rate)
  const rateToLevels = rate.pow(levelsToBuy);
  const numerator = startCost.mul(rateToLevels.sub(1));
  const denominator = rate.sub(1);

  return numerator.div(denominator);
}

/**
 * Calculate how many levels can be afforded with a given amount.
 *
 * @param baseCost - The base cost at level 0
 * @param growthRate - The multiplier per level
 * @param currentLevel - Current level
 * @param available - Available resources
 * @returns Maximum number of levels that can be purchased
 */
export function calculateAffordableLevels(
  baseCost: string | number | Decimal,
  growthRate: string | number | Decimal,
  currentLevel: number,
  available: string | number | Decimal
): number {
  const base = createDecimal(baseCost);
  const rate = createDecimal(growthRate);
  const funds = createDecimal(available);

  // Quick check: can we afford even one level?
  const firstCost = calculateCost(base, rate, currentLevel);
  if (funds.lt(firstCost)) {
    return 0;
  }

  // Binary search for maximum affordable levels
  let low = 1;
  let high = 1000; // Reasonable upper bound

  // Find an upper bound first
  while (calculateBulkCost(base, rate, currentLevel, high).lte(funds)) {
    high *= 2;
    if (high > 1000000) break; // Safety limit
  }

  // Binary search
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    const cost = calculateBulkCost(base, rate, currentLevel, mid);

    if (cost.lte(funds)) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

/**
 * Calculate a multiplier value from a base and level.
 *
 * Formula: baseMultiplier + (bonusPerLevel * level)
 *
 * @param baseMultiplier - The base multiplier (e.g., 1.0 for 100%)
 * @param bonusPerLevel - Additional multiplier per level (e.g., 0.1 for +10%)
 * @param level - Current upgrade level
 * @returns The total multiplier
 */
export function calculateMultiplier(
  baseMultiplier: string | number | Decimal,
  bonusPerLevel: string | number | Decimal,
  level: number
): Decimal {
  const base = createDecimal(baseMultiplier);
  const bonus = createDecimal(bonusPerLevel);

  return base.add(bonus.mul(level));
}

/**
 * Calculate a compound multiplier (multiplicative stacking).
 *
 * Formula: baseMultiplier * (growthPerLevel ^ level)
 *
 * @param baseMultiplier - The base multiplier
 * @param growthPerLevel - Multiplier per level (e.g., 1.1 for +10% per level)
 * @param level - Current upgrade level
 * @returns The total multiplier
 */
export function calculateCompoundMultiplier(
  baseMultiplier: string | number | Decimal,
  growthPerLevel: string | number | Decimal,
  level: number
): Decimal {
  const base = createDecimal(baseMultiplier);
  const growth = createDecimal(growthPerLevel);

  return base.mul(growth.pow(level));
}

// ============================================================================
// Resource Helpers
// ============================================================================

/**
 * Safely subtract an amount from a resource, ensuring non-negative result.
 *
 * @param current - Current resource amount
 * @param toSubtract - Amount to subtract
 * @returns Object with success flag and new value
 */
export function safeSubtract(
  current: string | number | Decimal,
  toSubtract: string | number | Decimal
): { success: boolean; newValue: Decimal } {
  const currentDecimal = createDecimal(current);
  const subtractDecimal = createDecimal(toSubtract);

  if (currentDecimal.lt(subtractDecimal)) {
    return {
      success: false,
      newValue: currentDecimal,
    };
  }

  return {
    success: true,
    newValue: currentDecimal.sub(subtractDecimal),
  };
}

/**
 * Check if a player can afford a cost.
 *
 * @param current - Current resource amount
 * @param cost - Cost to check
 * @returns True if current >= cost
 */
export function canAfford(
  current: string | number | Decimal,
  cost: string | number | Decimal
): boolean {
  return createDecimal(current).gte(createDecimal(cost));
}

/**
 * Calculate resource generation over a time period.
 *
 * @param ratePerSecond - Generation rate per second
 * @param seconds - Time period in seconds
 * @returns Total resources generated
 */
export function calculateGeneration(
  ratePerSecond: string | number | Decimal,
  seconds: number
): Decimal {
  return createDecimal(ratePerSecond).mul(seconds);
}

/**
 * Apply an efficiency modifier to a generation rate.
 *
 * @param baseRate - Base generation rate
 * @param efficiency - Efficiency multiplier (e.g., 0.5 for 50%)
 * @returns Modified rate
 */
export function applyEfficiency(
  baseRate: string | number | Decimal,
  efficiency: string | number | Decimal
): Decimal {
  return createDecimal(baseRate).mul(createDecimal(efficiency));
}

// ============================================================================
// Constants
// ============================================================================

/** Zero as a Decimal */
export const ZERO = new Decimal(0);

/** One as a Decimal */
export const ONE = new Decimal(1);

/** Default upgrade cost growth rate (15% increase per level) */
export const DEFAULT_GROWTH_RATE = new Decimal(1.15);

/** Offline efficiency multiplier (50%) */
export const OFFLINE_EFFICIENCY = new Decimal(0.5);

/** Maximum offline time in seconds (8 hours) */
export const MAX_OFFLINE_SECONDS = 8 * 60 * 60;

// ============================================================================
// Re-export Decimal class for direct usage when needed
// ============================================================================

export { Decimal };
