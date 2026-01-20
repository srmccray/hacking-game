/**
 * Tests for Upgrades - Cost calculations and upgrade definitions
 *
 * These tests cover the pure calculation functions in upgrades.ts.
 * Store-dependent functions require full store mocking and are tested separately.
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'break_eternity.js';
import {
  getUpgrade,
  getAllUpgrades,
  getUpgradesByCategory,
  UPGRADE_IDS,
  UPGRADES_BY_CATEGORY,
  calculateUpgradeCost,
} from './upgrades';

// ============================================================================
// Upgrade Registry Tests
// ============================================================================

describe('Upgrade Registry', () => {
  describe('getUpgrade', () => {
    it('should return auto-typer upgrade', () => {
      const upgrade = getUpgrade('auto-typer');
      expect(upgrade).toBeDefined();
      expect(upgrade?.id).toBe('auto-typer');
      expect(upgrade?.name).toBe('Auto-Typer');
      expect(upgrade?.category).toBe('equipment');
    });

    it('should return better-keyboard upgrade', () => {
      const upgrade = getUpgrade('better-keyboard');
      expect(upgrade).toBeDefined();
      expect(upgrade?.id).toBe('better-keyboard');
      expect(upgrade?.category).toBe('equipment');
    });

    it('should return coffee-machine upgrade', () => {
      const upgrade = getUpgrade('coffee-machine');
      expect(upgrade).toBeDefined();
      expect(upgrade?.id).toBe('coffee-machine');
      expect(upgrade?.category).toBe('apartment');
      expect(upgrade?.maxLevel).toBe(1);
    });

    it('should return skill-tutorial upgrade', () => {
      const upgrade = getUpgrade('skill-tutorial');
      expect(upgrade).toBeDefined();
      expect(upgrade?.id).toBe('skill-tutorial');
      expect(upgrade?.category).toBe('minigame');
    });

    it('should return undefined for non-existent upgrade', () => {
      const upgrade = getUpgrade('non-existent');
      expect(upgrade).toBeUndefined();
    });
  });

  describe('getAllUpgrades', () => {
    it('should return all upgrades', () => {
      const upgrades = getAllUpgrades();
      expect(upgrades.length).toBeGreaterThan(0);
      expect(upgrades.length).toBe(UPGRADE_IDS.length);
    });

    it('should include all MVP upgrades', () => {
      const upgrades = getAllUpgrades();
      const ids = upgrades.map((u) => u.id);
      expect(ids).toContain('auto-typer');
      expect(ids).toContain('better-keyboard');
      expect(ids).toContain('coffee-machine');
      expect(ids).toContain('skill-tutorial');
    });
  });

  describe('getUpgradesByCategory', () => {
    it('should return equipment upgrades', () => {
      const upgrades = getUpgradesByCategory('equipment');
      expect(upgrades.length).toBeGreaterThan(0);
      expect(upgrades.every((u) => u.category === 'equipment')).toBe(true);
    });

    it('should return apartment upgrades', () => {
      const upgrades = getUpgradesByCategory('apartment');
      expect(upgrades.length).toBeGreaterThan(0);
      expect(upgrades.every((u) => u.category === 'apartment')).toBe(true);
    });

    it('should return minigame upgrades', () => {
      const upgrades = getUpgradesByCategory('minigame');
      expect(upgrades.length).toBeGreaterThan(0);
      expect(upgrades.every((u) => u.category === 'minigame')).toBe(true);
    });

    it('should match UPGRADES_BY_CATEGORY', () => {
      expect(getUpgradesByCategory('equipment')).toEqual(UPGRADES_BY_CATEGORY.equipment);
      expect(getUpgradesByCategory('apartment')).toEqual(UPGRADES_BY_CATEGORY.apartment);
      expect(getUpgradesByCategory('minigame')).toEqual(UPGRADES_BY_CATEGORY.minigame);
    });
  });

  describe('UPGRADE_IDS', () => {
    it('should contain all upgrade IDs', () => {
      expect(UPGRADE_IDS).toContain('auto-typer');
      expect(UPGRADE_IDS).toContain('better-keyboard');
      expect(UPGRADE_IDS).toContain('coffee-machine');
      expect(UPGRADE_IDS).toContain('skill-tutorial');
    });
  });
});

// ============================================================================
// Upgrade Definition Tests
// ============================================================================

describe('Upgrade Definitions', () => {
  describe('auto-typer upgrade', () => {
    it('should have correct properties', () => {
      const upgrade = getUpgrade('auto-typer');
      expect(upgrade?.baseCost).toBe('100');
      expect(upgrade?.costResource).toBe('money');
      expect(upgrade?.maxLevel).toBe(0); // Unlimited
    });

    it('should have equipment-specific properties', () => {
      const upgrade = getUpgrade('auto-typer');
      if (upgrade?.category === 'equipment') {
        expect(upgrade.costGrowthRate).toBe('1.15');
        expect(upgrade.effectType).toBe('auto_generation_multiplier');
        expect(upgrade.baseEffect).toBe(1.0);
        expect(upgrade.effectPerLevel).toBe(0.05);
      }
    });
  });

  describe('better-keyboard upgrade', () => {
    it('should have correct properties', () => {
      const upgrade = getUpgrade('better-keyboard');
      expect(upgrade?.baseCost).toBe('250');
      expect(upgrade?.costResource).toBe('money');
    });

    it('should have combo multiplier effect', () => {
      const upgrade = getUpgrade('better-keyboard');
      if (upgrade?.category === 'equipment') {
        expect(upgrade.effectType).toBe('combo_multiplier_bonus');
        expect(upgrade.baseEffect).toBe(0.0);
        expect(upgrade.effectPerLevel).toBe(0.1);
      }
    });
  });

  describe('coffee-machine upgrade', () => {
    it('should have correct apartment properties', () => {
      const upgrade = getUpgrade('coffee-machine');
      expect(upgrade?.category).toBe('apartment');
      expect(upgrade?.baseCost).toBe('500');
      expect(upgrade?.maxLevel).toBe(1); // One-time purchase
    });

    it('should have time bonus effect', () => {
      const upgrade = getUpgrade('coffee-machine');
      if (upgrade?.category === 'apartment') {
        expect(upgrade.effectType).toBe('minigame_time_bonus');
        expect(upgrade.effectValue).toBe(10);
      }
    });
  });

  describe('skill-tutorial upgrade', () => {
    it('should have correct minigame properties', () => {
      const upgrade = getUpgrade('skill-tutorial');
      expect(upgrade?.category).toBe('minigame');
      expect(upgrade?.baseCost).toBe('150');
    });

    it('should apply to code-breaker minigame', () => {
      const upgrade = getUpgrade('skill-tutorial');
      if (upgrade?.category === 'minigame') {
        expect(upgrade.minigameId).toBe('code-breaker');
        expect(upgrade.effectType).toBe('base_score_multiplier');
      }
    });
  });
});

// ============================================================================
// Cost Calculation Tests (Pure Function)
// ============================================================================

describe('calculateUpgradeCost', () => {
  describe('equipment upgrades (exponential scaling)', () => {
    it('should return base cost at level 0', () => {
      // Pass explicit level 0 to test pure calculation
      const cost = calculateUpgradeCost('auto-typer', 0);
      expect(cost.eq(100)).toBe(true);
    });

    it('should apply growth rate at level 1', () => {
      const cost = calculateUpgradeCost('auto-typer', 1);
      // 100 * 1.15^1 = 115
      expect(cost.toNumber()).toBeCloseTo(115, 2);
    });

    it('should apply exponential scaling at higher levels', () => {
      const cost = calculateUpgradeCost('auto-typer', 5);
      // 100 * 1.15^5 = 201.14
      expect(cost.toNumber()).toBeCloseTo(201.14, 0);
    });

    it('should handle better-keyboard costs', () => {
      const cost = calculateUpgradeCost('better-keyboard', 0);
      expect(cost.eq(250)).toBe(true);
    });
  });

  describe('apartment upgrades (fixed cost)', () => {
    it('should return base cost regardless of level', () => {
      const cost0 = calculateUpgradeCost('coffee-machine', 0);
      const cost1 = calculateUpgradeCost('coffee-machine', 1);

      expect(cost0.eq(500)).toBe(true);
      // For apartment upgrades, cost is always the base cost
      expect(cost1.eq(500)).toBe(true);
    });
  });

  describe('minigame upgrades (exponential scaling)', () => {
    it('should return base cost at level 0', () => {
      const cost = calculateUpgradeCost('skill-tutorial', 0);
      expect(cost.eq(150)).toBe(true);
    });

    it('should apply growth rate', () => {
      const cost = calculateUpgradeCost('skill-tutorial', 3);
      // 150 * 1.15^3 = 228.1
      expect(cost.toNumber()).toBeCloseTo(228.1, 0);
    });
  });

  describe('invalid upgrade', () => {
    it('should return 0 for non-existent upgrade', () => {
      const cost = calculateUpgradeCost('non-existent', 0);
      expect(cost.eq(0)).toBe(true);
    });
  });
});

// ============================================================================
// Upgrade Effect Value Tests
// ============================================================================

describe('Upgrade Effect Calculations', () => {
  describe('equipment effect formula', () => {
    it('auto-typer: baseEffect + effectPerLevel * level', () => {
      const upgrade = getUpgrade('auto-typer');
      if (upgrade?.category === 'equipment') {
        // At level 0: 1.0 + 0.05 * 0 = 1.0
        expect(upgrade.baseEffect + upgrade.effectPerLevel * 0).toBe(1.0);
        // At level 5: 1.0 + 0.05 * 5 = 1.25
        expect(upgrade.baseEffect + upgrade.effectPerLevel * 5).toBe(1.25);
        // At level 10: 1.0 + 0.05 * 10 = 1.50
        expect(upgrade.baseEffect + upgrade.effectPerLevel * 10).toBe(1.50);
      }
    });

    it('better-keyboard: starts at 0 bonus', () => {
      const upgrade = getUpgrade('better-keyboard');
      if (upgrade?.category === 'equipment') {
        // At level 0: 0.0 + 0.1 * 0 = 0.0
        expect(upgrade.baseEffect + upgrade.effectPerLevel * 0).toBe(0.0);
        // At level 3: 0.0 + 0.1 * 3 = 0.3 (use toBeCloseTo for floating point)
        expect(upgrade.baseEffect + upgrade.effectPerLevel * 3).toBeCloseTo(0.3, 10);
      }
    });
  });

  describe('apartment effect formula', () => {
    it('coffee-machine: fixed effect value', () => {
      const upgrade = getUpgrade('coffee-machine');
      if (upgrade?.category === 'apartment') {
        expect(upgrade.effectValue).toBe(10);
      }
    });
  });

  describe('minigame effect formula', () => {
    it('skill-tutorial: baseEffect + effectPerLevel * level', () => {
      const upgrade = getUpgrade('skill-tutorial');
      if (upgrade?.category === 'minigame') {
        // At level 0: 1.0 + 0.1 * 0 = 1.0
        expect(upgrade.baseEffect + upgrade.effectPerLevel * 0).toBe(1.0);
        // At level 5: 1.0 + 0.1 * 5 = 1.5
        expect(upgrade.baseEffect + upgrade.effectPerLevel * 5).toBe(1.5);
      }
    });
  });
});
