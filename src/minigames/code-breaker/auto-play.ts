/**
 * Code Breaker Auto-Play Controller
 *
 * AI controller that drives Code Breaker input automatically.
 * Reads the target sequence and current position from the game,
 * then injects synthetic character inputs with level-dependent
 * delay and error rate.
 *
 * AI Level Parameters:
 * | Level | Delay (ms)  | Error Rate | Description              |
 * |-------|-------------|------------|--------------------------|
 * | 1     | 600-900     | 15%        | Slow, frequent mistakes  |
 * | 2     | 400-700     | 10%        | Faster, fewer errors     |
 * | 3     | 250-500     | 5%         | Quick typist             |
 * | 4     | 150-350     | 2%         | Near-expert              |
 * | 5     | 80-200      | 0.5%       | Master hacker            |
 *
 * Usage:
 *   const controller = createCodeBreakerAutoPlay(game, 3);
 *   // In game loop:
 *   controller.update(deltaMs);
 *   // On cleanup:
 *   controller.destroy();
 */

import type { CodeBreakerGame } from './CodeBreakerGame';

// ============================================================================
// Interface
// ============================================================================

/**
 * Controller interface for AI auto-play of minigames.
 */
export interface AutoPlayController {
  /** Current AI level (1-5) */
  readonly level: number;

  /**
   * Called each frame to compute and inject AI inputs.
   * @param deltaMs - Frame delta time in milliseconds
   */
  update(deltaMs: number): void;

  /** Clean up the controller and stop all AI activity. */
  destroy(): void;
}

// ============================================================================
// Level Configuration
// ============================================================================

/**
 * Parameters for a single AI level.
 */
interface AILevelParams {
  /** Minimum delay between keypresses in milliseconds */
  minDelayMs: number;
  /** Maximum delay between keypresses in milliseconds */
  maxDelayMs: number;
  /** Probability of typing a wrong character (0.0 - 1.0) */
  errorRate: number;
}

/**
 * AI level configurations indexed by level (1-5).
 * Index 0 is unused; levels start at 1.
 */
const AI_LEVEL_PARAMS: readonly AILevelParams[] = [
  // Index 0: placeholder (unused)
  { minDelayMs: 0, maxDelayMs: 0, errorRate: 0 },
  // Level 1: Slow, makes frequent mistakes
  { minDelayMs: 600, maxDelayMs: 900, errorRate: 0.15 },
  // Level 2: Faster, fewer errors
  { minDelayMs: 400, maxDelayMs: 700, errorRate: 0.10 },
  // Level 3: Quick typist
  { minDelayMs: 250, maxDelayMs: 500, errorRate: 0.05 },
  // Level 4: Near-expert
  { minDelayMs: 150, maxDelayMs: 350, errorRate: 0.02 },
  // Level 5: Master hacker
  { minDelayMs: 80, maxDelayMs: 200, errorRate: 0.005 },
];

/** Valid character set for generating wrong inputs */
const CHARACTER_SET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// ============================================================================
// Implementation
// ============================================================================

/**
 * Code Breaker auto-play controller implementation.
 *
 * Each frame, accumulates elapsed time. When enough time has passed
 * (based on a random delay within the level's range), the AI "presses"
 * a key by calling game.handleCharInput(). The AI rolls against the
 * error rate to decide whether to type the correct character or a
 * random wrong one.
 */
class CodeBreakerAutoPlayController implements AutoPlayController {
  readonly level: number;

  private readonly game: CodeBreakerGame;
  private readonly params: AILevelParams;

  /** Time accumulated since the last keypress in milliseconds */
  private elapsedSinceLastKey: number = 0;

  /** Current delay target before the next keypress */
  private currentDelay: number;

  /** Whether the controller has been destroyed */
  private destroyed: boolean = false;

  constructor(game: CodeBreakerGame, level: number) {
    this.game = game;
    this.level = level;

    // Clamp level to valid range
    const clampedLevel = Math.max(1, Math.min(5, level));
    this.params = AI_LEVEL_PARAMS[clampedLevel]!;

    // Roll the initial delay
    this.currentDelay = this.rollDelay();
  }

  update(deltaMs: number): void {
    if (this.destroyed) return;

    // Only act while the game is actively playing
    if (!this.game.isPlaying) return;

    // During the preview phase, the AI waits (just like a human reading the code)
    if (this.game.isInPreview) {
      // Reset timing so the AI starts fresh after preview ends
      this.elapsedSinceLastKey = 0;
      this.currentDelay = this.rollDelay();
      return;
    }

    this.elapsedSinceLastKey += deltaMs;

    // Check if enough time has passed for the next keypress
    if (this.elapsedSinceLastKey >= this.currentDelay) {
      this.pressKey();

      // Reset for the next keypress
      this.elapsedSinceLastKey = 0;
      this.currentDelay = this.rollDelay();
    }
  }

  destroy(): void {
    this.destroyed = true;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Generate a random delay within the level's min/max range.
   */
  private rollDelay(): number {
    const { minDelayMs, maxDelayMs } = this.params;
    return minDelayMs + Math.random() * (maxDelayMs - minDelayMs);
  }

  /**
   * Simulate a keypress. Rolls against error rate to decide
   * correct vs wrong character, then calls handleCharInput.
   */
  private pressKey(): void {
    const targetSequence = this.game.targetSequence;
    const position = this.game.currentPosition;

    // Safety: if there is no target or position is out of range, skip
    if (targetSequence.length === 0 || position >= targetSequence.length) {
      return;
    }

    const correctChar = targetSequence[position]!;
    const isError = Math.random() < this.params.errorRate;

    if (isError) {
      // Type a random wrong character (must differ from the correct one)
      const wrongChar = this.pickWrongChar(correctChar);
      this.game.handleCharInput(wrongChar);
    } else {
      this.game.handleCharInput(correctChar);
    }
  }

  /**
   * Pick a random character from the character set that is NOT the correct character.
   */
  private pickWrongChar(correctChar: string): string {
    // Build a set excluding the correct character
    let attempts = 0;
    let char: string;
    do {
      char = CHARACTER_SET[Math.floor(Math.random() * CHARACTER_SET.length)]!;
      attempts++;
    } while (char === correctChar && attempts < 100);

    // Fallback: if we somehow keep picking the same char (extremely unlikely),
    // just pick the next character in the alphabet
    if (char === correctChar) {
      const idx = CHARACTER_SET.indexOf(correctChar);
      char = CHARACTER_SET[(idx + 1) % CHARACTER_SET.length]!;
    }

    return char;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Code Breaker auto-play controller.
 *
 * @param game - The CodeBreakerGame instance to control
 * @param level - AI level (1-5). Values outside range are clamped.
 * @returns An AutoPlayController that drives Code Breaker inputs
 */
export function createCodeBreakerAutoPlay(
  game: CodeBreakerGame,
  level: number,
): AutoPlayController {
  return new CodeBreakerAutoPlayController(game, level);
}
