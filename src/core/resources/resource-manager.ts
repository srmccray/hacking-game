/**
 * Resource Manager
 *
 * Utilities for Decimal operations and number formatting for the Hacker Incremental Game.
 * Wraps break_eternity.js to provide game-specific helpers.
 *
 * Key patterns:
 * - All functions accept strings, numbers, or Decimals for flexibility
 * - Functions that return values for storage return strings (for JSON serialization)
 * - Functions that return values for comparison return Decimals or primitives
 *
 * Usage:
 *   import { formatDecimal, addDecimals, toDecimal } from './resource-manager';
 *
 *   const sum = addDecimals('1000', '500'); // Returns '1500'
 *   const display = formatDecimal('1500000'); // Returns '1.50M'
 */

import Decimal from 'break_eternity.js';
import type { ResourceType } from '../types';

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Input type for Decimal operations - accepts strings, numbers, or Decimals.
 */
export type DecimalInput = string | number | Decimal;

// ============================================================================
// Decimal Creation and Conversion
// ============================================================================

/**
 * Convert any valid input to a Decimal instance.
 *
 * @param value - String, number, or Decimal to convert
 * @returns Decimal instance
 */
export function toDecimal(value: DecimalInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  return new Decimal(value);
}

/**
 * Convert a Decimal to a string for storage/serialization.
 *
 * @param value - Decimal to convert
 * @returns String representation
 */
export function decimalToString(value: Decimal): string {
  return value.toString();
}

/**
 * Convert a string to a Decimal.
 * Alias for toDecimal for clarity when working with stored values.
 *
 * @param value - String representation of a Decimal
 * @returns Decimal instance
 */
export function stringToDecimal(value: string): Decimal {
  return new Decimal(value);
}

/**
 * Check if a string is a valid Decimal representation.
 *
 * @param value - String to validate
 * @returns true if the string can be parsed as a Decimal
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
// Arithmetic Operations (return strings for store compatibility)
// ============================================================================

/**
 * Add two values and return result as string.
 *
 * @param a - First operand
 * @param b - Second operand
 * @returns Sum as string
 */
export function addDecimals(a: DecimalInput, b: DecimalInput): string {
  return toDecimal(a).add(toDecimal(b)).toString();
}

/**
 * Subtract b from a and return result as string.
 *
 * @param a - Value to subtract from
 * @param b - Value to subtract
 * @returns Difference as string
 */
export function subtractDecimals(a: DecimalInput, b: DecimalInput): string {
  return toDecimal(a).sub(toDecimal(b)).toString();
}

/**
 * Multiply two values and return result as string.
 *
 * @param a - First operand
 * @param b - Second operand
 * @returns Product as string
 */
export function multiplyDecimals(a: DecimalInput, b: DecimalInput): string {
  return toDecimal(a).mul(toDecimal(b)).toString();
}

/**
 * Divide a by b and return result as string.
 *
 * @param a - Dividend
 * @param b - Divisor
 * @returns Quotient as string
 */
export function divideDecimals(a: DecimalInput, b: DecimalInput): string {
  return toDecimal(a).div(toDecimal(b)).toString();
}

/**
 * Raise a to the power of b and return result as string.
 *
 * @param base - Base value
 * @param exponent - Exponent value
 * @returns Result as string
 */
export function powerDecimals(base: DecimalInput, exponent: DecimalInput): string {
  return toDecimal(base).pow(toDecimal(exponent)).toString();
}

/**
 * Get the maximum of two values as string.
 *
 * @param a - First value
 * @param b - Second value
 * @returns Maximum value as string
 */
export function maxDecimals(a: DecimalInput, b: DecimalInput): string {
  return Decimal.max(toDecimal(a), toDecimal(b)).toString();
}

/**
 * Get the minimum of two values as string.
 *
 * @param a - First value
 * @param b - Second value
 * @returns Minimum value as string
 */
export function minDecimals(a: DecimalInput, b: DecimalInput): string {
  return Decimal.min(toDecimal(a), toDecimal(b)).toString();
}

/**
 * Get the floor of a value as string.
 *
 * @param value - Value to floor
 * @returns Floored value as string
 */
export function floorDecimal(value: DecimalInput): string {
  return toDecimal(value).floor().toString();
}

/**
 * Get the ceiling of a value as string.
 *
 * @param value - Value to ceil
 * @returns Ceiled value as string
 */
export function ceilDecimal(value: DecimalInput): string {
  return toDecimal(value).ceil().toString();
}

// ============================================================================
// Comparison Operations
// ============================================================================

/**
 * Check if a is greater than b.
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if a > b
 */
export function isGreaterThan(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).gt(toDecimal(b));
}

/**
 * Check if a is greater than or equal to b.
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if a >= b
 */
export function isGreaterOrEqual(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).gte(toDecimal(b));
}

/**
 * Check if a is less than b.
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if a < b
 */
export function isLessThan(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).lt(toDecimal(b));
}

/**
 * Check if a is less than or equal to b.
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if a <= b
 */
export function isLessOrEqual(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).lte(toDecimal(b));
}

/**
 * Check if two values are equal.
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if a == b
 */
export function isEqual(a: DecimalInput, b: DecimalInput): boolean {
  return toDecimal(a).eq(toDecimal(b));
}

/**
 * Check if a value is zero.
 *
 * @param value - Value to check
 * @returns true if value == 0
 */
export function isZero(value: DecimalInput): boolean {
  return toDecimal(value).eq(0);
}

/**
 * Check if a value is positive (greater than zero).
 *
 * @param value - Value to check
 * @returns true if value > 0
 */
export function isPositive(value: DecimalInput): boolean {
  return toDecimal(value).gt(0);
}

/**
 * Check if a value is negative (less than zero).
 *
 * @param value - Value to check
 * @returns true if value < 0
 */
export function isNegative(value: DecimalInput): boolean {
  return toDecimal(value).lt(0);
}

// ============================================================================
// Number Formatting
// ============================================================================

/**
 * Standard suffixes for number formatting.
 * Covers from K (thousand) through Vigintillion.
 */
const NUMBER_SUFFIXES = [
  '',     // 10^0 - 10^2
  'K',    // 10^3 - Thousand
  'M',    // 10^6 - Million
  'B',    // 10^9 - Billion
  'T',    // 10^12 - Trillion
  'Qa',   // 10^15 - Quadrillion
  'Qi',   // 10^18 - Quintillion
  'Sx',   // 10^21 - Sextillion
  'Sp',   // 10^24 - Septillion
  'Oc',   // 10^27 - Octillion
  'No',   // 10^30 - Nonillion
  'Dc',   // 10^33 - Decillion
  'UDc',  // 10^36 - Undecillion
  'DDc',  // 10^39 - Duodecillion
  'TDc',  // 10^42 - Tredecillion
  'QaDc', // 10^45 - Quattuordecillion
  'QiDc', // 10^48 - Quindecillion
  'SxDc', // 10^51 - Sexdecillion
  'SpDc', // 10^54 - Septendecillion
  'OcDc', // 10^57 - Octodecillion
  'NoDc', // 10^60 - Novemdecillion
  'Vg',   // 10^63 - Vigintillion
] as const;

/**
 * Format a Decimal number for display with appropriate suffix.
 *
 * Examples:
 *   formatDecimal(1234) -> "1,234"
 *   formatDecimal(1234567) -> "1.23M"
 *   formatDecimal(1.5e15) -> "1.50Qa"
 *
 * For very large numbers beyond suffixes, uses scientific notation.
 *
 * @param value - The number to format
 * @param precision - Number of decimal places (default: 2)
 * @returns Formatted string representation
 */
export function formatDecimal(value: DecimalInput, precision: number = 2): string {
  const decimal = toDecimal(value);

  // Handle zero
  if (decimal.eq(0)) {
    return '0';
  }

  // Handle negative numbers
  if (decimal.lt(0)) {
    return '-' + formatDecimal(decimal.neg(), precision);
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
export function formatScientific(value: DecimalInput, precision: number = 2): string {
  const decimal = toDecimal(value);

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
export function formatPercent(value: DecimalInput, precision: number = 0): string {
  const decimal = toDecimal(value);
  const percentage = decimal.mul(100).toNumber();

  return percentage.toFixed(precision) + '%';
}

/**
 * Format a resource value with its type symbol for display.
 *
 * @param resource - The resource type
 * @param value - The amount
 * @returns Formatted string with resource symbol (e.g., "$1.23M")
 */
export function formatResource(resource: ResourceType, value: DecimalInput): string {
  const formatted = formatDecimal(value);

  switch (resource) {
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
export function formatRate(value: DecimalInput): string {
  return `${formatDecimal(value)}/sec`;
}

/**
 * Format time duration in a human-readable format.
 *
 * @param seconds - Time in seconds
 * @returns Human readable string (e.g., "2h 30m 15s")
 */
export function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (secs > 0 || parts.length === 0) {
    parts.push(`${secs}s`);
  }

  return parts.join(' ');
}

// ============================================================================
// Cost and Upgrade Calculations
// ============================================================================

/**
 * Calculate the cost of an upgrade at a given level using exponential scaling.
 *
 * Formula: baseCost * (growthRate ^ level)
 *
 * @param baseCost - The cost at level 0
 * @param growthRate - The multiplier per level (e.g., 1.15 for 15% increase)
 * @param level - Current level (0-indexed)
 * @returns The cost for purchasing the next level as string
 */
export function calculateCost(
  baseCost: DecimalInput,
  growthRate: DecimalInput,
  level: number
): string {
  const base = toDecimal(baseCost);
  const rate = toDecimal(growthRate);

  return base.mul(rate.pow(level)).toString();
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
 * @returns Total cost for all levels as string
 */
export function calculateBulkCost(
  baseCost: DecimalInput,
  growthRate: DecimalInput,
  currentLevel: number,
  levelsToBuy: number
): string {
  if (levelsToBuy <= 0) {
    return '0';
  }

  const base = toDecimal(baseCost);
  const rate = toDecimal(growthRate);

  // Cost of first level being purchased
  const startCost = base.mul(rate.pow(currentLevel));

  // If growth rate is 1, it's just startCost * levelsToBuy
  if (rate.eq(1)) {
    return startCost.mul(levelsToBuy).toString();
  }

  // Geometric series: startCost * (rate^levels - 1) / (rate - 1)
  const rateToLevels = rate.pow(levelsToBuy);
  const numerator = startCost.mul(rateToLevels.sub(1));
  const denominator = rate.sub(1);

  return numerator.div(denominator).toString();
}

/**
 * Check if a player can afford a cost.
 *
 * @param current - Current resource amount
 * @param cost - Cost to check
 * @returns true if current >= cost
 */
export function canAfford(current: DecimalInput, cost: DecimalInput): boolean {
  return toDecimal(current).gte(toDecimal(cost));
}

/**
 * Calculate resource generation over a time period.
 *
 * @param ratePerSecond - Generation rate per second
 * @param seconds - Time period in seconds
 * @returns Total resources generated as string
 */
export function calculateGeneration(ratePerSecond: DecimalInput, seconds: number): string {
  return toDecimal(ratePerSecond).mul(seconds).toString();
}

/**
 * Apply an efficiency modifier to a value.
 *
 * @param value - Base value
 * @param efficiency - Efficiency multiplier (e.g., 0.5 for 50%)
 * @returns Modified value as string
 */
export function applyEfficiency(value: DecimalInput, efficiency: DecimalInput): string {
  return toDecimal(value).mul(toDecimal(efficiency)).toString();
}

/**
 * Sum an array of Decimal strings.
 *
 * @param values - Array of decimal strings to sum
 * @returns Sum as string
 */
export function sumDecimals(values: string[]): string {
  let sum = new Decimal(0);
  for (const value of values) {
    sum = sum.add(toDecimal(value));
  }
  return sum.toString();
}

// ============================================================================
// Constants
// ============================================================================

/** Zero as a string constant */
export const ZERO = '0';

/** One as a string constant */
export const ONE = '1';

// ============================================================================
// Re-export Decimal for direct use when needed
// ============================================================================

export { Decimal };
