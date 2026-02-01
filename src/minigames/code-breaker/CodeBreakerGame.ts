/**
 * Code Breaker Game Logic
 *
 * A per-code countdown challenge where players type characters to match a target
 * sequence before time runs out. Features:
 * - Expanded character set (A-Z, 0-9, !@#$%^&* = 44 characters)
 * - Per-code timer that resets on each successful crack
 * - Escalating code length (increases by 1 per successful crack)
 * - Immediate failure on wrong input or timer expiry
 * - Preview phase before timer starts (input accepted during preview)
 * - Money reward scales with code length
 *
 * Game Rules:
 * - A target sequence of characters is displayed
 * - Player types characters to match from left to right
 * - Correct character: advances position
 * - Wrong character: immediate game over (_failReason = 'wrong-input')
 * - Timer expires: immediate game over (_failReason = 'timeout')
 * - Completing a code: increment code length, generate new code, reset timer
 * - Score = number of codes cracked (multiplied by 100 for storage)
 * - Money = sum of baseMoneyPerCode * codeLength for each cracked code
 *
 * Usage:
 *   const game = new CodeBreakerGame(config.minigames.codeBreaker);
 *   game.start();
 *
 *   // Handle character input
 *   game.handleCharInput('A'); // returns true if accepted
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
 * Reason the game ended in failure.
 */
export type FailReason = 'wrong-input' | 'timeout' | null;

/**
 * Events specific to Code Breaker.
 */
export type CodeBreakerEventType =
  | MinigameEventType
  | 'char-correct'
  | 'char-wrong'
  | 'sequence-complete';

// ============================================================================
// Code Breaker Game Class
// ============================================================================

/**
 * Code Breaker minigame logic.
 *
 * Manages per-code timers internally. Sets _timeLimitMs = 0 in onStart()
 * to bypass BaseMinigame's session timer (line 357 checks if > 0).
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

  /** The target sequence to match (array of single characters) */
  private _targetSequence: string[] = [];

  /** Player's input sequence (partial, up to current position) */
  private _inputSequence: string[] = [];

  /** Current position in the sequence (0 to length-1) */
  private _currentPosition: number = 0;

  /** Current code length (starts at config.startingCodeLength, grows each round) */
  private _currentCodeLength: number = 0;

  /** Number of codes cracked this session */
  private _codesCracked: number = 0;

  /** Per-code time remaining in milliseconds */
  private _perCodeTimeRemainingMs: number = 0;

  /** Preview time remaining in milliseconds (input accepted during preview) */
  private _previewRemainingMs: number = 0;

  /** Reason the game ended, or null if still playing / not failed */
  private _failReason: FailReason = null;

  /** Total money earned this session (sum of baseMoneyPerCode * codeLength per crack) */
  private _totalMoneyEarned: number = 0;

  /** Upgrade bonus time in milliseconds (set externally before start) */
  private _upgradeBonusMs: number = 0;

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
  }

  // ==========================================================================
  // Public Getters
  // ==========================================================================

  /** Get the current target sequence (read-only copy) */
  get targetSequence(): readonly string[] {
    return this._targetSequence;
  }

  /** Get the player's input sequence (read-only copy) */
  get inputSequence(): readonly string[] {
    return this._inputSequence;
  }

  /** Get the current position in the sequence */
  get currentPosition(): number {
    return this._currentPosition;
  }

  /** Get the current code length */
  get currentCodeLength(): number {
    return this._currentCodeLength;
  }

  /** Get the number of codes cracked */
  get codesCracked(): number {
    return this._codesCracked;
  }

  /** Get the per-code time remaining in milliseconds */
  get perCodeTimeRemainingMs(): number {
    return this._perCodeTimeRemainingMs;
  }

  /** Get the preview time remaining in milliseconds */
  get previewRemainingMs(): number {
    return this._previewRemainingMs;
  }

  /** Whether the game is currently in the preview phase */
  get isInPreview(): boolean {
    return this._previewRemainingMs > 0;
  }

  /** Get the reason the game failed, or null */
  get failReason(): FailReason {
    return this._failReason;
  }

  /** Get the effective time limit for the current code (including scaling and bonuses) */
  get effectiveTimeLimitMs(): number {
    return this.calculateEffectiveTimeLimit();
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Set the upgrade bonus time (call before start()).
   * This is the total bonus from all upgrades (Better Keyboard + Coffee Machine).
   *
   * @param bonusMs - Bonus time in milliseconds
   */
  setUpgradeBonusMs(bonusMs: number): void {
    this._upgradeBonusMs = bonusMs;
  }

  // ==========================================================================
  // Lifecycle Implementation
  // ==========================================================================

  protected onStart(): void {
    // Bypass base class timer by setting _timeLimitMs = 0
    this._timeLimitMs = 0;

    this._currentCodeLength = this.config.startingCodeLength;
    this._codesCracked = 0;
    this._failReason = null;
    this._totalMoneyEarned = 0;

    this.generateNewSequence();
    this.resetPerCodeTimer();
  }

  protected onEnd(): void {
    // Final state: score = codes cracked (multiplied by 100 for storage compatibility)
    this._score = this._codesCracked * 100;
  }

  protected onUpdate(deltaMs: number): void {
    // Handle preview phase countdown
    if (this._previewRemainingMs > 0) {
      this._previewRemainingMs = Math.max(0, this._previewRemainingMs - deltaMs);
      // During preview, timer does not count down, but input is accepted
      return;
    }

    // Decrement per-code timer
    this._perCodeTimeRemainingMs = Math.max(0, this._perCodeTimeRemainingMs - deltaMs);

    // Check for timeout
    if (this._perCodeTimeRemainingMs <= 0) {
      this._failReason = 'timeout';
      this.emit('time-up' as MinigameEventType, { minigameId: this.id });
      this.end();
    }
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Handle a character input from the player.
   *
   * @param char - The character entered by the player (should be uppercase)
   * @returns true if the character was correct, false if wrong (game ends), null if not playing
   */
  handleCharInput(char: string): boolean | null {
    if (!this.isPlaying) {
      return null;
    }

    // Validate: must be a single character in the character set
    if (char.length !== 1 || !this.config.characterSet.includes(char)) {
      return null;
    }

    const targetChar = this._targetSequence[this._currentPosition];

    if (char === targetChar) {
      return this.handleCorrectChar(char);
    } else {
      return this.handleWrongChar(char);
    }
  }

  // ==========================================================================
  // Private Input Handlers
  // ==========================================================================

  /**
   * Handle a correct character input.
   */
  private handleCorrectChar(char: string): true {
    this._inputSequence.push(char);
    this._currentPosition++;
    this._successCount++;

    // Emit char-correct event
    this.emit('char-correct' as MinigameEventType, {
      minigameId: this.id,
      data: {
        char,
        position: this._currentPosition - 1,
      },
    });

    // Check for code completion
    if (this._currentPosition >= this._currentCodeLength) {
      this.handleCodeComplete();
    }

    return true;
  }

  /**
   * Handle a wrong character input. Immediately ends the game.
   */
  private handleWrongChar(_char: string): false {
    this._failReason = 'wrong-input';
    this._failCount++;

    // Emit char-wrong event (immediately before end)
    this.emit('char-wrong' as MinigameEventType, {
      minigameId: this.id,
      data: {
        char: _char,
        position: this._currentPosition,
      },
    });

    this.end();
    return false;
  }

  /**
   * Handle completion of a code.
   */
  private handleCodeComplete(): void {
    this._codesCracked++;

    // Accumulate money: baseMoneyPerCode * current code length
    this._totalMoneyEarned += this.config.baseMoneyPerCode * this._currentCodeLength;

    // Update score (raw codes cracked, onEnd multiplies by 100)
    this._score = this._codesCracked;

    // Emit sequence-complete event
    this.emit('sequence-complete' as MinigameEventType, {
      minigameId: this.id,
      data: {
        sequenceNumber: this._codesCracked,
        codeLength: this._currentCodeLength,
        moneyEarned: this._totalMoneyEarned,
      },
    });

    // Escalate: increase code length
    this._currentCodeLength += this.config.lengthIncrement;

    // Generate new code and reset timer
    this.generateNewSequence();
    this.resetPerCodeTimer();
  }

  // ==========================================================================
  // Timer Management
  // ==========================================================================

  /**
   * Calculate the effective time limit for the current code.
   * Formula: perCodeTimeLimitMs + (currentCodeLength - startingCodeLength) * timePerExtraCharMs + upgradeBonusMs
   */
  private calculateEffectiveTimeLimit(): number {
    const extraChars = Math.max(0, this._currentCodeLength - this.config.startingCodeLength);
    return (
      this.config.perCodeTimeLimitMs +
      extraChars * this.config.timePerExtraCharMs +
      this._upgradeBonusMs
    );
  }

  /**
   * Reset the per-code timer and preview timer for a new code.
   */
  private resetPerCodeTimer(): void {
    this._perCodeTimeRemainingMs = this.calculateEffectiveTimeLimit();
    this._previewRemainingMs = this.config.previewDurationMs;
  }

  // ==========================================================================
  // Sequence Generation
  // ==========================================================================

  /**
   * Generate a new random sequence from the character set.
   */
  private generateNewSequence(): void {
    this._targetSequence = [];
    this._inputSequence = [];
    this._currentPosition = 0;

    const charset = this.config.characterSet;
    for (let i = 0; i < this._currentCodeLength; i++) {
      const idx = Math.floor(Math.random() * charset.length);
      this._targetSequence.push(charset[idx]!);
    }
  }

  /**
   * Reset sequence state (used internally by BaseMinigame.start()).
   */
  protected override resetState(): void {
    super.resetState();
    this._targetSequence = [];
    this._inputSequence = [];
    this._currentPosition = 0;
    this._currentCodeLength = 0;
    this._codesCracked = 0;
    this._perCodeTimeRemainingMs = 0;
    this._previewRemainingMs = 0;
    this._failReason = null;
    this._totalMoneyEarned = 0;
  }

  // ==========================================================================
  // Reward Calculation
  // ==========================================================================

  /**
   * Calculate the money reward based on accumulated earnings.
   *
   * @returns Money as a string (for Decimal compatibility)
   */
  calculateMoneyReward(): string {
    return String(this._totalMoneyEarned);
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
