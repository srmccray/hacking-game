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
import { CODE_BREAKER_CONFIG } from '../../core/game-config';

/** Maximum number of top scores to track (re-exported for convenience) */
export const MAX_TOP_SCORES = CODE_BREAKER_CONFIG.maxTopScores;

// ============================================================================
// Minigame Configuration (uses values from centralized game-config)
// ============================================================================

const MINIGAME_CONFIG: MinigameConfig = {
  id: 'code-breaker',
  name: 'Code Breaker',
  description: 'Match number sequences under time pressure. Build combos for bonus points!',
  timeLimitMs: CODE_BREAKER_CONFIG.timeLimitMs,
  primaryResource: 'money',
  basePoints: CODE_BREAKER_CONFIG.baseSequencePoints,
  scoreToResourceRatio: CODE_BREAKER_CONFIG.scoreToMoneyRatio,
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
    super(MINIGAME_CONFIG);
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
    return CODE_BREAKER_CONFIG.sequenceLength;
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
    this.addScore(CODE_BREAKER_CONFIG.pointsPerDigit);

    // Check if sequence is complete
    if (this._currentPosition >= CODE_BREAKER_CONFIG.sequenceLength) {
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
    this.addScore(CODE_BREAKER_CONFIG.baseSequencePoints);

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

    for (let i = 0; i < CODE_BREAKER_CONFIG.sequenceLength; i++) {
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
    return MINIGAME_CONFIG.id;
  }

  /**
   * Calculate the expected money reward for a given score.
   *
   * @param score - The score achieved
   * @returns The money amount as a string
   */
  static calculateReward(score: number): string {
    return String(Math.floor(score * CODE_BREAKER_CONFIG.scoreToMoneyRatio));
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
