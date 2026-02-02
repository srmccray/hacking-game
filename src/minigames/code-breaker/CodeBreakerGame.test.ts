/**
 * Tests for CodeBreakerGame (redesigned per-code countdown version)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CodeBreakerGame, createCodeBreakerGame } from './CodeBreakerGame';
import { DEFAULT_CONFIG } from '../../game/GameConfig';
import type { CodeBreakerConfig } from '../../game/GameConfig';

const defaultConfig = DEFAULT_CONFIG.minigames.codeBreaker;

/** Helper: complete the current code by entering all correct characters */
function completeCurrentCode(game: CodeBreakerGame): void {
  const seq = game.targetSequence;
  for (let i = game.currentPosition; i < seq.length; i++) {
    game.handleCharInput(seq[i]!);
  }
}

/** Helper: find a character NOT in the target sequence */
function findWrongChar(game: CodeBreakerGame): string {
  const charset = defaultConfig.characterSet;
  const target = game.targetSequence[game.currentPosition];
  for (const ch of charset) {
    if (ch !== target) return ch;
  }
  throw new Error('Could not find wrong character');
}

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

    it('should start in idle phase', () => {
      expect(game.phase).toBe('idle');
      expect(game.targetSequence).toEqual([]);
      expect(game.inputSequence).toEqual([]);
    });

    it('should accept custom config', () => {
      const customConfig: CodeBreakerConfig = {
        ...defaultConfig,
        startingCodeLength: 3,
        perCodeTimeLimitMs: 3000,
      };
      const customGame = new CodeBreakerGame(customConfig);
      customGame.start();

      expect(customGame.currentCodeLength).toBe(3);
      expect(customGame.targetSequence).toHaveLength(3);

      customGame.destroy();
    });
  });

  describe('game start', () => {
    it('should generate a sequence of startingCodeLength on start', () => {
      game.start();

      expect(game.targetSequence).toHaveLength(defaultConfig.startingCodeLength);
      expect(game.currentCodeLength).toBe(defaultConfig.startingCodeLength);
    });

    it('should generate characters from the character set', () => {
      game.start();

      for (const char of game.targetSequence) {
        expect(defaultConfig.characterSet).toContain(char);
      }
    });

    it('should have 26 characters in the default character set', () => {
      expect(defaultConfig.characterSet.length).toBe(26);
    });

    it('should reset input state on start', () => {
      game.start();
      game.handleCharInput(game.targetSequence[0]!);
      game.end();

      game.start();

      expect(game.inputSequence).toEqual([]);
      expect(game.currentPosition).toBe(0);
    });

    it('should reset codes cracked count on start', () => {
      game.start();
      completeCurrentCode(game);
      expect(game.codesCracked).toBe(1);

      game.end();
      game.start();

      expect(game.codesCracked).toBe(0);
    });

    it('should bypass base class timer (timeLimitMs = 0)', () => {
      game.start();

      expect(game.timeLimitMs).toBe(0);
    });

    it('should initialize per-code timer', () => {
      game.start();

      expect(game.perCodeTimeRemainingMs).toBe(defaultConfig.perCodeTimeLimitMs);
    });

    it('should initialize preview timer', () => {
      game.start();

      expect(game.previewRemainingMs).toBe(defaultConfig.previewDurationMs);
      expect(game.isInPreview).toBe(true);
    });

    it('should reset failReason on start', () => {
      game.start();
      game.handleCharInput(findWrongChar(game));
      expect(game.failReason).toBe('wrong-input');

      game.start();
      expect(game.failReason).toBeNull();
    });
  });

  describe('character input', () => {
    beforeEach(() => {
      game.start();
    });

    it('should accept correct character and advance position', () => {
      const targetChar = game.targetSequence[0]!;

      const result = game.handleCharInput(targetChar);

      expect(result).toBe(true);
      expect(game.inputSequence[0]).toBe(targetChar);
      expect(game.currentPosition).toBe(1);
    });

    it('should end game on wrong character', () => {
      const wrongChar = findWrongChar(game);

      const result = game.handleCharInput(wrongChar);

      expect(result).toBe(false);
      expect(game.phase).toBe('ended');
      expect(game.failReason).toBe('wrong-input');
    });

    it('should return null when not playing', () => {
      game.end();

      const result = game.handleCharInput('A');

      expect(result).toBeNull();
    });

    it('should return null for characters not in character set', () => {
      // Lowercase is not in the character set
      const result = game.handleCharInput('a');

      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = game.handleCharInput('');

      expect(result).toBeNull();
    });

    it('should return null for multi-character string', () => {
      const result = game.handleCharInput('AB');

      expect(result).toBeNull();
    });

    it('should accept input during preview phase', () => {
      expect(game.isInPreview).toBe(true);

      const targetChar = game.targetSequence[0]!;
      const result = game.handleCharInput(targetChar);

      expect(result).toBe(true);
      expect(game.currentPosition).toBe(1);
    });

    it('should increment successCount on correct input', () => {
      const before = game.successCount;
      game.handleCharInput(game.targetSequence[0]!);

      expect(game.successCount).toBe(before + 1);
    });

    it('should increment failCount on wrong input', () => {
      const before = game.failCount;
      game.handleCharInput(findWrongChar(game));

      expect(game.failCount).toBe(before + 1);
    });
  });

  describe('code completion and escalation', () => {
    beforeEach(() => {
      game.start();
    });

    it('should increment codesCracked on completing a code', () => {
      completeCurrentCode(game);

      expect(game.codesCracked).toBe(1);
    });

    it('should increase code length after completion', () => {
      const initialLength = game.currentCodeLength;

      completeCurrentCode(game);

      expect(game.currentCodeLength).toBe(initialLength + defaultConfig.lengthIncrement);
    });

    it('should generate new sequence after completion', () => {
      completeCurrentCode(game);

      expect(game.inputSequence).toEqual([]);
      expect(game.currentPosition).toBe(0);
      expect(game.targetSequence).toHaveLength(
        defaultConfig.startingCodeLength + defaultConfig.lengthIncrement
      );
    });

    it('should reset per-code timer after completion', () => {
      // Consume some time
      game.update(defaultConfig.previewDurationMs); // finish preview
      game.update(2000); // consume 2 seconds

      const timeAfterConsume = game.perCodeTimeRemainingMs;
      expect(timeAfterConsume).toBeLessThan(defaultConfig.perCodeTimeLimitMs);

      completeCurrentCode(game);

      // Timer should be reset to effective limit for new (longer) code
      const expectedTime =
        defaultConfig.perCodeTimeLimitMs +
        defaultConfig.lengthIncrement * defaultConfig.timePerExtraCharMs;
      expect(game.perCodeTimeRemainingMs).toBe(expectedTime);
    });

    it('should reset preview timer after completion', () => {
      // Exhaust preview
      game.update(defaultConfig.previewDurationMs);
      expect(game.isInPreview).toBe(false);

      completeCurrentCode(game);

      expect(game.isInPreview).toBe(true);
      expect(game.previewRemainingMs).toBe(defaultConfig.previewDurationMs);
    });

    it('should emit sequence-complete event', () => {
      const listener = vi.fn();
      game.on('sequence-complete' as any, listener);

      completeCurrentCode(game);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          minigameId: 'code-breaker',
          data: expect.objectContaining({
            sequenceNumber: 1,
            codeLength: defaultConfig.startingCodeLength + defaultConfig.lengthIncrement,
          }),
        })
      );
    });

    it('should complete multiple codes with escalating length', () => {
      completeCurrentCode(game);
      expect(game.codesCracked).toBe(1);
      expect(game.currentCodeLength).toBe(defaultConfig.startingCodeLength + 1);

      completeCurrentCode(game);
      expect(game.codesCracked).toBe(2);
      expect(game.currentCodeLength).toBe(defaultConfig.startingCodeLength + 2);

      completeCurrentCode(game);
      expect(game.codesCracked).toBe(3);
      expect(game.currentCodeLength).toBe(defaultConfig.startingCodeLength + 3);
    });
  });

  describe('per-code timer', () => {
    beforeEach(() => {
      game.start();
    });

    it('should not decrement per-code timer during preview', () => {
      const initialTime = game.perCodeTimeRemainingMs;

      game.update(500); // less than preview duration

      expect(game.perCodeTimeRemainingMs).toBe(initialTime);
      expect(game.previewRemainingMs).toBe(defaultConfig.previewDurationMs - 500);
    });

    it('should decrement preview timer during preview', () => {
      game.update(300);

      expect(game.previewRemainingMs).toBe(defaultConfig.previewDurationMs - 300);
    });

    it('should start decrementing per-code timer after preview ends', () => {
      const initialTime = game.perCodeTimeRemainingMs;

      // Finish preview
      game.update(defaultConfig.previewDurationMs);
      expect(game.isInPreview).toBe(false);

      // Now timer should decrement
      game.update(1000);

      expect(game.perCodeTimeRemainingMs).toBe(initialTime - 1000);
    });

    it('should end game when per-code timer expires', () => {
      // Finish preview
      game.update(defaultConfig.previewDurationMs);

      // Expire per-code timer
      game.update(defaultConfig.perCodeTimeLimitMs + 100);

      expect(game.phase).toBe('ended');
      expect(game.failReason).toBe('timeout');
    });

    it('should emit time-up event on timeout', () => {
      const listener = vi.fn();
      game.on('time-up' as any, listener);

      game.update(defaultConfig.previewDurationMs);
      game.update(defaultConfig.perCodeTimeLimitMs + 100);

      expect(listener).toHaveBeenCalled();
    });

    it('should not end game via base class timer', () => {
      // Base class timer is bypassed (timeLimitMs = 0)
      // Even updating with very large deltaMs should not trigger base class time-up
      // Only our per-code timer should matter
      game.update(defaultConfig.previewDurationMs);
      game.update(2000); // Only 2 seconds of per-code timer consumed

      expect(game.phase).toBe('playing');
    });
  });

  describe('effective time limit scaling', () => {
    it('should return base time for starting code length', () => {
      game.start();

      expect(game.effectiveTimeLimitMs).toBe(defaultConfig.perCodeTimeLimitMs);
    });

    it('should add time for extra characters', () => {
      game.start();

      // Complete first code to increase length
      completeCurrentCode(game);

      const expectedTime =
        defaultConfig.perCodeTimeLimitMs +
        defaultConfig.lengthIncrement * defaultConfig.timePerExtraCharMs;
      expect(game.effectiveTimeLimitMs).toBe(expectedTime);
    });

    it('should include upgrade bonus in effective time', () => {
      game.setUpgradeBonusMs(1000);
      game.start();

      expect(game.effectiveTimeLimitMs).toBe(defaultConfig.perCodeTimeLimitMs + 1000);
      expect(game.perCodeTimeRemainingMs).toBe(defaultConfig.perCodeTimeLimitMs + 1000);
    });

    it('should combine extra char time and upgrade bonus', () => {
      game.setUpgradeBonusMs(500);
      game.start();

      completeCurrentCode(game);

      const expectedTime =
        defaultConfig.perCodeTimeLimitMs +
        defaultConfig.lengthIncrement * defaultConfig.timePerExtraCharMs +
        500;
      expect(game.effectiveTimeLimitMs).toBe(expectedTime);
    });
  });

  describe('scoring', () => {
    it('should set score to codes cracked during play', () => {
      game.start();

      completeCurrentCode(game);
      expect(game.score).toBe(1);

      completeCurrentCode(game);
      expect(game.score).toBe(2);
    });

    it('should equal codes cracked count after end', () => {
      game.start();

      completeCurrentCode(game);
      completeCurrentCode(game);
      completeCurrentCode(game);
      game.end();

      expect(game.score).toBe(3); // 3 codes cracked
    });

    it('should have score 0 if no codes cracked', () => {
      game.start();
      game.end();

      expect(game.score).toBe(0);
    });
  });

  describe('reward calculation', () => {
    it('should return 0 money when no codes cracked', () => {
      game.start();

      expect(game.calculateMoneyReward()).toBe('0');
    });

    it('should calculate money as sum of baseMoneyPerCode * codeLength', () => {
      game.start();

      // First code: length 5 -> 5 * 5 = 25
      completeCurrentCode(game);
      expect(game.calculateMoneyReward()).toBe(
        String(defaultConfig.baseMoneyPerCode * defaultConfig.startingCodeLength)
      );

      // Second code: length 6 -> 5 * 6 = 30, total = 55
      completeCurrentCode(game);
      const expectedTotal =
        defaultConfig.baseMoneyPerCode * defaultConfig.startingCodeLength +
        defaultConfig.baseMoneyPerCode * (defaultConfig.startingCodeLength + defaultConfig.lengthIncrement);
      expect(game.calculateMoneyReward()).toBe(String(expectedTotal));
    });

    it('should accumulate money across multiple codes', () => {
      game.start();

      // Crack 3 codes: lengths 5, 6, 7
      completeCurrentCode(game); // 5 * 5 = 25
      completeCurrentCode(game); // 5 * 6 = 30
      completeCurrentCode(game); // 5 * 7 = 35

      // Total: 25 + 30 + 35 = 90
      expect(game.calculateMoneyReward()).toBe('90');
    });
  });

  describe('events', () => {
    beforeEach(() => {
      game.start();
    });

    it('should emit char-correct event', () => {
      const listener = vi.fn();
      game.on('char-correct' as any, listener);

      const target = game.targetSequence[0]!;
      game.handleCharInput(target);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          minigameId: 'code-breaker',
          data: expect.objectContaining({
            char: target,
            position: 0,
          }),
        })
      );
    });

    it('should emit char-wrong event on wrong input', () => {
      const listener = vi.fn();
      game.on('char-wrong' as any, listener);

      const wrongChar = findWrongChar(game);
      game.handleCharInput(wrongChar);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          minigameId: 'code-breaker',
          data: expect.objectContaining({
            char: wrongChar,
            position: 0,
          }),
        })
      );
    });

    it('should emit end event after wrong input', () => {
      const listener = vi.fn();
      game.on('end' as any, listener);

      game.handleCharInput(findWrongChar(game));

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('fail reason tracking', () => {
    it('should be null before game starts', () => {
      expect(game.failReason).toBeNull();
    });

    it('should be null while playing successfully', () => {
      game.start();
      game.handleCharInput(game.targetSequence[0]!);

      expect(game.failReason).toBeNull();
    });

    it('should be wrong-input on wrong character', () => {
      game.start();
      game.handleCharInput(findWrongChar(game));

      expect(game.failReason).toBe('wrong-input');
    });

    it('should be timeout on timer expiry', () => {
      game.start();
      game.update(defaultConfig.previewDurationMs);
      game.update(defaultConfig.perCodeTimeLimitMs + 100);

      expect(game.failReason).toBe('timeout');
    });
  });

  describe('no combo usage', () => {
    it('should not change combo on correct input', () => {
      game.start();

      game.handleCharInput(game.targetSequence[0]!);

      // Combo should stay at default (1) since we never call incrementCombo
      expect(game.combo).toBe(1);
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
      const customConfig: CodeBreakerConfig = {
        ...defaultConfig,
        startingCodeLength: 8,
      };
      const newGame = createCodeBreakerGame(customConfig);
      newGame.start();

      expect(newGame.currentCodeLength).toBe(8);
      expect(newGame.targetSequence).toHaveLength(8);

      newGame.destroy();
    });
  });
});
