/**
 * Resource management exports
 *
 * This module provides utilities for Decimal operations and number formatting.
 */

export {
  // Type aliases
  type DecimalInput,
  // Decimal creation and conversion
  toDecimal,
  decimalToString,
  stringToDecimal,
  isValidDecimalString,
  // Arithmetic operations (return strings)
  addDecimals,
  subtractDecimals,
  multiplyDecimals,
  divideDecimals,
  powerDecimals,
  maxDecimals,
  minDecimals,
  floorDecimal,
  ceilDecimal,
  // Comparison operations
  isGreaterThan,
  isGreaterOrEqual,
  isLessThan,
  isLessOrEqual,
  isEqual,
  isZero,
  isPositive,
  isNegative,
  // Number formatting
  formatDecimal,
  formatScientific,
  formatPercent,
  formatResource,
  formatRate,
  formatTime,
  // Cost and upgrade calculations
  calculateCost,
  calculateBulkCost,
  canAfford,
  calculateGeneration,
  applyEfficiency,
  sumDecimals,
  // Constants
  ZERO,
  ONE,
  // Re-exported Decimal class
  Decimal,
} from './resource-manager';
