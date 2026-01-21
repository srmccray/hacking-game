/**
 * Tests for GameConfig
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'break_eternity.js';
import { DEFAULT_CONFIG, createConfig } from './GameConfig';

describe('GameConfig', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have canvas configuration', () => {
      expect(DEFAULT_CONFIG.canvas.width).toBe(800);
      expect(DEFAULT_CONFIG.canvas.height).toBe(600);
      expect(DEFAULT_CONFIG.canvas.backgroundColor).toBe(0x0a0a0a);
      expect(DEFAULT_CONFIG.canvas.containerId).toBe('game-container');
    });

    it('should have storage configuration', () => {
      expect(DEFAULT_CONFIG.storage.type).toBe('localStorage');
      expect(DEFAULT_CONFIG.storage.keyPrefix).toBe('hacker-incremental');
      expect(DEFAULT_CONFIG.storage.maxSlots).toBe(3);
    });

    it('should have gameplay configuration', () => {
      expect(DEFAULT_CONFIG.gameplay.offlineMaxSeconds).toBe(8 * 60 * 60);
      expect(DEFAULT_CONFIG.gameplay.offlineEfficiency.eq(new Decimal(0.5))).toBe(true);
      expect(DEFAULT_CONFIG.gameplay.offlineMinSecondsForModal).toBe(60);
      expect(DEFAULT_CONFIG.gameplay.autoSaveIntervalMs).toBe(30000);
      expect(DEFAULT_CONFIG.gameplay.maxDeltaMs).toBe(1000);
      expect(DEFAULT_CONFIG.gameplay.hudUpdateIntervalMs).toBe(1000);
    });

    it('should have auto-generation configuration', () => {
      expect(DEFAULT_CONFIG.autoGeneration.scoreToRateDivisor).toBe(100);
      expect(DEFAULT_CONFIG.autoGeneration.moneyGeneratingMinigames).toContain('code-breaker');
    });

    it('should have Code Breaker minigame configuration', () => {
      const codeBreaker = DEFAULT_CONFIG.minigames.codeBreaker;
      expect(codeBreaker.sequenceLength).toBe(5);
      expect(codeBreaker.timeLimitMs).toBe(60000);
      expect(codeBreaker.baseSequencePoints).toBe(100);
      expect(codeBreaker.pointsPerDigit).toBe(10);
      expect(codeBreaker.scoreToMoneyRatio).toBe(1);
      expect(codeBreaker.maxTopScores).toBe(5);
    });

    it('should have upgrade system configuration', () => {
      expect(DEFAULT_CONFIG.upgrades.defaultGrowthRate.eq(new Decimal(1.15))).toBe(true);
    });

    it('should have debug configuration', () => {
      expect(typeof DEFAULT_CONFIG.debug.enabled).toBe('boolean');
      expect(DEFAULT_CONFIG.debug.showFps).toBe(false);
      expect(DEFAULT_CONFIG.debug.showCollisionBoxes).toBe(false);
    });

    it('should have animation configuration', () => {
      expect(DEFAULT_CONFIG.animation.flashDurationMs).toBe(200);
      expect(DEFAULT_CONFIG.animation.fadeDurationMs).toBe(300);
    });
  });

  describe('createConfig', () => {
    it('should return default config when called without arguments', () => {
      const config = createConfig();

      expect(config.canvas.width).toBe(DEFAULT_CONFIG.canvas.width);
      expect(config.storage.type).toBe(DEFAULT_CONFIG.storage.type);
      expect(config.gameplay.offlineMaxSeconds).toBe(DEFAULT_CONFIG.gameplay.offlineMaxSeconds);
    });

    it('should merge partial canvas config', () => {
      const config = createConfig({
        canvas: {
          width: 1920,
          height: 1080,
          backgroundColor: 0x000000,
          containerId: 'custom-container',
        },
      });

      expect(config.canvas.width).toBe(1920);
      expect(config.canvas.height).toBe(1080);
      expect(config.canvas.backgroundColor).toBe(0x000000);
      expect(config.canvas.containerId).toBe('custom-container');
    });

    it('should merge partial storage config', () => {
      const config = createConfig({
        storage: {
          type: 'indexedDB',
          keyPrefix: 'custom-prefix',
          maxSlots: 5,
        },
      });

      expect(config.storage.type).toBe('indexedDB');
      expect(config.storage.keyPrefix).toBe('custom-prefix');
      expect(config.storage.maxSlots).toBe(5);
    });

    it('should merge partial gameplay config', () => {
      const config = createConfig({
        gameplay: {
          offlineMaxSeconds: 4 * 60 * 60,
          offlineEfficiency: new Decimal(0.75),
          offlineMinSecondsForModal: 120,
          autoSaveIntervalMs: 60000,
          maxDeltaMs: 500,
          hudUpdateIntervalMs: 500,
        },
      });

      expect(config.gameplay.offlineMaxSeconds).toBe(4 * 60 * 60);
      expect(config.gameplay.offlineEfficiency.eq(new Decimal(0.75))).toBe(true);
      expect(config.gameplay.offlineMinSecondsForModal).toBe(120);
      expect(config.gameplay.autoSaveIntervalMs).toBe(60000);
    });

    it('should merge partial minigames config', () => {
      const config = createConfig({
        minigames: {
          codeBreaker: {
            sequenceLength: 7,
            timeLimitMs: 90000,
            baseSequencePoints: 150,
            pointsPerDigit: 15,
            scoreToMoneyRatio: 2,
            maxTopScores: 10,
          },
        },
      });

      expect(config.minigames.codeBreaker.sequenceLength).toBe(7);
      expect(config.minigames.codeBreaker.timeLimitMs).toBe(90000);
      expect(config.minigames.codeBreaker.baseSequencePoints).toBe(150);
      expect(config.minigames.codeBreaker.maxTopScores).toBe(10);
    });

    it('should merge partial debug config', () => {
      const config = createConfig({
        debug: {
          enabled: true,
          showFps: true,
          showCollisionBoxes: true,
        },
      });

      expect(config.debug.enabled).toBe(true);
      expect(config.debug.showFps).toBe(true);
      expect(config.debug.showCollisionBoxes).toBe(true);
    });

    it('should preserve non-overridden values when merging', () => {
      const config = createConfig({
        canvas: {
          width: 1920,
          height: 600,
          backgroundColor: 0x0a0a0a,
          containerId: 'game-container',
        },
      });

      // Only width was changed
      expect(config.canvas.width).toBe(1920);
      // Height should be explicitly set, not from defaults since we provided full canvas object
      expect(config.canvas.height).toBe(600);
      // Other sections should be defaults
      expect(config.storage.maxSlots).toBe(DEFAULT_CONFIG.storage.maxSlots);
      expect(config.gameplay.offlineMaxSeconds).toBe(DEFAULT_CONFIG.gameplay.offlineMaxSeconds);
    });

    it('should handle deep merging of nested minigames config', () => {
      const config = createConfig({
        minigames: {
          codeBreaker: {
            sequenceLength: 6,
            timeLimitMs: 60000,
            baseSequencePoints: 100,
            pointsPerDigit: 10,
            scoreToMoneyRatio: 1,
            maxTopScores: 5,
          },
        },
      });

      // Changed value
      expect(config.minigames.codeBreaker.sequenceLength).toBe(6);
      // Explicitly provided values (not from defaults)
      expect(config.minigames.codeBreaker.timeLimitMs).toBe(60000);
    });
  });

  describe('configuration values validity', () => {
    it('should have positive canvas dimensions', () => {
      expect(DEFAULT_CONFIG.canvas.width).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.canvas.height).toBeGreaterThan(0);
    });

    it('should have valid offline configuration', () => {
      expect(DEFAULT_CONFIG.gameplay.offlineMaxSeconds).toBeGreaterThan(0);
      expect(DEFAULT_CONFIG.gameplay.offlineEfficiency.gte(0)).toBe(true);
      expect(DEFAULT_CONFIG.gameplay.offlineEfficiency.lte(1)).toBe(true);
      expect(DEFAULT_CONFIG.gameplay.offlineMinSecondsForModal).toBeGreaterThan(0);
    });

    it('should have valid save slots count', () => {
      expect(DEFAULT_CONFIG.storage.maxSlots).toBeGreaterThan(0);
    });

    it('should have valid auto-save interval', () => {
      expect(DEFAULT_CONFIG.gameplay.autoSaveIntervalMs).toBeGreaterThan(0);
    });

    it('should have valid minigame configuration', () => {
      const codeBreaker = DEFAULT_CONFIG.minigames.codeBreaker;
      expect(codeBreaker.sequenceLength).toBeGreaterThan(0);
      expect(codeBreaker.timeLimitMs).toBeGreaterThan(0);
      expect(codeBreaker.baseSequencePoints).toBeGreaterThan(0);
      expect(codeBreaker.maxTopScores).toBeGreaterThan(0);
    });

    it('should have valid upgrade growth rate', () => {
      expect(DEFAULT_CONFIG.upgrades.defaultGrowthRate.gt(1)).toBe(true);
    });
  });
});
