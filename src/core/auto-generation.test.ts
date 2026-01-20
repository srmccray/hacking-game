/**
 * Tests for Auto-Generation - Rate calculation function
 *
 * These tests cover the pure calculation function in auto-generation.ts.
 * Store-dependent functions are tested using the exported function with explicit parameters.
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'break_eternity.js';
import { calculateGenerationOverTime } from './auto-generation';
import { multiply } from './resource-manager';

// ============================================================================
// calculateGenerationOverTime Tests
// ============================================================================

describe('calculateGenerationOverTime', () => {
  it('should calculate generation for 1 second', () => {
    const rate = new Decimal(10);
    const result = calculateGenerationOverTime(rate, 1);
    expect(result.eq(10)).toBe(true);
  });

  it('should calculate generation for multiple seconds', () => {
    const rate = new Decimal(10);
    const result = calculateGenerationOverTime(rate, 60);
    expect(result.eq(600)).toBe(true);
  });

  it('should handle zero rate', () => {
    const rate = new Decimal(0);
    const result = calculateGenerationOverTime(rate, 100);
    expect(result.eq(0)).toBe(true);
  });

  it('should handle zero time', () => {
    const rate = new Decimal(100);
    const result = calculateGenerationOverTime(rate, 0);
    expect(result.eq(0)).toBe(true);
  });

  it('should handle fractional rates', () => {
    const rate = new Decimal(0.5);
    const result = calculateGenerationOverTime(rate, 10);
    expect(result.eq(5)).toBe(true);
  });

  it('should handle large time periods', () => {
    const rate = new Decimal(100);
    const result = calculateGenerationOverTime(rate, 3600); // 1 hour
    expect(result.eq(360000)).toBe(true);
  });

  it('should handle large rates', () => {
    const rate = new Decimal('1e10');
    const result = calculateGenerationOverTime(rate, 100);
    expect(result.eq(new Decimal('1e12'))).toBe(true);
  });
});

// ============================================================================
// Base Rate Formula Tests
// ============================================================================

describe('Base Rate Formula', () => {
  // Formula: baseRate = sum of top 5 scores / 100

  it('should calculate base rate from single score', () => {
    // If score sum is 100, rate should be 100/100 = 1 per second
    const scoreSum = new Decimal(100);
    const baseRate = scoreSum.div(100);
    expect(baseRate.eq(1)).toBe(true);
  });

  it('should calculate base rate from multiple scores', () => {
    // Scores: 100, 80, 60, 40, 20 = sum 300
    // Rate = 300/100 = 3 per second
    const scores = [100, 80, 60, 40, 20];
    const scoreSum = scores.reduce((a, b) => a + b, 0);
    const baseRate = new Decimal(scoreSum).div(100);
    expect(baseRate.eq(3)).toBe(true);
  });

  it('should calculate base rate with large scores', () => {
    // Score sum: 10000
    // Rate = 10000/100 = 100 per second
    const scoreSum = new Decimal(10000);
    const baseRate = scoreSum.div(100);
    expect(baseRate.eq(100)).toBe(true);
  });

  it('should return zero with no scores', () => {
    const scoreSum = new Decimal(0);
    const baseRate = scoreSum.div(100);
    expect(baseRate.eq(0)).toBe(true);
  });
});

// ============================================================================
// Multiplier Application Tests
// ============================================================================

describe('Multiplier Application', () => {
  // Formula: finalRate = baseRate * upgradeMultiplier

  it('should apply 1.0x multiplier (no bonus)', () => {
    const baseRate = new Decimal(10);
    const multiplier = 1.0;
    const finalRate = multiply(baseRate, multiplier);
    expect(finalRate.eq(10)).toBe(true);
  });

  it('should apply 1.25x multiplier (5 auto-typer levels)', () => {
    // 5 levels of auto-typer: 1.0 + 0.05*5 = 1.25
    const baseRate = new Decimal(10);
    const multiplier = 1.25;
    const finalRate = multiply(baseRate, multiplier);
    expect(finalRate.eq(12.5)).toBe(true);
  });

  it('should apply 1.5x multiplier (10 auto-typer levels)', () => {
    const baseRate = new Decimal(100);
    const multiplier = 1.5;
    const finalRate = multiply(baseRate, multiplier);
    expect(finalRate.eq(150)).toBe(true);
  });

  it('should apply 2.0x multiplier (20 auto-typer levels)', () => {
    const baseRate = new Decimal(50);
    const multiplier = 2.0;
    const finalRate = multiply(baseRate, multiplier);
    expect(finalRate.eq(100)).toBe(true);
  });
});

// ============================================================================
// Complete Generation Calculation Tests
// ============================================================================

describe('Complete Generation Calculation', () => {
  // Full formula: generation = (scoreSum / 100) * multiplier * seconds

  it('should calculate complete generation example 1', () => {
    // Scores: 500 total
    // Multiplier: 1.25 (5 auto-typer levels)
    // Time: 60 seconds
    // Expected: (500/100) * 1.25 * 60 = 5 * 1.25 * 60 = 375
    const scoreSum = 500;
    const multiplier = 1.25;
    const seconds = 60;

    const baseRate = new Decimal(scoreSum).div(100);
    const finalRate = multiply(baseRate, multiplier);
    const generation = multiply(finalRate, seconds);

    expect(generation.eq(375)).toBe(true);
  });

  it('should calculate complete generation example 2', () => {
    // Scores: 1000 total
    // Multiplier: 1.5 (10 auto-typer levels)
    // Time: 3600 seconds (1 hour)
    // Expected: (1000/100) * 1.5 * 3600 = 10 * 1.5 * 3600 = 54000
    const scoreSum = 1000;
    const multiplier = 1.5;
    const seconds = 3600;

    const baseRate = new Decimal(scoreSum).div(100);
    const finalRate = multiply(baseRate, multiplier);
    const generation = multiply(finalRate, seconds);

    expect(generation.eq(54000)).toBe(true);
  });

  it('should calculate offline generation (8 hours, 50% efficiency)', () => {
    // Scores: 500 total
    // Multiplier: 1.0 (no upgrades)
    // Time: 8 hours = 28800 seconds
    // Efficiency: 50%
    // Expected: (500/100) * 1.0 * 28800 * 0.5 = 5 * 28800 * 0.5 = 72000
    const scoreSum = 500;
    const multiplier = 1.0;
    const seconds = 8 * 3600;
    const efficiency = 0.5;

    const baseRate = new Decimal(scoreSum).div(100);
    const finalRate = multiply(baseRate, multiplier);
    const rawGeneration = multiply(finalRate, seconds);
    const finalGeneration = multiply(rawGeneration, efficiency);

    expect(finalGeneration.eq(72000)).toBe(true);
  });
});
