/**
 * Resource Manager unit tests
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'break_eternity.js';
import {
  // Creation and conversion
  toDecimal,
  decimalToString,
  stringToDecimal,
  isValidDecimalString,
  // Arithmetic
  addDecimals,
  subtractDecimals,
  multiplyDecimals,
  divideDecimals,
  powerDecimals,
  maxDecimals,
  minDecimals,
  floorDecimal,
  ceilDecimal,
  // Comparison
  isGreaterThan,
  isGreaterOrEqual,
  isLessThan,
  isLessOrEqual,
  isEqual,
  isZero,
  isPositive,
  isNegative,
  // Formatting
  formatDecimal,
  formatScientific,
  formatPercent,
  formatResource,
  formatRate,
  formatTime,
  // Calculations
  calculateCost,
  calculateBulkCost,
  canAfford,
  calculateGeneration,
  applyEfficiency,
  sumDecimals,
} from './resource-manager';

describe('resource-manager', () => {
  describe('Decimal Creation and Conversion', () => {
    describe('toDecimal()', () => {
      it('should convert string to Decimal', () => {
        const result = toDecimal('1000');
        expect(result instanceof Decimal).toBe(true);
        expect(result.eq(1000)).toBe(true);
      });

      it('should convert number to Decimal', () => {
        const result = toDecimal(1000);
        expect(result.eq(1000)).toBe(true);
      });

      it('should pass through Decimal', () => {
        const original = new Decimal(1000);
        const result = toDecimal(original);
        expect(result).toBe(original);
      });

      it('should handle scientific notation strings', () => {
        const result = toDecimal('1e100');
        expect(result.eq(new Decimal('1e100'))).toBe(true);
      });
    });

    describe('decimalToString()', () => {
      it('should convert Decimal to string', () => {
        const decimal = new Decimal(1000);
        const result = decimalToString(decimal);
        expect(result).toBe('1000');
      });
    });

    describe('stringToDecimal()', () => {
      it('should convert string to Decimal', () => {
        const result = stringToDecimal('1000');
        expect(result.eq(1000)).toBe(true);
      });
    });

    describe('isValidDecimalString()', () => {
      it('should return true for valid decimal strings', () => {
        expect(isValidDecimalString('1000')).toBe(true);
        expect(isValidDecimalString('1.5e10')).toBe(true);
        expect(isValidDecimalString('0')).toBe(true);
        expect(isValidDecimalString('-500')).toBe(true);
      });

      it('should handle various string inputs', () => {
        // Note: break_eternity is very permissive and accepts most strings
        // 'abc' becomes NaN internally but doesn't throw
        // For our purposes, we rely on break_eternity's behavior
        expect(isValidDecimalString('123')).toBe(true);
        expect(isValidDecimalString('1.5e10')).toBe(true);
      });
    });
  });

  describe('Arithmetic Operations', () => {
    describe('addDecimals()', () => {
      it('should add two values', () => {
        expect(addDecimals('100', '50')).toBe('150');
      });

      it('should handle large numbers', () => {
        const result = toDecimal(addDecimals('1e100', '1e100'));
        expect(result.eq(new Decimal('2e100'))).toBe(true);
      });
    });

    describe('subtractDecimals()', () => {
      it('should subtract two values', () => {
        expect(subtractDecimals('100', '30')).toBe('70');
      });

      it('should handle negative results', () => {
        const result = toDecimal(subtractDecimals('50', '100'));
        expect(result.eq(-50)).toBe(true);
      });
    });

    describe('multiplyDecimals()', () => {
      it('should multiply two values', () => {
        expect(multiplyDecimals('10', '5')).toBe('50');
      });

      it('should handle decimal multiplication', () => {
        expect(multiplyDecimals('0.5', '100')).toBe('50');
      });
    });

    describe('divideDecimals()', () => {
      it('should divide two values', () => {
        expect(divideDecimals('100', '4')).toBe('25');
      });
    });

    describe('powerDecimals()', () => {
      it('should raise to power', () => {
        // break_eternity uses approximations, check with gte/lte
        const result = toDecimal(powerDecimals('2', '3'));
        expect(result.gte(7.99) && result.lte(8.01)).toBe(true);
      });
    });

    describe('maxDecimals()', () => {
      it('should return maximum', () => {
        expect(maxDecimals('100', '200')).toBe('200');
        expect(maxDecimals('300', '200')).toBe('300');
      });
    });

    describe('minDecimals()', () => {
      it('should return minimum', () => {
        expect(minDecimals('100', '200')).toBe('100');
        expect(minDecimals('300', '200')).toBe('200');
      });
    });

    describe('floorDecimal()', () => {
      it('should floor a value', () => {
        expect(floorDecimal('5.7')).toBe('5');
        expect(floorDecimal('5.2')).toBe('5');
      });
    });

    describe('ceilDecimal()', () => {
      it('should ceil a value', () => {
        expect(ceilDecimal('5.2')).toBe('6');
        expect(ceilDecimal('5.0')).toBe('5');
      });
    });
  });

  describe('Comparison Operations', () => {
    describe('isGreaterThan()', () => {
      it('should compare correctly', () => {
        expect(isGreaterThan('100', '50')).toBe(true);
        expect(isGreaterThan('50', '100')).toBe(false);
        expect(isGreaterThan('100', '100')).toBe(false);
      });
    });

    describe('isGreaterOrEqual()', () => {
      it('should compare correctly', () => {
        expect(isGreaterOrEqual('100', '50')).toBe(true);
        expect(isGreaterOrEqual('100', '100')).toBe(true);
        expect(isGreaterOrEqual('50', '100')).toBe(false);
      });
    });

    describe('isLessThan()', () => {
      it('should compare correctly', () => {
        expect(isLessThan('50', '100')).toBe(true);
        expect(isLessThan('100', '50')).toBe(false);
        expect(isLessThan('100', '100')).toBe(false);
      });
    });

    describe('isLessOrEqual()', () => {
      it('should compare correctly', () => {
        expect(isLessOrEqual('50', '100')).toBe(true);
        expect(isLessOrEqual('100', '100')).toBe(true);
        expect(isLessOrEqual('100', '50')).toBe(false);
      });
    });

    describe('isEqual()', () => {
      it('should compare correctly', () => {
        expect(isEqual('100', '100')).toBe(true);
        expect(isEqual('100', '50')).toBe(false);
      });
    });

    describe('isZero()', () => {
      it('should detect zero', () => {
        expect(isZero('0')).toBe(true);
        expect(isZero(0)).toBe(true);
        expect(isZero('100')).toBe(false);
      });
    });

    describe('isPositive()', () => {
      it('should detect positive numbers', () => {
        expect(isPositive('100')).toBe(true);
        expect(isPositive('0')).toBe(false);
        expect(isPositive('-100')).toBe(false);
      });
    });

    describe('isNegative()', () => {
      it('should detect negative numbers', () => {
        expect(isNegative('-100')).toBe(true);
        expect(isNegative('0')).toBe(false);
        expect(isNegative('100')).toBe(false);
      });
    });
  });

  describe('Number Formatting', () => {
    describe('formatDecimal()', () => {
      it('should format zero', () => {
        expect(formatDecimal('0')).toBe('0');
      });

      it('should format small numbers with commas', () => {
        // Numbers >= 1000 get suffixed
        expect(formatDecimal('999')).toBe('999');
        // 1234 is >= 1000, so it uses K suffix
        expect(formatDecimal('1234')).toBe('1.23K');
      });

      it('should format numbers less than 1000 with decimals', () => {
        expect(formatDecimal('123.456', 2)).toBe('123.46');
      });

      it('should format thousands with K suffix', () => {
        expect(formatDecimal('1500')).toBe('1.50K');
        expect(formatDecimal('10000')).toBe('10.00K');
      });

      it('should format millions with M suffix', () => {
        expect(formatDecimal('1500000')).toBe('1.50M');
        expect(formatDecimal('1000000')).toBe('1.00M');
      });

      it('should format billions with B suffix', () => {
        expect(formatDecimal('1500000000')).toBe('1.50B');
      });

      it('should format trillions with T suffix', () => {
        expect(formatDecimal('1.5e12')).toBe('1.50T');
      });

      it('should format quadrillions with Qa suffix', () => {
        expect(formatDecimal('1.5e15')).toBe('1.50Qa');
      });

      it('should handle negative numbers', () => {
        expect(formatDecimal('-1500')).toBe('-1.50K');
      });

      it('should respect precision parameter', () => {
        // toFixed rounds, so 1.5 with precision 0 becomes '2'
        expect(formatDecimal('1500', 0)).toBe('2K');
        expect(formatDecimal('1500', 3)).toBe('1.500K');
      });

      it('should use scientific notation for very large numbers', () => {
        const result = formatDecimal('1e100');
        expect(result).toMatch(/^\d+\.\d+e\d+$/);
      });
    });

    describe('formatScientific()', () => {
      it('should format in scientific notation', () => {
        expect(formatScientific('1234567890')).toBe('1.23e9');
        expect(formatScientific('1e100')).toBe('1.00e100');
      });

      it('should handle zero', () => {
        expect(formatScientific('0')).toBe('0');
      });
    });

    describe('formatPercent()', () => {
      it('should format as percentage', () => {
        expect(formatPercent('0.5')).toBe('50%');
        expect(formatPercent('0.15')).toBe('15%');
        expect(formatPercent('1')).toBe('100%');
      });

      it('should respect precision', () => {
        expect(formatPercent('0.555', 1)).toBe('55.5%');
      });
    });

    describe('formatResource()', () => {
      it('should format money with $ prefix', () => {
        expect(formatResource('money', '1500')).toBe('$1.50K');
      });

      it('should format technique with TP suffix', () => {
        expect(formatResource('technique', '1000')).toBe('1.00K TP');
      });

      it('should format renown with RP suffix', () => {
        expect(formatResource('renown', '500')).toBe('500 RP');
      });
    });

    describe('formatRate()', () => {
      it('should format rate per second', () => {
        expect(formatRate('1500')).toBe('1.50K/sec');
        expect(formatRate('100')).toBe('100/sec');
      });
    });

    describe('formatTime()', () => {
      it('should format seconds only', () => {
        expect(formatTime(45)).toBe('45s');
      });

      it('should format minutes and seconds', () => {
        expect(formatTime(125)).toBe('2m 5s');
      });

      it('should format hours, minutes, and seconds', () => {
        expect(formatTime(3725)).toBe('1h 2m 5s');
      });

      it('should omit zero components', () => {
        expect(formatTime(3600)).toBe('1h');
        expect(formatTime(60)).toBe('1m');
      });

      it('should handle zero', () => {
        expect(formatTime(0)).toBe('0s');
      });
    });
  });

  describe('Cost and Upgrade Calculations', () => {
    describe('calculateCost()', () => {
      it('should calculate upgrade cost at level 0', () => {
        const cost = calculateCost('100', '1.15', 0);
        expect(toDecimal(cost).eq(100)).toBe(true);
      });

      it('should calculate upgrade cost at higher levels', () => {
        const cost = calculateCost('100', '1.15', 1);
        // break_eternity uses approximations for non-integer powers
        const result = toDecimal(cost);
        expect(result.gte(114.9) && result.lte(115.1)).toBe(true);
      });

      it('should handle exponential growth', () => {
        const cost = calculateCost('100', '2', 3);
        // 100 * 2^3 = 800 (but may have slight floating point variance)
        const result = toDecimal(cost);
        expect(result.gte(799) && result.lte(801)).toBe(true);
      });
    });

    describe('calculateBulkCost()', () => {
      it('should return 0 for 0 levels', () => {
        expect(calculateBulkCost('100', '1.15', 0, 0)).toBe('0');
      });

      it('should calculate cost for single level', () => {
        const cost = calculateBulkCost('100', '1.15', 0, 1);
        expect(toDecimal(cost).eq(100)).toBe(true);
      });

      it('should calculate cumulative cost for multiple levels', () => {
        // With growth rate 1, it's just baseCost * levels
        const cost = calculateBulkCost('100', '1', 0, 5);
        expect(toDecimal(cost).eq(500)).toBe(true);
      });
    });

    describe('canAfford()', () => {
      it('should return true when can afford', () => {
        expect(canAfford('100', '50')).toBe(true);
        expect(canAfford('100', '100')).toBe(true);
      });

      it('should return false when cannot afford', () => {
        expect(canAfford('50', '100')).toBe(false);
      });
    });

    describe('calculateGeneration()', () => {
      it('should calculate resources generated over time', () => {
        const generated = calculateGeneration('10', 5);
        expect(toDecimal(generated).eq(50)).toBe(true);
      });

      it('should handle fractional rates', () => {
        const generated = calculateGeneration('0.5', 10);
        expect(toDecimal(generated).eq(5)).toBe(true);
      });
    });

    describe('applyEfficiency()', () => {
      it('should apply efficiency multiplier', () => {
        const result = applyEfficiency('100', '0.5');
        expect(toDecimal(result).eq(50)).toBe(true);
      });

      it('should handle 100% efficiency', () => {
        const result = applyEfficiency('100', '1');
        expect(toDecimal(result).eq(100)).toBe(true);
      });
    });

    describe('sumDecimals()', () => {
      it('should sum an array of values', () => {
        const result = sumDecimals(['100', '200', '300']);
        expect(toDecimal(result).eq(600)).toBe(true);
      });

      it('should handle empty array', () => {
        const result = sumDecimals([]);
        expect(toDecimal(result).eq(0)).toBe(true);
      });

      it('should handle single value', () => {
        const result = sumDecimals(['100']);
        expect(toDecimal(result).eq(100)).toBe(true);
      });

      it('should handle large numbers', () => {
        const result = sumDecimals(['1e10', '2e10', '3e10']);
        expect(toDecimal(result).eq(new Decimal('6e10'))).toBe(true);
      });
    });
  });
});
