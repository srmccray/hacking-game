/**
 * Tests for Save System - Validation functions and slot metadata
 *
 * These tests cover the pure validation functions in save-system.ts.
 * localStorage-dependent functions require mocking and are tested separately.
 */

import { describe, it, expect } from 'vitest';
import {
  isValidGameState,
  MAX_SLOTS,
  getAutoSaveInterval,
  getDefaultState,
} from './save-system';
import { DEFAULT_GAME_STATE, SAVE_VERSION } from './types';

// ============================================================================
// isValidGameState Tests
// ============================================================================

describe('isValidGameState', () => {
  describe('valid states', () => {
    it('should return true for DEFAULT_GAME_STATE', () => {
      expect(isValidGameState(DEFAULT_GAME_STATE)).toBe(true);
    });

    it('should return true for a complete valid state', () => {
      const validState = {
        version: '1.0.0',
        lastSaved: Date.now(),
        lastPlayed: Date.now(),
        playerName: 'TestPlayer',
        resources: {
          money: '1000',
          technique: '50',
          renown: '10',
        },
        minigames: {
          'code-breaker': {
            unlocked: true,
            topScores: [],
            playCount: 0,
            upgrades: {},
          },
        },
        upgrades: {
          equipment: {},
          apartment: {},
        },
        settings: {
          offlineProgressEnabled: true,
        },
        stats: {
          totalPlayTime: 0,
          totalResourcesEarned: {
            money: '0',
            technique: '0',
            renown: '0',
          },
        },
      };

      expect(isValidGameState(validState)).toBe(true);
    });

    it('should return true for state with optional playerName missing', () => {
      const stateWithoutPlayerName = {
        version: '1.0.0',
        lastSaved: Date.now(),
        lastPlayed: Date.now(),
        // playerName is optional for backwards compatibility
        resources: {
          money: '0',
          technique: '0',
          renown: '0',
        },
        minigames: {},
        upgrades: {
          equipment: {},
          apartment: {},
        },
        settings: {
          offlineProgressEnabled: true,
        },
        stats: {
          totalPlayTime: 0,
          totalResourcesEarned: {
            money: '0',
            technique: '0',
            renown: '0',
          },
        },
      };

      expect(isValidGameState(stateWithoutPlayerName)).toBe(true);
    });
  });

  describe('invalid states - null and primitives', () => {
    it('should return false for null', () => {
      expect(isValidGameState(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidGameState(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isValidGameState('invalid')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isValidGameState(123)).toBe(false);
    });

    it('should return false for array', () => {
      expect(isValidGameState([1, 2, 3])).toBe(false);
    });
  });

  describe('invalid states - missing top-level fields', () => {
    const baseState = () => ({
      version: '1.0.0',
      lastSaved: Date.now(),
      lastPlayed: Date.now(),
      resources: { money: '0', technique: '0', renown: '0' },
      minigames: {},
      upgrades: { equipment: {}, apartment: {} },
      settings: { offlineProgressEnabled: true },
      stats: { totalPlayTime: 0, totalResourcesEarned: { money: '0', technique: '0', renown: '0' } },
    });

    it('should return false when version is missing', () => {
      const state = baseState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (state as any).version;
      expect(isValidGameState(state)).toBe(false);
    });

    it('should return false when version is wrong type', () => {
      const state = { ...baseState(), version: 123 };
      expect(isValidGameState(state)).toBe(false);
    });

    it('should return false when lastSaved is missing', () => {
      const state = baseState();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (state as any).lastSaved;
      expect(isValidGameState(state)).toBe(false);
    });

    it('should return false when lastSaved is wrong type', () => {
      const state = { ...baseState(), lastSaved: 'not-a-number' };
      expect(isValidGameState(state)).toBe(false);
    });

    it('should return false when lastPlayed is wrong type', () => {
      const state = { ...baseState(), lastPlayed: 'not-a-number' };
      expect(isValidGameState(state)).toBe(false);
    });

    it('should return false when playerName is wrong type', () => {
      const state = { ...baseState(), playerName: 123 };
      expect(isValidGameState(state)).toBe(false);
    });
  });

  describe('invalid states - resources validation', () => {
    const baseState = () => ({
      version: '1.0.0',
      lastSaved: Date.now(),
      lastPlayed: Date.now(),
      minigames: {},
      upgrades: { equipment: {}, apartment: {} },
      settings: { offlineProgressEnabled: true },
      stats: { totalPlayTime: 0, totalResourcesEarned: { money: '0', technique: '0', renown: '0' } },
    });

    it('should return false when resources is missing', () => {
      expect(isValidGameState(baseState())).toBe(false);
    });

    it('should return false when resources is null', () => {
      const state = { ...baseState(), resources: null };
      expect(isValidGameState(state)).toBe(false);
    });

    it('should return false when resources.money is missing', () => {
      const state = {
        ...baseState(),
        resources: { technique: '0', renown: '0' },
      };
      expect(isValidGameState(state)).toBe(false);
    });

    it('should return false when resources.money is wrong type', () => {
      const state = {
        ...baseState(),
        resources: { money: 1000, technique: '0', renown: '0' },
      };
      expect(isValidGameState(state)).toBe(false);
    });

    it('should return false when resources.technique is wrong type', () => {
      const state = {
        ...baseState(),
        resources: { money: '0', technique: 50, renown: '0' },
      };
      expect(isValidGameState(state)).toBe(false);
    });

    it('should return false when resources.renown is wrong type', () => {
      const state = {
        ...baseState(),
        resources: { money: '0', technique: '0', renown: 10 },
      };
      expect(isValidGameState(state)).toBe(false);
    });
  });

  describe('invalid states - upgrades validation', () => {
    const baseState = () => ({
      version: '1.0.0',
      lastSaved: Date.now(),
      lastPlayed: Date.now(),
      resources: { money: '0', technique: '0', renown: '0' },
      minigames: {},
      settings: { offlineProgressEnabled: true },
      stats: { totalPlayTime: 0, totalResourcesEarned: { money: '0', technique: '0', renown: '0' } },
    });

    it('should return false when upgrades is missing', () => {
      expect(isValidGameState(baseState())).toBe(false);
    });

    it('should return false when upgrades.equipment is missing', () => {
      const state = { ...baseState(), upgrades: { apartment: {} } };
      expect(isValidGameState(state)).toBe(false);
    });

    it('should return false when upgrades.apartment is missing', () => {
      const state = { ...baseState(), upgrades: { equipment: {} } };
      expect(isValidGameState(state)).toBe(false);
    });
  });

  describe('invalid states - settings validation', () => {
    const baseState = () => ({
      version: '1.0.0',
      lastSaved: Date.now(),
      lastPlayed: Date.now(),
      resources: { money: '0', technique: '0', renown: '0' },
      minigames: {},
      upgrades: { equipment: {}, apartment: {} },
      stats: { totalPlayTime: 0, totalResourcesEarned: { money: '0', technique: '0', renown: '0' } },
    });

    it('should return false when settings is missing', () => {
      expect(isValidGameState(baseState())).toBe(false);
    });

    it('should return false when offlineProgressEnabled is wrong type', () => {
      const state = {
        ...baseState(),
        settings: { offlineProgressEnabled: 'true' },
      };
      expect(isValidGameState(state)).toBe(false);
    });
  });

  describe('invalid states - stats validation', () => {
    const baseState = () => ({
      version: '1.0.0',
      lastSaved: Date.now(),
      lastPlayed: Date.now(),
      resources: { money: '0', technique: '0', renown: '0' },
      minigames: {},
      upgrades: { equipment: {}, apartment: {} },
      settings: { offlineProgressEnabled: true },
    });

    it('should return false when stats is missing', () => {
      expect(isValidGameState(baseState())).toBe(false);
    });

    it('should return false when stats.totalPlayTime is wrong type', () => {
      const state = {
        ...baseState(),
        stats: {
          totalPlayTime: '1000',
          totalResourcesEarned: { money: '0', technique: '0', renown: '0' },
        },
      };
      expect(isValidGameState(state)).toBe(false);
    });

    it('should return false when stats.totalResourcesEarned is missing', () => {
      const state = {
        ...baseState(),
        stats: { totalPlayTime: 0 },
      };
      expect(isValidGameState(state)).toBe(false);
    });
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('Save System Constants', () => {
  describe('MAX_SLOTS', () => {
    it('should be 3', () => {
      expect(MAX_SLOTS).toBe(3);
    });
  });

  describe('getAutoSaveInterval', () => {
    it('should return 30 seconds in milliseconds', () => {
      expect(getAutoSaveInterval()).toBe(30_000);
    });
  });

  describe('SAVE_VERSION', () => {
    it('should be a valid semver string', () => {
      expect(SAVE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});

// ============================================================================
// getDefaultState Tests
// ============================================================================

describe('getDefaultState', () => {
  it('should return a valid game state', () => {
    const state = getDefaultState();
    expect(isValidGameState(state)).toBe(true);
  });

  it('should return a fresh copy each time', () => {
    const state1 = getDefaultState();
    const state2 = getDefaultState();
    expect(state1).not.toBe(state2);
    expect(state1).toEqual(state2);
  });

  it('should have default resources as 0', () => {
    const state = getDefaultState();
    expect(state.resources.money).toBe('0');
    expect(state.resources.technique).toBe('0');
    expect(state.resources.renown).toBe('0');
  });

  it('should have code-breaker minigame unlocked', () => {
    const state = getDefaultState();
    expect(state.minigames['code-breaker']?.unlocked).toBe(true);
  });

  it('should have offline progress enabled by default', () => {
    const state = getDefaultState();
    expect(state.settings.offlineProgressEnabled).toBe(true);
  });
});
