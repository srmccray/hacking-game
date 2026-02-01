/**
 * GameConfig unit tests
 */

import { describe, it, expect } from 'vitest';
import Decimal from 'break_eternity.js';
import { DEFAULT_CONFIG, createConfig } from './GameConfig';

describe('GameConfig', () => {
  describe('DEFAULT_CONFIG', () => {
    it('should have correct canvas dimensions', () => {
      expect(DEFAULT_CONFIG.canvas.width).toBe(800);
      expect(DEFAULT_CONFIG.canvas.height).toBe(600);
    });

    it('should have correct storage settings', () => {
      expect(DEFAULT_CONFIG.storage.type).toBe('localStorage');
      expect(DEFAULT_CONFIG.storage.keyPrefix).toBe('hacker-incremental');
      expect(DEFAULT_CONFIG.storage.maxSlots).toBe(3);
    });

    it('should have correct gameplay settings', () => {
      expect(DEFAULT_CONFIG.gameplay.offlineMaxSeconds).toBe(8 * 60 * 60); // 8 hours
      expect(DEFAULT_CONFIG.gameplay.offlineEfficiency.toString()).toBe('0.5');
      expect(DEFAULT_CONFIG.gameplay.autoSaveIntervalMs).toBe(30000);
    });

    it('should have code breaker config', () => {
      expect(DEFAULT_CONFIG.minigames.codeBreaker.startingCodeLength).toBe(5);
      expect(DEFAULT_CONFIG.minigames.codeBreaker.perCodeTimeLimitMs).toBe(5000);
      expect(DEFAULT_CONFIG.minigames.codeBreaker.maxTopScores).toBe(5);
      expect(DEFAULT_CONFIG.minigames.codeBreaker.characterSet).toBe(
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
      );
      expect(DEFAULT_CONFIG.minigames.codeBreaker.previewDurationMs).toBe(750);
      expect(DEFAULT_CONFIG.minigames.codeBreaker.timePerExtraCharMs).toBe(300);
    });

    it('should have upgrade growth rate as Decimal', () => {
      expect(DEFAULT_CONFIG.upgrades.defaultGrowthRate).toBeInstanceOf(Decimal);
      expect(DEFAULT_CONFIG.upgrades.defaultGrowthRate.toString()).toBe('1.15');
    });
  });

  describe('createConfig()', () => {
    it('should return default config when called with no arguments', () => {
      const config = createConfig();

      expect(config.canvas.width).toBe(DEFAULT_CONFIG.canvas.width);
      expect(config.storage.keyPrefix).toBe(DEFAULT_CONFIG.storage.keyPrefix);
    });

    it('should merge partial canvas config', () => {
      const config = createConfig({
        canvas: { width: 1024 },
      });

      expect(config.canvas.width).toBe(1024);
      expect(config.canvas.height).toBe(DEFAULT_CONFIG.canvas.height);
      expect(config.canvas.backgroundColor).toBe(DEFAULT_CONFIG.canvas.backgroundColor);
    });

    it('should merge partial storage config', () => {
      const config = createConfig({
        storage: { maxSlots: 5 },
      });

      expect(config.storage.maxSlots).toBe(5);
      expect(config.storage.type).toBe(DEFAULT_CONFIG.storage.type);
    });

    it('should merge partial gameplay config', () => {
      const config = createConfig({
        gameplay: { autoSaveIntervalMs: 60000 },
      });

      expect(config.gameplay.autoSaveIntervalMs).toBe(60000);
      expect(config.gameplay.offlineMaxSeconds).toBe(DEFAULT_CONFIG.gameplay.offlineMaxSeconds);
    });

    it('should merge partial debug config', () => {
      const config = createConfig({
        debug: { enabled: true, showFps: true },
      });

      expect(config.debug.enabled).toBe(true);
      expect(config.debug.showFps).toBe(true);
      expect(config.debug.showCollisionBoxes).toBe(DEFAULT_CONFIG.debug.showCollisionBoxes);
    });

    it('should merge nested minigames config', () => {
      const config = createConfig({
        minigames: {
          codeBreaker: { startingCodeLength: 7 },
        },
      });

      expect(config.minigames.codeBreaker.startingCodeLength).toBe(7);
      expect(config.minigames.codeBreaker.perCodeTimeLimitMs).toBe(
        DEFAULT_CONFIG.minigames.codeBreaker.perCodeTimeLimitMs
      );
    });

    it('should allow overriding Decimal values', () => {
      const config = createConfig({
        gameplay: { offlineEfficiency: new Decimal(0.75) },
      });

      expect(config.gameplay.offlineEfficiency.toString()).toBe('0.75');
    });

    it('should allow overriding multiple sections', () => {
      const config = createConfig({
        canvas: { width: 1920, height: 1080 },
        debug: { enabled: true },
        movement: { speed: 300 },
      });

      expect(config.canvas.width).toBe(1920);
      expect(config.canvas.height).toBe(1080);
      expect(config.debug.enabled).toBe(true);
      expect(config.movement.speed).toBe(300);
    });

    it('should not mutate DEFAULT_CONFIG', () => {
      const originalWidth = DEFAULT_CONFIG.canvas.width;

      createConfig({
        canvas: { width: 1234 },
      });

      expect(DEFAULT_CONFIG.canvas.width).toBe(originalWidth);
    });
  });
});
