/**
 * Base Minigame Interface for the Hacker Incremental Game
 *
 * This module defines the abstract interface that all minigames must implement.
 * It provides common functionality for game state management, scoring, and
 * lifecycle hooks.
 *
 * Usage:
 *   import { Minigame, MinigameConfig, MinigameResult } from '@minigames/base-minigame';
 *
 *   class MyMinigame implements Minigame {
 *     // implement required methods
 *   }
 */

import type { ResourceType } from '../core/types';

// ============================================================================
// Minigame State
// ============================================================================

/**
 * Possible states for a minigame.
 */
export type MinigamePhase = 'ready' | 'playing' | 'paused' | 'ended';

/**
 * Result of a completed minigame session.
 */
export interface MinigameResult {
  /** The minigame identifier */
  minigameId: string;
  /** Final score achieved */
  score: number;
  /** Highest combo achieved during the game */
  maxCombo: number;
  /** Number of successful matches/actions */
  successCount: number;
  /** Number of failed matches/actions */
  failCount: number;
  /** Total time played in milliseconds */
  playTimeMs: number;
  /** Resources earned from this session */
  rewards: Partial<Record<ResourceType, string>>;
}

/**
 * Configuration for a minigame.
 */
export interface MinigameConfig {
  /** Unique identifier for the minigame */
  id: string;
  /** Display name */
  name: string;
  /** Brief description */
  description: string;
  /** Time limit in milliseconds (0 for no limit) */
  timeLimitMs: number;
  /** Primary resource this minigame generates */
  primaryResource: ResourceType;
  /** Base points per successful action */
  basePoints: number;
  /** Score to resource conversion rate */
  scoreToResourceRatio: number;
}

// ============================================================================
// Minigame Interface
// ============================================================================

/**
 * Interface that all minigames must implement.
 */
export interface Minigame {
  /** The minigame configuration */
  readonly config: MinigameConfig;

  /** Current game phase */
  readonly phase: MinigamePhase;

  /** Current score */
  readonly score: number;

  /** Current combo multiplier */
  readonly combo: number;

  /** Time remaining in milliseconds (if timed) */
  readonly timeRemainingMs: number;

  /**
   * Initialize the minigame.
   * Called before the first game starts.
   */
  initialize(): void;

  /**
   * Start a new game session.
   * Resets all state and begins gameplay.
   */
  start(): void;

  /**
   * Pause the current game.
   * Should stop timers but preserve state.
   */
  pause(): void;

  /**
   * Resume a paused game.
   */
  resume(): void;

  /**
   * End the current game early.
   * Calculates and returns the result.
   */
  end(): MinigameResult;

  /**
   * Update the game state.
   * Called every frame while playing.
   *
   * @param deltaMs - Time since last update in milliseconds
   */
  update(deltaMs: number): void;

  /**
   * Handle player input.
   *
   * @param input - The input to process (e.g., key pressed)
   * @returns true if input was handled, false otherwise
   */
  handleInput(input: string): boolean;

  /**
   * Get the current result (for in-progress games).
   * Returns partial result based on current state.
   */
  getCurrentResult(): MinigameResult;

  /**
   * Clean up resources when the minigame is destroyed.
   */
  destroy(): void;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Events emitted by minigames.
 */
export type MinigameEventType =
  | 'start'
  | 'pause'
  | 'resume'
  | 'end'
  | 'score'
  | 'combo'
  | 'success'
  | 'fail'
  | 'time-warning'
  | 'sequence-complete';

/**
 * Event data for minigame events.
 */
export interface MinigameEvent {
  type: MinigameEventType;
  minigameId: string;
  data?: Record<string, unknown>;
}

/**
 * Listener function for minigame events.
 */
export type MinigameEventListener = (event: MinigameEvent) => void;

// ============================================================================
// Abstract Base Class
// ============================================================================

/**
 * Abstract base class providing common minigame functionality.
 *
 * Subclasses should override the abstract methods and can use
 * the helper methods for common operations.
 */
export abstract class BaseMinigame implements Minigame {
  public readonly config: MinigameConfig;

  protected _phase: MinigamePhase = 'ready';
  protected _score: number = 0;
  protected _combo: number = 1;
  protected _maxCombo: number = 1;
  protected _successCount: number = 0;
  protected _failCount: number = 0;
  protected _timeRemainingMs: number = 0;
  protected _playTimeMs: number = 0;

  private eventListeners: Map<MinigameEventType, Set<MinigameEventListener>> = new Map();

  constructor(config: MinigameConfig) {
    this.config = config;
    this._timeRemainingMs = config.timeLimitMs;
  }

  // ========================================================================
  // Public Getters
  // ========================================================================

  get phase(): MinigamePhase {
    return this._phase;
  }

  get score(): number {
    return this._score;
  }

  get combo(): number {
    return this._combo;
  }

  get timeRemainingMs(): number {
    return this._timeRemainingMs;
  }

  // ========================================================================
  // Abstract Methods (must be implemented by subclasses)
  // ========================================================================

  /**
   * Initialize game-specific state.
   */
  protected abstract onInitialize(): void;

  /**
   * Start game-specific logic.
   */
  protected abstract onStart(): void;

  /**
   * Update game-specific logic.
   *
   * @param deltaMs - Time since last update
   */
  protected abstract onUpdate(deltaMs: number): void;

  /**
   * Handle game-specific input.
   *
   * @param input - The input to process
   * @returns true if input was handled
   */
  protected abstract onInput(input: string): boolean;

  /**
   * Clean up game-specific resources.
   */
  protected abstract onDestroy(): void;

  // ========================================================================
  // Lifecycle Methods
  // ========================================================================

  public initialize(): void {
    this.resetState();
    this.onInitialize();
  }

  public start(): void {
    if (this._phase === 'playing') {
      return;
    }

    this.resetState();
    this._phase = 'playing';
    this._timeRemainingMs = this.config.timeLimitMs;

    this.onStart();
    this.emit({ type: 'start', minigameId: this.config.id });
  }

  public pause(): void {
    if (this._phase !== 'playing') {
      return;
    }

    this._phase = 'paused';
    this.emit({ type: 'pause', minigameId: this.config.id });
  }

  public resume(): void {
    if (this._phase !== 'paused') {
      return;
    }

    this._phase = 'playing';
    this.emit({ type: 'resume', minigameId: this.config.id });
  }

  public end(): MinigameResult {
    this._phase = 'ended';
    const result = this.getCurrentResult();

    this.emit({
      type: 'end',
      minigameId: this.config.id,
      data: { result },
    });

    return result;
  }

  public update(deltaMs: number): void {
    if (this._phase !== 'playing') {
      return;
    }

    // Update play time
    this._playTimeMs += deltaMs;

    // Update timer if timed game
    if (this.config.timeLimitMs > 0) {
      this._timeRemainingMs = Math.max(0, this._timeRemainingMs - deltaMs);

      // Check for time warning (10 seconds left)
      if (this._timeRemainingMs <= 10000 && this._timeRemainingMs + deltaMs > 10000) {
        this.emit({ type: 'time-warning', minigameId: this.config.id });
      }

      // Check for game over
      if (this._timeRemainingMs <= 0) {
        this.end();
        return;
      }
    }

    // Call subclass update
    this.onUpdate(deltaMs);
  }

  public handleInput(input: string): boolean {
    if (this._phase !== 'playing') {
      return false;
    }

    return this.onInput(input);
  }

  public getCurrentResult(): MinigameResult {
    // Calculate resource reward based on score
    const resourceAmount = Math.floor(this._score * this.config.scoreToResourceRatio);

    return {
      minigameId: this.config.id,
      score: this._score,
      maxCombo: this._maxCombo,
      successCount: this._successCount,
      failCount: this._failCount,
      playTimeMs: this._playTimeMs,
      rewards: {
        [this.config.primaryResource]: String(resourceAmount),
      },
    };
  }

  public destroy(): void {
    this.eventListeners.clear();
    this.onDestroy();
  }

  // ========================================================================
  // Helper Methods for Subclasses
  // ========================================================================

  /**
   * Add points to the score.
   *
   * @param basePoints - Base points before combo multiplier
   */
  protected addScore(basePoints: number): void {
    const points = Math.floor(basePoints * this._combo);
    this._score += points;

    this.emit({
      type: 'score',
      minigameId: this.config.id,
      data: { points, total: this._score },
    });
  }

  /**
   * Increment the combo multiplier.
   */
  protected incrementCombo(): void {
    this._combo += 0.5;
    this._maxCombo = Math.max(this._maxCombo, this._combo);
    this._successCount++;

    this.emit({
      type: 'combo',
      minigameId: this.config.id,
      data: { combo: this._combo },
    });

    this.emit({
      type: 'success',
      minigameId: this.config.id,
    });
  }

  /**
   * Reset the combo multiplier.
   */
  protected resetCombo(): void {
    this._combo = 1;
    this._failCount++;

    this.emit({
      type: 'fail',
      minigameId: this.config.id,
    });
  }

  /**
   * Reset all game state.
   */
  protected resetState(): void {
    this._phase = 'ready';
    this._score = 0;
    this._combo = 1;
    this._maxCombo = 1;
    this._successCount = 0;
    this._failCount = 0;
    this._timeRemainingMs = this.config.timeLimitMs;
    this._playTimeMs = 0;
  }

  // ========================================================================
  // Event System
  // ========================================================================

  /**
   * Subscribe to minigame events.
   *
   * @param type - Event type to listen for
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  public on(type: MinigameEventType, listener: MinigameEventListener): () => void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }

    this.eventListeners.get(type)!.add(listener);

    return () => {
      this.eventListeners.get(type)?.delete(listener);
    };
  }

  /**
   * Emit a minigame event.
   *
   * @param event - The event to emit
   */
  protected emit(event: MinigameEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      for (const listener of listeners) {
        listener(event);
      }
    }
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format time remaining as MM:SS.
 *
 * @param ms - Time in milliseconds
 * @returns Formatted time string
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format combo multiplier for display.
 *
 * @param combo - The combo multiplier
 * @returns Formatted combo string (e.g., "x1.5")
 */
export function formatCombo(combo: number): string {
  if (combo === Math.floor(combo)) {
    return `x${combo}`;
  }
  return `x${combo.toFixed(1)}`;
}
