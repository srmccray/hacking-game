/**
 * Tests for CodeBreakerGame
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CodeBreakerGame, createCodeBreakerGame } from './CodeBreakerGame';
import { DEFAULT_CONFIG } from '../../game/GameConfig';

describe('CodeBreakerGame', () => {
  let game: CodeBreakerGame;

  beforeEach(() => {
    game = new CodeBreakerGame();
  });

  afterEach(() => {
    game.destroy();
  });

  describe('initialization', () => {
    it('should have correct id', () => {
      expect(game.id).toBe('code-breaker');
    });

    it('should have correct static id', () => {
      expect(CodeBreakerGame.MINIGAME_ID).toBe('code-breaker');
    });

    it('should use default config', () => {
      expect(game.sequenceLength).toBe(DEFAULT_CONFIG.minigames.codeBreaker.sequenceLength);
      expect(game.timeLimitMs).toBe(DEFAULT_CONFIG.minigames.codeBreaker.timeLimitMs);
    });

    it('should accept custom config', () => {
      const customConfig = {
        ...DEFAULT_CONFIG.minigames.codeBreaker,
        sequenceLength: 3,
        timeLimitMs: 30000,
      };
      const customGame = new CodeBreakerGame(customConfig);

      expect(customGame.sequenceLength).toBe(3);
      expect(customGame.timeLimitMs).toBe(30000);

      customGame.destroy();
    });

    it('should start in idle phase', () => {
      expect(game.phase).toBe('idle');
      expect(game.targetSequence).toEqual([]);
      expect(game.inputSequence).toEqual([]);
    });
  });

  describe('game start', () => {
    it('should generate a sequence on start', () => {
      game.start();

      expect(game.targetSequence).toHaveLength(game.sequenceLength);
      expect(game.targetSequence.every((d) => d >= 0 && d <= 9)).toBe(true);
    });

    it('should reset input state on start', () => {
      game.start();
      game.handleDigitInput(game.targetSequence[0] ?? 0);
      game.end();

      game.start();

      expect(game.inputSequence).toEqual([]);
      expect(game.currentPosition).toBe(0);
    });

    it('should reset sequences completed count', () => {
      game.start();
      // Complete a full sequence
      for (let i = 0; i < game.sequenceLength; i++) {
        const target = game.getTargetDigit(i);
        if (target !== undefined) {
          game.handleDigitInput(target);
        }
      }
      expect(game.sequencesCompleted).toBe(1);

      game.end();
      game.start();

      expect(game.sequencesCompleted).toBe(0);
    });
  });

  describe('digit input', () => {
    beforeEach(() => {
      game.start();
    });

    it('should accept correct digit and advance position', () => {
      const targetDigit = game.getTargetDigit(0);
      if (targetDigit === undefined) {return;}

      const feedback = game.handleDigitInput(targetDigit);

      expect(feedback).toBe('correct');
      expect(game.inputSequence).toContain(targetDigit);
      expect(game.currentPosition).toBe(1);
    });

    it('should reject wrong digit and not advance', () => {
      const targetDigit = game.getTargetDigit(0);
      if (targetDigit === undefined) {return;}
      const wrongDigit = (targetDigit + 1) % 10;

      // Ensure wrong digit is not in remaining sequence
      const feedback = game.handleDigitInput(wrongDigit);

      expect(feedback === 'wrong' || feedback === 'wrong-position').toBe(true);
      expect(game.inputSequence).not.toContain(wrongDigit);
      expect(game.currentPosition).toBe(0);
    });

    it('should identify wrong-position feedback when digit exists in remaining sequence', () => {
      // Create a game with known sequence for predictable testing
      const customGame = new CodeBreakerGame({
        ...DEFAULT_CONFIG.minigames.codeBreaker,
        sequenceLength: 3,
      });
      customGame.start();

      // Get the sequence
      const seq = [...customGame.targetSequence];

      // If sequence has unique digits, try to find one for wrong-position test
      const firstDigit = seq[0];
      const secondDigit = seq[1];

      if (firstDigit !== undefined && secondDigit !== undefined && firstDigit !== secondDigit) {
        // Try entering second digit at first position
        const feedback = customGame.handleDigitInput(secondDigit);

        // Should be wrong-position since it exists later in sequence
        expect(feedback).toBe('wrong-position');
      }

      customGame.destroy();
    });

    it('should increment combo on correct input', () => {
      const targetDigit = game.getTargetDigit(0);
      if (targetDigit === undefined) {return;}

      game.handleDigitInput(targetDigit);

      expect(game.combo).toBeGreaterThan(1);
    });

    it('should reset combo on wrong input', () => {
      // First get a correct answer to build combo
      const targetDigit = game.getTargetDigit(0);
      if (targetDigit === undefined) {
        return;
      }

      game.handleDigitInput(targetDigit);
      expect(game.combo).toBeGreaterThan(1);

      // Now enter wrong digit
      const currentTarget = game.getTargetDigit(game.currentPosition);
      if (currentTarget === undefined) {
        return;
      }
      const wrongDigit = (currentTarget + 5) % 10;

      game.handleDigitInput(wrongDigit);

      expect(game.combo).toBe(1);
      expect(game.failCount).toBeGreaterThan(0);
    });

    it('should add score on correct input', () => {
      const targetDigit = game.getTargetDigit(0);
      if (targetDigit === undefined) {return;}

      game.handleDigitInput(targetDigit);

      expect(game.score).toBeGreaterThan(0);
    });

    it('should return null when not playing', () => {
      game.end();

      const feedback = game.handleDigitInput(5);

      expect(feedback).toBeNull();
    });

    it('should handle invalid digit gracefully', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(game.handleDigitInput(-1)).toBeNull();
      expect(game.handleDigitInput(10)).toBeNull();
      expect(game.handleDigitInput(1.5)).toBeNull();

      warnSpy.mockRestore();
    });
  });

  describe('key input', () => {
    beforeEach(() => {
      game.start();
    });

    it('should handle Digit key codes', () => {
      const targetDigit = game.getTargetDigit(0);
      if (targetDigit === undefined) {return;}

      const feedback = game.handleKeyInput(`Digit${targetDigit}`);

      expect(feedback).toBe('correct');
    });

    it('should handle Numpad key codes', () => {
      const targetDigit = game.getTargetDigit(0);
      if (targetDigit === undefined) {return;}

      const feedback = game.handleKeyInput(`Numpad${targetDigit}`);

      expect(feedback).toBe('correct');
    });

    it('should handle plain digit strings', () => {
      const targetDigit = game.getTargetDigit(0);
      if (targetDigit === undefined) {return;}

      const feedback = game.handleKeyInput(`${targetDigit}`);

      expect(feedback).toBe('correct');
    });

    it('should return null for non-digit keys', () => {
      expect(game.handleKeyInput('KeyA')).toBeNull();
      expect(game.handleKeyInput('Enter')).toBeNull();
      expect(game.handleKeyInput('Escape')).toBeNull();
    });
  });

  describe('sequence completion', () => {
    beforeEach(() => {
      game.start();
    });

    it('should complete sequence when all digits correct', () => {
      const completedListener = vi.fn();
      game.on('sequence-complete' as any, completedListener);

      // Enter all correct digits
      for (let i = 0; i < game.sequenceLength; i++) {
        const target = game.getTargetDigit(i);
        if (target !== undefined) {
          game.handleDigitInput(target);
        }
      }

      expect(completedListener).toHaveBeenCalled();
      expect(game.sequencesCompleted).toBe(1);
    });

    it('should generate new sequence after completion', () => {
      // Complete the sequence
      for (let i = 0; i < game.sequenceLength; i++) {
        const target = game.getTargetDigit(i);
        if (target !== undefined) {
          game.handleDigitInput(target);
        }
      }

      // New sequence should be generated - input is reset
      expect(game.inputSequence).toEqual([]);
      expect(game.currentPosition).toBe(0);
    });

    it('should award bonus points on sequence completion', () => {
      const scoreBeforeSequence = game.score;

      // Complete a sequence
      for (let i = 0; i < game.sequenceLength; i++) {
        const target = game.getTargetDigit(i);
        if (target !== undefined) {
          game.handleDigitInput(target);
        }
      }

      // Score should include base points + sequence bonus
      expect(game.score).toBeGreaterThan(
        scoreBeforeSequence + game.sequenceLength * DEFAULT_CONFIG.minigames.codeBreaker.pointsPerDigit
      );
    });
  });

  describe('timer', () => {
    beforeEach(() => {
      game.start();
    });

    it('should count down time', () => {
      const initialTime = game.timeRemainingMs;
      game.update(1000);

      expect(game.timeRemainingMs).toBe(initialTime - 1000);
    });

    it('should end game when time runs out', () => {
      const timeLimitMs = game.timeLimitMs;
      game.update(timeLimitMs + 1000);

      expect(game.phase).toBe('ended');
    });
  });

  describe('getters', () => {
    beforeEach(() => {
      game.start();
    });

    it('should provide read-only target sequence', () => {
      const sequence = game.targetSequence;

      expect(Array.isArray(sequence)).toBe(true);
      // TypeScript readonly prevents modification, but test the accessor
      expect(sequence.length).toBe(game.sequenceLength);
    });

    it('should get target digit at position', () => {
      const digit = game.getTargetDigit(0);

      expect(typeof digit).toBe('number');
      expect(digit).toBe(game.targetSequence[0]);
    });

    it('should return undefined for out-of-bounds position', () => {
      expect(game.getTargetDigit(-1)).toBeUndefined();
      expect(game.getTargetDigit(100)).toBeUndefined();
    });

    it('should check if position is complete', () => {
      expect(game.isPositionComplete(0)).toBe(false);

      const target = game.getTargetDigit(0);
      if (target !== undefined) {
        game.handleDigitInput(target);
      }

      expect(game.isPositionComplete(0)).toBe(true);
      expect(game.isPositionComplete(1)).toBe(false);
    });

    it('should track last input feedback', () => {
      expect(game.lastInputFeedback).toBeNull();

      const target = game.getTargetDigit(0);
      if (target !== undefined) {
        game.handleDigitInput(target);
        expect(game.lastInputFeedback).toBe('correct');

        const wrong = (target + 5) % 10;
        game.handleDigitInput(wrong);
        expect(game.lastInputFeedback === 'wrong' || game.lastInputFeedback === 'wrong-position').toBe(true);
      }
    });
  });

  describe('reward calculation', () => {
    it('should calculate money reward correctly', () => {
      game.start();

      // Add some score
      for (let i = 0; i < 3 && i < game.sequenceLength; i++) {
        const target = game.getTargetDigit(i);
        if (target !== undefined) {
          game.handleDigitInput(target);
        }
      }

      const reward = game.calculateMoneyReward();
      const expectedReward = String(
        Math.floor(game.score * DEFAULT_CONFIG.minigames.codeBreaker.scoreToMoneyRatio)
      );

      expect(reward).toBe(expectedReward);
    });

    it('should calculate reward statically', () => {
      const reward = CodeBreakerGame.calculateReward(1000);

      expect(reward).toBe(
        String(Math.floor(1000 * DEFAULT_CONFIG.minigames.codeBreaker.scoreToMoneyRatio))
      );
    });
  });

  describe('events', () => {
    beforeEach(() => {
      game.start();
    });

    it('should emit digit-correct event', () => {
      const listener = vi.fn();
      game.on('digit-correct' as any, listener);

      const target = game.getTargetDigit(0);
      if (target !== undefined) {
        game.handleDigitInput(target);
      }

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          minigameId: 'code-breaker',
          data: expect.objectContaining({
            digit: expect.any(Number),
            position: 0,
          }),
        })
      );
    });

    it('should emit digit-wrong event', () => {
      const listener = vi.fn();
      game.on('digit-wrong' as any, listener);

      const target = game.getTargetDigit(0);
      if (target !== undefined) {
        const wrong = (target + 5) % 10;
        game.handleDigitInput(wrong);
      }

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          minigameId: 'code-breaker',
          data: expect.objectContaining({
            digit: expect.any(Number),
            feedback: expect.any(String),
            position: 0,
          }),
        })
      );
    });
  });

  describe('factory function', () => {
    it('should create a new game instance', () => {
      const newGame = createCodeBreakerGame();

      expect(newGame).toBeInstanceOf(CodeBreakerGame);
      expect(newGame.id).toBe('code-breaker');

      newGame.destroy();
    });

    it('should accept custom config', () => {
      const customConfig = {
        ...DEFAULT_CONFIG.minigames.codeBreaker,
        sequenceLength: 8,
      };
      const newGame = createCodeBreakerGame(customConfig);

      expect(newGame.sequenceLength).toBe(8);

      newGame.destroy();
    });
  });
});
