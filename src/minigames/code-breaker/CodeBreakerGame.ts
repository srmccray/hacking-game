/**
 * Code Breaker Game Logic
 *
 * A per-code countdown challenge where players type characters to match a target
 * sequence before time runs out. Features:
 * - Character set (A-Z = 26 letters)
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
 * - Score = number of codes cracked
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
// Milestone Thresholds
// ============================================================================

/**
 * Code-length milestones that trigger a reputation reward overlay.
 * When the player's code length reaches one of these values after cracking a code,
 * a milestone overlay is shown.
 *
 * Namespaced as 10000 + length for global storage to avoid collision with
 * Code Runner's wall thresholds (15, 30, 45).
 */
export const CODE_LENGTH_MILESTONE_THRESHOLDS: readonly number[] = [10, 15, 20] as const;

/** Namespace offset for Code Breaker milestones in the global store. */
export const CODE_BREAKER_MILESTONE_NAMESPACE = 10000;

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
  | 'typo-used'
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

  /** Code length reduction from upgrades (set externally before start) */
  private _codeLengthReduction: number = 0;

  /** Number of typos allowed per game from upgrades (set externally before start) */
  private _typoAllowance: number = 0;

  /** Number of typos remaining in the current game */
  private _typosRemaining: number = 0;

  /** Code-length milestones triggered this session (to avoid re-triggering). */
  private _triggeredMilestones: Set<number> = new Set();

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

  /** Get the number of typos remaining in this game */
  get typosRemaining(): number {
    return this._typosRemaining;
  }

  /** Get the total typo allowance (from upgrades) */
  get typoAllowance(): number {
    return this._typoAllowance;
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
   * This is the total bonus from all upgrades (Better Keyboard).
   *
   * @param bonusMs - Bonus time in milliseconds
   */
  setUpgradeBonusMs(bonusMs: number): void {
    this._upgradeBonusMs = bonusMs;
  }

  /**
   * Set the code length reduction (call before start()).
   * This reduces the starting code length from the Entropy Reducer upgrade.
   *
   * @param reduction - Number of characters to reduce from starting code length
   */
  setCodeLengthReduction(reduction: number): void {
    this._codeLengthReduction = reduction;
  }

  /**
   * Set the typo allowance (call before start()).
   * This is the number of wrong inputs allowed before game over,
   * from the Error Correction upgrade.
   *
   * @param count - Number of typos allowed per game
   */
  setTypoAllowance(count: number): void {
    this._typoAllowance = count;
  }

  // ==========================================================================
  // Lifecycle Implementation
  // ==========================================================================

  protected onStart(): void {
    // Bypass base class timer by setting _timeLimitMs = 0
    this._timeLimitMs = 0;

    this._currentCodeLength = Math.max(1, this.config.startingCodeLength - this._codeLengthReduction);
    this._codesCracked = 0;
    this._failReason = null;
    this._totalMoneyEarned = 0;
    this._typosRemaining = this._typoAllowance;
    this._triggeredMilestones = new Set();

    this.generateNewSequence();
    this.resetPerCodeTimer();
  }

  protected onEnd(): void {
    // Final state: score = codes cracked
    this._score = this._codesCracked;
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
   * Handle a wrong character input.
   * If typos remain, uses one and continues. Otherwise ends the game.
   */
  private handleWrongChar(_char: string): false {
    this._failCount++;

    if (this._typosRemaining > 0) {
      // Use a typo allowance instead of ending
      this._typosRemaining--;

      // Emit typo-used event for UI feedback
      this.emit('typo-used' as MinigameEventType, {
        minigameId: this.id,
        data: {
          char: _char,
          position: this._currentPosition,
          typosRemaining: this._typosRemaining,
        },
      });

      return false;
    }

    // No typos remaining - game over
    this._failReason = 'wrong-input';

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

    // Save old code length for money calculation (earned for the code just completed)
    const completedCodeLength = this._currentCodeLength;

    // Accumulate money: baseMoneyPerCode * completed code length
    this._totalMoneyEarned += this.config.baseMoneyPerCode * completedCodeLength;

    // Update score (equal to codes cracked count)
    this._score = this._codesCracked;

    // Escalate: increase code length BEFORE emitting so listeners see updated state
    this._currentCodeLength += this.config.lengthIncrement;

    // Check code-length milestones after incrementing
    this.checkCodeLengthMilestones();

    // Generate new code and reset timer BEFORE emitting so display rebuilds with new sequence
    this.generateNewSequence();
    this.resetPerCodeTimer();

    // Emit sequence-complete event with the NEW code length so the scene
    // can rebuild the display with the correct number of boxes
    this.emit('sequence-complete' as MinigameEventType, {
      minigameId: this.id,
      data: {
        sequenceNumber: this._codesCracked,
        codeLength: this._currentCodeLength,
        moneyEarned: this._totalMoneyEarned,
      },
    });
  }

  // ==========================================================================
  // Milestone Checking
  // ==========================================================================

  /**
   * Check if any code-length milestone thresholds have been crossed.
   * Emits a 'milestone-reached' event for each newly crossed threshold
   * that hasn't been triggered in this session. Pauses the game on trigger.
   */
  private checkCodeLengthMilestones(): void {
    for (const threshold of CODE_LENGTH_MILESTONE_THRESHOLDS) {
      if (this._currentCodeLength >= threshold && !this._triggeredMilestones.has(threshold)) {
        this._triggeredMilestones.add(threshold);
        this.pause();
        this.emit('milestone-reached' as MinigameEventType, {
          minigameId: this.id,
          data: {
            thresholdValue: threshold,
          },
        });
        // Only trigger one milestone at a time
        return;
      }
    }
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
    this._typosRemaining = this._typoAllowance;
    this._triggeredMilestones = new Set();
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
