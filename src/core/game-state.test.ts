/**
 * Tests for Game State - insertScore helper and selectors
 *
 * These tests cover the pure functions and selectors in game-state.ts.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'break_eternity.js';
import { insertScore } from './game-state';
import {
  selectTopScores,
  selectResource,
  selectCanAfford,
  selectMinigameUnlocked,
  selectEquipmentLevel,
  selectMinigameUpgradeLevel,
  selectApartmentUnlocked,
  selectTotalResourceEarned,
} from './game-state';
import type { GameState } from './types';
import { DEFAULT_GAME_STATE } from './types';

// ============================================================================
// Test Fixtures
// ============================================================================

function createMockGameState(overrides?: Partial<GameState>): GameState {
  return {
    ...JSON.parse(JSON.stringify(DEFAULT_GAME_STATE)),
    ...overrides,
  } as GameState;
}

// ============================================================================
// insertScore Tests
// ============================================================================

describe('insertScore', () => {
  it('should insert a score into an empty array', () => {
    const result = insertScore([], '100');
    expect(result).toEqual(['100']);
  });

  it('should insert a higher score at the beginning', () => {
    const result = insertScore(['50', '30', '10'], '100');
    expect(result).toEqual(['100', '50', '30', '10']);
  });

  it('should insert a lower score at the end', () => {
    const result = insertScore(['100', '50', '30'], '10');
    expect(result).toEqual(['100', '50', '30', '10']);
  });

  it('should insert a middle score in the correct position', () => {
    const result = insertScore(['100', '50', '10'], '30');
    expect(result).toEqual(['100', '50', '30', '10']);
  });

  it('should limit to top 5 scores', () => {
    const result = insertScore(['100', '90', '80', '70', '60'], '95');
    expect(result).toHaveLength(5);
    expect(result).toEqual(['100', '95', '90', '80', '70']);
  });

  it('should not add a score that would be 6th or lower', () => {
    const result = insertScore(['100', '90', '80', '70', '60'], '50');
    expect(result).toHaveLength(5);
    expect(result).toEqual(['100', '90', '80', '70', '60']);
  });

  it('should handle equal scores by inserting after existing equal score', () => {
    const result = insertScore(['100', '50', '30'], '50');
    expect(result).toEqual(['100', '50', '50', '30']);
  });

  it('should handle Decimal-string comparisons correctly', () => {
    const result = insertScore(['1000', '100', '10'], '500');
    expect(result).toEqual(['1000', '500', '100', '10']);
  });

  it('should handle large numbers correctly', () => {
    const result = insertScore(['1e10', '1e8', '1e6'], '1e9');
    expect(result).toEqual(['1e10', '1e9', '1e8', '1e6']);
  });
});

// ============================================================================
// Selector Tests
// ============================================================================

describe('selectTopScores', () => {
  it('should return empty array for non-existent minigame', () => {
    const state = createMockGameState();
    const result = selectTopScores(state, 'non-existent');
    expect(result).toEqual([]);
  });

  it('should return empty array for minigame with no scores', () => {
    const state = createMockGameState();
    const result = selectTopScores(state, 'code-breaker');
    expect(result).toEqual([]);
  });

  it('should return Decimal instances for scores', () => {
    const state = createMockGameState({
      minigames: {
        'code-breaker': {
          unlocked: true,
          topScores: ['100', '50', '25'],
          playCount: 3,
          upgrades: {},
        },
      },
    });

    const result = selectTopScores(state, 'code-breaker');
    expect(result).toHaveLength(3);
    expect(result[0]).toBeInstanceOf(Decimal);
    expect(result[0]?.eq(100)).toBe(true);
    expect(result[1]?.eq(50)).toBe(true);
    expect(result[2]?.eq(25)).toBe(true);
  });
});

describe('selectResource', () => {
  it('should return Decimal for money resource', () => {
    const state = createMockGameState({
      resources: { money: '1000', technique: '50', renown: '10' },
    });

    const result = selectResource(state, 'money');
    expect(result).toBeInstanceOf(Decimal);
    expect(result.eq(1000)).toBe(true);
  });

  it('should return Decimal for technique resource', () => {
    const state = createMockGameState({
      resources: { money: '1000', technique: '50', renown: '10' },
    });

    const result = selectResource(state, 'technique');
    expect(result.eq(50)).toBe(true);
  });

  it('should return Decimal for renown resource', () => {
    const state = createMockGameState({
      resources: { money: '1000', technique: '50', renown: '10' },
    });

    const result = selectResource(state, 'renown');
    expect(result.eq(10)).toBe(true);
  });

  it('should handle zero resources', () => {
    const state = createMockGameState();
    const result = selectResource(state, 'money');
    expect(result.eq(0)).toBe(true);
  });
});

describe('selectCanAfford', () => {
  it('should return true when resource >= cost', () => {
    const state = createMockGameState({
      resources: { money: '1000', technique: '50', renown: '10' },
    });

    expect(selectCanAfford(state, 'money', '500')).toBe(true);
    expect(selectCanAfford(state, 'money', '1000')).toBe(true);
  });

  it('should return false when resource < cost', () => {
    const state = createMockGameState({
      resources: { money: '500', technique: '50', renown: '10' },
    });

    expect(selectCanAfford(state, 'money', '1000')).toBe(false);
  });

  it('should handle zero resources', () => {
    const state = createMockGameState();
    expect(selectCanAfford(state, 'money', '1')).toBe(false);
    expect(selectCanAfford(state, 'money', '0')).toBe(true);
  });
});

describe('selectMinigameUnlocked', () => {
  it('should return true for unlocked minigame', () => {
    const state = createMockGameState();
    // code-breaker is unlocked by default
    expect(selectMinigameUnlocked(state, 'code-breaker')).toBe(true);
  });

  it('should return false for non-existent minigame', () => {
    const state = createMockGameState();
    expect(selectMinigameUnlocked(state, 'non-existent')).toBe(false);
  });
});

describe('selectEquipmentLevel', () => {
  it('should return 0 for non-existent upgrade', () => {
    const state = createMockGameState();
    expect(selectEquipmentLevel(state, 'non-existent')).toBe(0);
  });

  it('should return correct level for purchased upgrade', () => {
    const state = createMockGameState({
      upgrades: {
        equipment: { 'auto-typer': 5 },
        apartment: {},
      },
    });

    expect(selectEquipmentLevel(state, 'auto-typer')).toBe(5);
  });
});

describe('selectMinigameUpgradeLevel', () => {
  it('should return 0 for non-existent minigame', () => {
    const state = createMockGameState();
    expect(selectMinigameUpgradeLevel(state, 'non-existent', 'upgrade-1')).toBe(0);
  });

  it('should return 0 for non-existent upgrade', () => {
    const state = createMockGameState();
    expect(selectMinigameUpgradeLevel(state, 'code-breaker', 'non-existent')).toBe(0);
  });

  it('should return correct level for purchased minigame upgrade', () => {
    const state = createMockGameState({
      minigames: {
        'code-breaker': {
          unlocked: true,
          topScores: [],
          playCount: 0,
          upgrades: { 'skill-tutorial': 3 },
        },
      },
    });

    expect(selectMinigameUpgradeLevel(state, 'code-breaker', 'skill-tutorial')).toBe(3);
  });
});

describe('selectApartmentUnlocked', () => {
  it('should return false for non-existent upgrade', () => {
    const state = createMockGameState();
    expect(selectApartmentUnlocked(state, 'non-existent')).toBe(false);
  });

  it('should return true for purchased apartment upgrade', () => {
    const state = createMockGameState({
      upgrades: {
        equipment: {},
        apartment: { 'coffee-machine': true },
      },
    });

    expect(selectApartmentUnlocked(state, 'coffee-machine')).toBe(true);
  });
});

describe('selectTotalResourceEarned', () => {
  it('should return Decimal for total money earned', () => {
    const state = createMockGameState({
      stats: {
        totalPlayTime: 0,
        totalResourcesEarned: { money: '5000', technique: '100', renown: '50' },
      },
    });

    const result = selectTotalResourceEarned(state, 'money');
    expect(result).toBeInstanceOf(Decimal);
    expect(result.eq(5000)).toBe(true);
  });

  it('should return zero Decimal for no earnings', () => {
    const state = createMockGameState();
    const result = selectTotalResourceEarned(state, 'money');
    expect(result.eq(0)).toBe(true);
  });
});
