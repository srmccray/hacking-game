/**
 * Code Breaker Game Logic
 *
 * A sequence matching minigame where players type digits to match a target sequence.
 * Features:
 * - Random digit sequence generation (configurable length)
 * - Position-based feedback (correct, wrong position, not in code)
 * - Combo system for consecutive correct inputs
 * - Timer-based scoring
 * - Configurable via GameConfig
 *
 * Game Rules:
 * - A target sequence of digits is displayed
 * - Player types digits 0-9 to match from left to right
 * - Correct digit: advances position, adds score with combo, increments combo
 * - Wrong digit: resets combo, records fail (does not advance)
 * - Completing a sequence: bonus points, generates new sequence
 * - Game ends when timer runs out
 *
 * Usage:
 *   const game = new CodeBreakerGame(config.minigames.codeBreaker);
 *   game.start();
 *
 *   // Handle digit input
 *   game.handleDigitInput(5); // returns feedback
 *
 *   // In game loop
 *   game.update(deltaMs);
 */

import { BaseMinigame, type MinigameEventType } from '../BaseMinigame';
import type { CodeBreakerConfig } from '../../game/GameConfig';
import { DEFAULT_CONFIG } from '../../game/GameConfig';

// ============================================================================
// Types
// ============================================================================

/**
 * Feedback for a digit input attempt.
 */
export type DigitFeedback = 'correct' | 'wrong' | 'wrong-position';

/**
 * State of each digit position in the input.
 */
export interface DigitState {
  /** The digit value (0-9) or null if not yet entered */
  value: number | null;
  /** Feedback for this position */
  feedback: DigitFeedback | null;
}

/**
 * Events specific to Code Breaker.
 */
export type CodeBreakerEventType =
  | MinigameEventType
  | 'digit-correct'
  | 'digit-wrong'
  | 'sequence-complete';

// ============================================================================
// Code Breaker Game Class
// ============================================================================

/**
 * Code Breaker minigame logic.
 */
export class CodeBreakerGame extends BaseMinigame {
  readonly id = 'code-breaker';

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /** Minigame configuration */
  private readonly config: CodeBreakerConfig;

  // ==========================================================================
  // Game State
  // ==========================================================================

  /** The target sequence to match */
  private _targetSequence: number[] = [];

  /** Player's input sequence (partial, up to current position) */
  private _inputSequence: number[] = [];

  /** Current position in the sequence (0 to length-1) */
  private _currentPosition: number = 0;

  /** Number of sequences completed this session */
  private _sequencesCompleted: number = 0;

  /** Result of the last digit input for visual feedback */
  private _lastInputFeedback: DigitFeedback | null = null;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  /**
   * Create a new Code Breaker game.
   *
   * @param config - Configuration from GameConfig.minigames.codeBreaker
   */
  constructor(config?: CodeBreakerConfig) {
    super();
    this.config = config ?? DEFAULT_CONFIG.minigames.codeBreaker;
    this.setTimeLimit(this.config.timeLimitMs);
  }

  // ==========================================================================
  // Public Getters
  // ==========================================================================

  /** Get the current target sequence (read-only copy) */
  get targetSequence(): readonly number[] {
    return this._targetSequence;
  }

  /** Get the player's input sequence (read-only copy) */
  get inputSequence(): readonly number[] {
    return this._inputSequence;
  }

  /** Get the current position in the sequence */
  get currentPosition(): number {
    return this._currentPosition;
  }

  /** Get the sequence length from config */
  get sequenceLength(): number {
    return this.config.sequenceLength;
  }

  /** Get the number of sequences completed */
  get sequencesCompleted(): number {
    return this._sequencesCompleted;
  }

  /** Get the feedback from the last input attempt */
  get lastInputFeedback(): DigitFeedback | null {
    return this._lastInputFeedback;
  }

  /** Get the digit at a specific position in the target */
  getTargetDigit(position: number): number | undefined {
    return this._targetSequence[position];
  }

  /** Get the digit at a specific position in the input */
  getInputDigit(position: number): number | undefined {
    return this._inputSequence[position];
  }

  /** Check if a position has been completed */
  isPositionComplete(position: number): boolean {
    return position < this._inputSequence.length;
  }

  // ==========================================================================
  // Lifecycle Implementation
  // ==========================================================================

  protected onStart(): void {
    this._sequencesCompleted = 0;
    this._lastInputFeedback = null;
    this.generateNewSequence();
  }

  protected onEnd(): void {
    // Final state cleanup if needed
    this._lastInputFeedback = null;
  }

  protected onUpdate(_deltaMs: number): void {
    // Timer is handled by base class
    // Could implement combo decay here if desired
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Handle a digit input from the player.
   *
   * @param digit - The digit (0-9) entered by the player
   * @returns The feedback for this input, or null if not playing
   */
  handleDigitInput(digit: number): DigitFeedback | null {
    if (!this.isPlaying) {
      return null;
    }

    // Validate digit
    if (digit < 0 || digit > 9 || !Number.isInteger(digit)) {
      console.warn(`[CodeBreaker] Invalid digit: ${digit}`);
      return null;
    }

    const targetDigit = this._targetSequence[this._currentPosition];

    if (digit === targetDigit) {
      return this.handleCorrectDigit(digit);
    } else {
      return this.handleWrongDigit(digit, targetDigit);
    }
  }

  /**
   * Handle a key code input (e.g., 'Digit5' or '5').
   * Extracts the digit and calls handleDigitInput.
   *
   * @param keyCode - The key code string
   * @returns The feedback, or null if invalid key or not playing
   */
  handleKeyInput(keyCode: string): DigitFeedback | null {
    // Handle both 'Digit5' and '5' formats
    let digit: number;

    if (keyCode.startsWith('Digit')) {
      digit = parseInt(keyCode.slice(5), 10);
    } else if (keyCode.startsWith('Numpad')) {
      digit = parseInt(keyCode.slice(6), 10);
    } else if (/^[0-9]$/.test(keyCode)) {
      digit = parseInt(keyCode, 10);
    } else {
      return null;
    }

    if (isNaN(digit)) {
      return null;
    }

    return this.handleDigitInput(digit);
  }

  // ==========================================================================
  // Private Input Handlers
  // ==========================================================================

  /**
   * Handle a correct digit input.
   */
  private handleCorrectDigit(digit: number): DigitFeedback {
    this._lastInputFeedback = 'correct';
    this._inputSequence.push(digit);
    this._currentPosition++;

    // Award points for correct digit
    this.addScore(this.config.pointsPerDigit);

    // Increment combo
    this.incrementCombo();

    // Emit digit-correct event
    this.emit('digit-correct' as MinigameEventType, {
      minigameId: this.id,
      data: {
        digit,
        position: this._currentPosition - 1,
      },
    });

    // Check for sequence completion
    if (this._currentPosition >= this.config.sequenceLength) {
      this.handleSequenceComplete();
    }

    return 'correct';
  }

  /**
   * Handle a wrong digit input.
   */
  private handleWrongDigit(digit: number, targetDigit: number | undefined): DigitFeedback {
    // Check if digit exists elsewhere in the remaining sequence
    const isInSequence = this._targetSequence
      .slice(this._currentPosition)
      .includes(digit);

    const feedback: DigitFeedback = isInSequence ? 'wrong-position' : 'wrong';
    this._lastInputFeedback = feedback;

    // Reset combo on wrong input
    this.resetCombo();

    // Emit digit-wrong event
    this.emit('digit-wrong' as MinigameEventType, {
      minigameId: this.id,
      data: {
        digit,
        targetDigit,
        feedback,
        position: this._currentPosition,
      },
    });

    return feedback;
  }

  /**
   * Handle completion of a sequence.
   */
  private handleSequenceComplete(): void {
    this._sequencesCompleted++;

    // Bonus points for completing the sequence
    this.addScore(this.config.baseSequencePoints);

    // Emit sequence-complete event
    this.emit('sequence-complete' as MinigameEventType, {
      minigameId: this.id,
      data: {
        sequenceNumber: this._sequencesCompleted,
        combo: this.combo,
        score: this.score,
      },
    });

    // Generate new sequence
    this.generateNewSequence();
  }

  // ==========================================================================
  // Sequence Generation
  // ==========================================================================

  /**
   * Generate a new random sequence.
   */
  private generateNewSequence(): void {
    this._targetSequence = [];
    this._inputSequence = [];
    this._currentPosition = 0;

    for (let i = 0; i < this.config.sequenceLength; i++) {
      this._targetSequence.push(Math.floor(Math.random() * 10));
    }
  }

  /**
   * Reset sequence state (used internally).
   */
  protected override resetState(): void {
    super.resetState();
    this._targetSequence = [];
    this._inputSequence = [];
    this._currentPosition = 0;
    this._sequencesCompleted = 0;
    this._lastInputFeedback = null;
    this.setTimeLimit(this.config.timeLimitMs);
  }

  // ==========================================================================
  // Reward Calculation
  // ==========================================================================

  /**
   * Calculate the money reward based on the final score.
   *
   * @returns Money as a string (for Decimal compatibility)
   */
  calculateMoneyReward(): string {
    return String(Math.floor(this.score * this.config.scoreToMoneyRatio));
  }

  // ==========================================================================
  // Static Helpers
  // ==========================================================================

  /**
   * Get the minigame ID constant.
   */
  static get MINIGAME_ID(): string {
    return 'code-breaker';
  }

  /**
   * Calculate expected money for a given score.
   *
   * @param score - The score
   * @param config - Optional config (uses default if not provided)
   * @returns Money as string
   */
  static calculateReward(score: number, config?: CodeBreakerConfig): string {
    const ratio = config?.scoreToMoneyRatio ?? DEFAULT_CONFIG.minigames.codeBreaker.scoreToMoneyRatio;
    return String(Math.floor(score * ratio));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Code Breaker game instance.
 *
 * @param config - Optional configuration override
 * @returns A new CodeBreakerGame instance
 */
export function createCodeBreakerGame(config?: CodeBreakerConfig): CodeBreakerGame {
  return new CodeBreakerGame(config);
}
