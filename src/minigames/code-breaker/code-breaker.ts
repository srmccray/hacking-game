/**
 * Code Breaker Minigame Logic
 *
 * A sequence matching game where players must type the correct digits
 * to match a target sequence. Faster matches build higher combos for
 * more points.
 *
 * Game Rules:
 * - 5-digit sequences are generated
 * - Player types digits 0-9 to match
 * - Correct digit advances to next position
 * - Wrong digit resets combo (but continues sequence)
 * - Completing a sequence awards points based on combo
 * - Time limit: 60 seconds
 * - Higher combos = more points = more Money
 *
 * Usage:
 *   import { CodeBreaker } from '@minigames/code-breaker/code-breaker';
 *
 *   const game = new CodeBreaker();
 *   game.initialize();
 *   game.start();
 *
 *   // In game loop
 *   game.update(deltaMs);
 *   game.handleInput('5');
 */

import {
  BaseMinigame,
  type MinigameConfig,
  type MinigameEventType,
} from '../base-minigame';

// ============================================================================
// Configuration
// ============================================================================

/** Number of digits in each sequence */
const SEQUENCE_LENGTH = 5;

/** Time limit in milliseconds (60 seconds) */
const TIME_LIMIT_MS = 60 * 1000;

/** Base points for completing a sequence */
const BASE_SEQUENCE_POINTS = 100;

/** Points per digit matched correctly */
const POINTS_PER_DIGIT = 10;

/** Score to Money conversion ratio (score * ratio = money) */
const SCORE_TO_MONEY_RATIO = 1;

/** Maximum number of top scores to track */
export const MAX_TOP_SCORES = 5;

// ============================================================================
// Code Breaker Configuration
// ============================================================================

const CODE_BREAKER_CONFIG: MinigameConfig = {
  id: 'code-breaker',
  name: 'Code Breaker',
  description: 'Match number sequences under time pressure. Build combos for bonus points!',
  timeLimitMs: TIME_LIMIT_MS,
  primaryResource: 'money',
  basePoints: BASE_SEQUENCE_POINTS,
  scoreToResourceRatio: SCORE_TO_MONEY_RATIO,
};

// ============================================================================
// Code Breaker Class
// ============================================================================

/**
 * Code Breaker minigame implementation.
 */
export class CodeBreaker extends BaseMinigame {
  /** The target sequence to match */
  private _targetSequence: number[] = [];

  /** Current input sequence (what player has typed) */
  private _inputSequence: number[] = [];

  /** Current position in the sequence (0 to SEQUENCE_LENGTH - 1) */
  private _currentPosition: number = 0;

  /** Number of sequences completed this session */
  private _sequencesCompleted: number = 0;

  /** Last input was correct (for visual feedback) */
  private _lastInputCorrect: boolean | null = null;

  constructor() {
    super(CODE_BREAKER_CONFIG);
  }

  // ========================================================================
  // Public Getters
  // ========================================================================

  /** Get the current target sequence */
  get targetSequence(): readonly number[] {
    return this._targetSequence;
  }

  /** Get the current input sequence */
  get inputSequence(): readonly number[] {
    return this._inputSequence;
  }

  /** Get current position in the sequence */
  get currentPosition(): number {
    return this._currentPosition;
  }

  /** Get number of completed sequences */
  get sequencesCompleted(): number {
    return this._sequencesCompleted;
  }

  /** Get whether last input was correct */
  get lastInputCorrect(): boolean | null {
    return this._lastInputCorrect;
  }

  /** Get the sequence length */
  get sequenceLength(): number {
    return SEQUENCE_LENGTH;
  }

  // ========================================================================
  // Lifecycle Methods
  // ========================================================================

  protected onInitialize(): void {
    this.resetSequence();
  }

  protected onStart(): void {
    this._sequencesCompleted = 0;
    this._lastInputCorrect = null;
    this.generateNewSequence();
  }

  protected onUpdate(_deltaMs: number): void {
    // Future: Could implement combo decay over time
    // For MVP, combos only reset on wrong input
  }

  protected onDestroy(): void {
    this._targetSequence = [];
    this._inputSequence = [];
  }

  // ========================================================================
  // Input Handling
  // ========================================================================

  protected onInput(input: string): boolean {
    // Only accept digit inputs 0-9
    if (!/^[0-9]$/.test(input)) {
      return false;
    }

    const digit = parseInt(input, 10);
    const targetDigit = this._targetSequence[this._currentPosition];

    if (digit === targetDigit) {
      // Correct input
      this.handleCorrectInput(digit);
    } else {
      // Wrong input
      this.handleWrongInput(digit);
    }

    return true;
  }

  /**
   * Handle a correct digit input.
   */
  private handleCorrectInput(digit: number): void {
    this._lastInputCorrect = true;
    this._inputSequence.push(digit);
    this._currentPosition++;

    // Award points for correct digit
    this.addScore(POINTS_PER_DIGIT);

    // Check if sequence is complete
    if (this._currentPosition >= SEQUENCE_LENGTH) {
      this.handleSequenceComplete();
    } else {
      // Increment combo for correct digit (but sequence not complete)
      this.incrementCombo();
    }
  }

  /**
   * Handle an incorrect digit input.
   */
  private handleWrongInput(_digit: number): void {
    this._lastInputCorrect = false;

    // Reset combo on wrong input
    this.resetCombo();

    // Don't advance position - player must try again
    // This makes the game more forgiving than requiring restart
  }

  /**
   * Handle completion of a sequence.
   */
  private handleSequenceComplete(): void {
    this._sequencesCompleted++;

    // Award bonus points for completing sequence (with combo!)
    this.addScore(BASE_SEQUENCE_POINTS);

    // Increment combo for sequence completion
    this.incrementCombo();

    // Emit sequence complete event
    this.emit({
      type: 'sequence-complete' as MinigameEventType,
      minigameId: this.config.id,
      data: {
        sequenceNumber: this._sequencesCompleted,
        combo: this.combo,
        score: this.score,
      },
    });

    // Generate new sequence
    this.generateNewSequence();
  }

  // ========================================================================
  // Sequence Generation
  // ========================================================================

  /**
   * Generate a new random sequence.
   */
  private generateNewSequence(): void {
    this._targetSequence = [];
    this._inputSequence = [];
    this._currentPosition = 0;

    for (let i = 0; i < SEQUENCE_LENGTH; i++) {
      this._targetSequence.push(Math.floor(Math.random() * 10));
    }
  }

  /**
   * Reset the sequence state.
   */
  private resetSequence(): void {
    this._targetSequence = [];
    this._inputSequence = [];
    this._currentPosition = 0;
    this._sequencesCompleted = 0;
    this._lastInputCorrect = null;
  }

  // ========================================================================
  // Static Helper Methods
  // ========================================================================

  /**
   * Get the minigame ID.
   */
  static get MINIGAME_ID(): string {
    return CODE_BREAKER_CONFIG.id;
  }

  /**
   * Calculate the expected money reward for a given score.
   *
   * @param score - The score achieved
   * @returns The money amount as a string
   */
  static calculateReward(score: number): string {
    return String(Math.floor(score * SCORE_TO_MONEY_RATIO));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Code Breaker minigame instance.
 *
 * @returns A new CodeBreaker instance
 */
export function createCodeBreaker(): CodeBreaker {
  const game = new CodeBreaker();
  game.initialize();
  return game;
}
