/**
 * Tests for BaseMinigame
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  BaseMinigame,
  formatTimeMMSS,
  formatCombo,
  type MinigameEventPayload,
} from './BaseMinigame';

// Concrete implementation for testing
class TestMinigame extends BaseMinigame {
  readonly id = 'test-minigame';

  // Track lifecycle calls for testing
  public startCalled = false;
  public endCalled = false;
  public updateCalled = false;
  public lastDeltaMs = 0;

  protected onStart(): void {
    this.startCalled = true;
  }

  protected onEnd(): void {
    this.endCalled = true;
  }

  protected onUpdate(deltaMs: number): void {
    this.updateCalled = true;
    this.lastDeltaMs = deltaMs;
  }

  // Expose protected methods for testing
  public testAddScore(points: number): void {
    this.addScore(points);
  }

  public testAddRawScore(points: number): void {
    this.addRawScore(points);
  }

  public testIncrementCombo(increment?: number): void {
    this.incrementCombo(increment);
  }

  public testResetCombo(): void {
    this.resetCombo();
  }

  public testSetTimeLimit(ms: number): void {
    this.setTimeLimit(ms);
  }

  public testAddTime(ms: number): void {
    this.addTime(ms);
  }

  public testEmit(event: string, payload: MinigameEventPayload): void {
    this.emit(event as any, payload);
  }
}

describe('BaseMinigame', () => {
  let game: TestMinigame;

  beforeEach(() => {
    game = new TestMinigame();
  });

  afterEach(() => {
    game.destroy();
  });

  describe('lifecycle', () => {
    it('should start in idle phase', () => {
      expect(game.phase).toBe('idle');
      expect(game.isPlaying).toBe(false);
    });

    it('should transition to playing phase on start', () => {
      game.start();

      expect(game.phase).toBe('playing');
      expect(game.isPlaying).toBe(true);
      expect(game.startCalled).toBe(true);
    });

    it('should reset state on start', () => {
      game.start();
      game.testAddScore(100);
      game.testIncrementCombo();
      game.end();

      game.start();

      expect(game.score).toBe(0);
      expect(game.combo).toBe(1);
    });

    it('should not start if already playing', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      game.start();
      game.startCalled = false;
      game.start();

      expect(game.startCalled).toBe(false);
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('should transition to ended phase on end', () => {
      game.start();
      game.end();

      expect(game.phase).toBe('ended');
      expect(game.isPlaying).toBe(false);
      expect(game.endCalled).toBe(true);
    });

    it('should not end if not playing', () => {
      game.end();

      expect(game.phase).toBe('idle');
      expect(game.endCalled).toBe(false);
    });

    it('should pause and resume correctly', () => {
      game.start();
      game.pause();

      expect(game.phase).toBe('paused');
      expect(game.isPaused).toBe(true);

      game.resume();

      expect(game.phase).toBe('playing');
      expect(game.isPaused).toBe(false);
    });

    it('should not pause if not playing', () => {
      game.pause();
      expect(game.phase).toBe('idle');
    });

    it('should not resume if not paused', () => {
      game.start();
      game.resume(); // No-op

      expect(game.phase).toBe('playing');
    });

    it('should call onUpdate during update when playing', () => {
      game.start();
      game.update(16.67);

      expect(game.updateCalled).toBe(true);
      expect(game.lastDeltaMs).toBeCloseTo(16.67);
    });

    it('should not call onUpdate when not playing', () => {
      game.update(16.67);

      expect(game.updateCalled).toBe(false);
    });

    it('should track play time during updates', () => {
      game.start();
      game.update(100);
      game.update(50);

      expect(game.playTimeMs).toBe(150);
    });
  });

  describe('scoring', () => {
    beforeEach(() => {
      game.start();
    });

    it('should add score with combo multiplier', () => {
      game.testAddScore(100);

      expect(game.score).toBe(100); // 100 * 1 combo
    });

    it('should multiply score by combo', () => {
      game.testIncrementCombo(); // combo = 2
      game.testIncrementCombo(); // combo = 3
      game.testAddScore(100);

      expect(game.score).toBe(300); // 100 * 3 combo
    });

    it('should add raw score without combo', () => {
      game.testIncrementCombo(); // combo = 2
      game.testAddRawScore(100);

      expect(game.score).toBe(100); // No multiplier
    });

    it('should emit score events', () => {
      const listener = vi.fn();
      game.on('score', listener);

      game.testAddScore(50);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          minigameId: 'test-minigame',
          data: {
            pointsAdded: 50,
            totalScore: 50,
          },
        })
      );
    });
  });

  describe('combo', () => {
    beforeEach(() => {
      game.start();
    });

    it('should increment combo', () => {
      game.testIncrementCombo();

      expect(game.combo).toBe(2);
      expect(game.successCount).toBe(1);
    });

    it('should track max combo', () => {
      game.testIncrementCombo();
      game.testIncrementCombo();
      game.testIncrementCombo();

      expect(game.maxCombo).toBe(4);
    });

    it('should reset combo to 1', () => {
      game.testIncrementCombo();
      game.testIncrementCombo();
      game.testResetCombo();

      expect(game.combo).toBe(1);
      expect(game.maxCombo).toBe(3); // Max is preserved
      expect(game.failCount).toBe(1);
    });

    it('should support custom combo increments', () => {
      game.testIncrementCombo(0.5);
      game.testIncrementCombo(0.5);

      expect(game.combo).toBe(2);
    });

    it('should emit combo events', () => {
      const listener = vi.fn();
      game.on('combo', listener);

      game.testIncrementCombo();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          minigameId: 'test-minigame',
          data: {
            combo: 2,
            isNewMax: true,
          },
        })
      );
    });

    it('should emit combo-reset events', () => {
      const listener = vi.fn();
      game.on('combo-reset', listener);

      game.testIncrementCombo();
      game.testResetCombo();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          minigameId: 'test-minigame',
        })
      );
    });

    it('should not emit combo-reset if combo is already 1', () => {
      const listener = vi.fn();
      game.on('combo-reset', listener);

      game.testResetCombo();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('timer', () => {
    it('should set time limit', () => {
      game.testSetTimeLimit(60000);

      expect(game.timeLimitMs).toBe(60000);
      expect(game.timeRemainingMs).toBe(60000);
    });

    it('should count down time during update', () => {
      game.testSetTimeLimit(60000);
      game.start();

      game.update(1000);

      expect(game.timeRemainingMs).toBe(59000);
    });

    it('should not go below zero', () => {
      game.testSetTimeLimit(1000);
      game.start();

      game.update(2000);

      expect(game.timeRemainingMs).toBe(0);
    });

    it('should emit time-warning when reaching 10 seconds or below', () => {
      const listener = vi.fn();
      game.testSetTimeLimit(15000);
      game.on('time-warning', listener);
      game.start();

      game.update(4000); // 11 seconds left
      expect(listener).not.toHaveBeenCalled();

      game.update(2000); // 9 seconds left (crossed the 10 second threshold)
      expect(listener).toHaveBeenCalled();
    });

    it('should emit time-up and end when time runs out', () => {
      const listener = vi.fn();
      game.testSetTimeLimit(1000);
      game.on('time-up', listener);
      game.start();

      game.update(1500);

      expect(listener).toHaveBeenCalled();
      expect(game.phase).toBe('ended');
    });

    it('should add bonus time', () => {
      game.testSetTimeLimit(10000);
      game.start();

      game.update(5000); // 5 seconds left
      game.testAddTime(3000);

      expect(game.timeRemainingMs).toBe(8000);
    });
  });

  describe('events', () => {
    it('should emit start event', () => {
      const listener = vi.fn();
      game.on('start', listener);

      game.start();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ minigameId: 'test-minigame' })
      );
    });

    it('should emit end event with final stats', () => {
      const listener = vi.fn();
      game.on('end', listener);

      game.start();
      game.testAddScore(100);
      game.testIncrementCombo();
      game.update(500);
      game.end();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          minigameId: 'test-minigame',
          data: expect.objectContaining({
            score: expect.any(Number),
            maxCombo: expect.any(Number),
            durationMs: expect.any(Number),
            successCount: expect.any(Number),
            failCount: expect.any(Number),
          }),
        })
      );
    });

    it('should emit pause and resume events', () => {
      const pauseListener = vi.fn();
      const resumeListener = vi.fn();
      game.on('pause', pauseListener);
      game.on('resume', resumeListener);

      game.start();
      game.pause();
      game.resume();

      expect(pauseListener).toHaveBeenCalled();
      expect(resumeListener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = game.on('start', listener);

      unsubscribe();
      game.start();

      expect(listener).not.toHaveBeenCalled();
    });

    it('should remove listener with off', () => {
      const listener = vi.fn();
      game.on('start', listener);
      game.off('start', listener);

      game.start();

      expect(listener).not.toHaveBeenCalled();
    });

    it('should clear all listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      game.on('start', listener1);
      game.on('end', listener2);

      game.clearListeners();
      game.start();
      game.end();

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('should catch errors in listeners', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badListener = vi.fn(() => {
        throw new Error('Test error');
      });
      game.on('start', badListener);

      expect(() => game.start()).not.toThrow();
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('final stats', () => {
    it('should return correct final stats', () => {
      game.start();
      game.testAddScore(100);
      game.testIncrementCombo();
      game.testIncrementCombo();
      game.testResetCombo();
      game.update(1000);
      game.end();

      const stats = game.getFinalStats();

      expect(stats).toEqual({
        score: 100,
        maxCombo: 3,
        durationMs: 1000,
        successCount: 2,
        failCount: 1,
      });
    });
  });

  describe('destroy', () => {
    it('should end game on destroy if playing', () => {
      game.start();
      game.destroy();

      expect(game.phase).toBe('ended');
      expect(game.endCalled).toBe(true);
    });

    it('should clear listeners on destroy', () => {
      const listener = vi.fn();
      game.on('start', listener);

      game.destroy();
      game = new TestMinigame();
      game.on('start', listener);
      game.start();

      // Listener was only called once (for new game)
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});

describe('formatTimeMMSS', () => {
  it('should format time correctly', () => {
    expect(formatTimeMMSS(0)).toBe('00:00');
    expect(formatTimeMMSS(1000)).toBe('00:01');
    expect(formatTimeMMSS(60000)).toBe('01:00');
    expect(formatTimeMMSS(61000)).toBe('01:01');
    expect(formatTimeMMSS(3600000)).toBe('60:00');
  });

  it('should round up to nearest second', () => {
    expect(formatTimeMMSS(100)).toBe('00:01');
    expect(formatTimeMMSS(1500)).toBe('00:02');
  });

  it('should handle negative values', () => {
    expect(formatTimeMMSS(-1000)).toBe('00:00');
  });
});

describe('formatCombo', () => {
  it('should format integer combos', () => {
    expect(formatCombo(1)).toBe('x1');
    expect(formatCombo(2)).toBe('x2');
    expect(formatCombo(10)).toBe('x10');
  });

  it('should format decimal combos', () => {
    expect(formatCombo(1.5)).toBe('x1.5');
    expect(formatCombo(2.5)).toBe('x2.5');
  });
});
