/**
 * Base Minigame Abstract Class
 *
 * Provides common functionality for all minigames including:
 * - Event emitter pattern for game events (score, combo, complete, etc.)
 * - Score and combo tracking with automatic maxCombo recording
 * - Timer management for timed minigames
 * - Lifecycle methods (start, end, pause, resume)
 *
 * Subclasses must implement:
 * - id: Unique identifier for the minigame
 * - onStart(): Called when the minigame starts
 * - onEnd(): Called when the minigame ends
 * - onUpdate(deltaMs): Called every frame while playing
 *
 * Usage:
 *   class CodeBreakerGame extends BaseMinigame {
 *     readonly id = 'code-breaker';
 *
 *     protected onStart(): void {
 *       this.generateSequence();
 *     }
 *
 *     protected onEnd(): void {
 *       // Calculate rewards
 *     }
 *
 *     protected onUpdate(deltaMs: number): void {
 *       this.updateTimer(deltaMs);
 *     }
 *   }
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Possible states for a minigame.
 */
export type MinigamePhase = 'idle' | 'playing' | 'paused' | 'ended';

/**
 * Minigame event types for the internal event emitter.
 */
export type MinigameEventType =
  | 'start'
  | 'end'
  | 'pause'
  | 'resume'
  | 'score'
  | 'combo'
  | 'combo-reset'
  | 'time-warning'
  | 'time-up';

/**
 * Base payload for all minigame events.
 */
export interface MinigameEventPayload {
  /** The minigame ID */
  minigameId: string;
  /** Event-specific data */
  data?: Record<string, unknown>;
}

/**
 * Score event payload.
 */
export interface ScoreEventPayload extends MinigameEventPayload {
  data: {
    /** Points added in this event */
    pointsAdded: number;
    /** New total score */
    totalScore: number;
  };
}

/**
 * Combo event payload.
 */
export interface ComboEventPayload extends MinigameEventPayload {
  data: {
    /** New combo value */
    combo: number;
    /** Whether this is a new max combo */
    isNewMax: boolean;
  };
}

/**
 * End event payload with final stats.
 */
export interface EndEventPayload extends MinigameEventPayload {
  data: {
    /** Final score */
    score: number;
    /** Maximum combo achieved */
    maxCombo: number;
    /** Duration in milliseconds */
    durationMs: number;
    /** Number of successful actions */
    successCount: number;
    /** Number of failed actions */
    failCount: number;
  };
}

/**
 * Type for event listener callbacks.
 */
export type MinigameEventListener<T extends MinigameEventPayload = MinigameEventPayload> = (
  payload: T
) => void;

// ============================================================================
// Abstract Base Class
// ============================================================================

/**
 * Abstract base class for all minigames.
 *
 * Provides common functionality and enforces a consistent interface
 * for minigame implementations.
 */
export abstract class BaseMinigame {
  // ==========================================================================
  // Abstract Properties (must be implemented by subclasses)
  // ==========================================================================

  /**
   * Unique identifier for this minigame.
   */
  abstract readonly id: string;

  // ==========================================================================
  // State
  // ==========================================================================

  /** Current game phase */
  protected _phase: MinigamePhase = 'idle';

  /** Current score */
  protected _score: number = 0;

  /** Current combo multiplier */
  protected _combo: number = 1;

  /** Maximum combo achieved this session */
  protected _maxCombo: number = 1;

  /** Count of successful actions */
  protected _successCount: number = 0;

  /** Count of failed actions */
  protected _failCount: number = 0;

  /** Time remaining in milliseconds (for timed games, 0 = no limit) */
  protected _timeRemainingMs: number = 0;

  /** Total time limit for the minigame */
  protected _timeLimitMs: number = 0;

  /** Timestamp when the game started */
  protected _startTime: number = 0;

  /** Total play time in milliseconds */
  protected _playTimeMs: number = 0;

  // ==========================================================================
  // Event Emitter
  // ==========================================================================

  /** Event listeners keyed by event type */
  private readonly eventListeners: Map<MinigameEventType, Set<MinigameEventListener>> = new Map();

  // ==========================================================================
  // Public Getters
  // ==========================================================================

  /** Current game phase */
  get phase(): MinigamePhase {
    return this._phase;
  }

  /** Current score */
  get score(): number {
    return this._score;
  }

  /** Current combo multiplier */
  get combo(): number {
    return this._combo;
  }

  /** Maximum combo achieved */
  get maxCombo(): number {
    return this._maxCombo;
  }

  /** Time remaining in milliseconds */
  get timeRemainingMs(): number {
    return this._timeRemainingMs;
  }

  /** Time limit in milliseconds */
  get timeLimitMs(): number {
    return this._timeLimitMs;
  }

  /** Whether the game is currently active */
  get isPlaying(): boolean {
    return this._phase === 'playing';
  }

  /** Whether the game is paused */
  get isPaused(): boolean {
    return this._phase === 'paused';
  }

  /** Number of successful actions */
  get successCount(): number {
    return this._successCount;
  }

  /** Number of failed actions */
  get failCount(): number {
    return this._failCount;
  }

  /** Total play time in milliseconds */
  get playTimeMs(): number {
    return this._playTimeMs;
  }

  // ==========================================================================
  // Abstract Methods (must be implemented by subclasses)
  // ==========================================================================

  /**
   * Called when the minigame starts.
   * Implement to set up initial game state, generate sequences, etc.
   */
  protected abstract onStart(): void;

  /**
   * Called when the minigame ends.
   * Implement to calculate rewards, clean up state, etc.
   */
  protected abstract onEnd(): void;

  /**
   * Called every frame while playing.
   * Implement to update game logic, check conditions, etc.
   *
   * @param deltaMs - Time since last update in milliseconds
   */
  protected abstract onUpdate(deltaMs: number): void;

  // ==========================================================================
  // Lifecycle Methods
  // ==========================================================================

  /**
   * Start the minigame.
   *
   * Resets all state and calls onStart().
   * Does nothing if already playing.
   */
  start(): void {
    if (this._phase === 'playing') {
      console.warn(`[${this.id}] Already playing, ignoring start()`);
      return;
    }

    // Reset state
    this.resetState();
    this._phase = 'playing';
    this._startTime = performance.now();

    // Call subclass implementation
    this.onStart();

    // Emit event
    this.emit('start', { minigameId: this.id });
  }

  /**
   * End the minigame.
   *
   * Calculates final stats and calls onEnd().
   * Does nothing if not playing.
   */
  end(): void {
    if (this._phase !== 'playing' && this._phase !== 'paused') {
      return;
    }

    this._phase = 'ended';

    // Call subclass implementation
    this.onEnd();

    // Emit end event with final stats
    this.emit('end', {
      minigameId: this.id,
      data: {
        score: this._score,
        maxCombo: this._maxCombo,
        durationMs: this._playTimeMs,
        successCount: this._successCount,
        failCount: this._failCount,
      },
    } as EndEventPayload);
  }

  /**
   * Pause the minigame.
   * Preserves state but stops updates.
   */
  pause(): void {
    if (this._phase !== 'playing') {
      return;
    }

    this._phase = 'paused';
    this.emit('pause', { minigameId: this.id });
  }

  /**
   * Resume a paused minigame.
   */
  resume(): void {
    if (this._phase !== 'paused') {
      return;
    }

    this._phase = 'playing';
    this.emit('resume', { minigameId: this.id });
  }

  /**
   * Update the minigame state.
   * Call this every frame from the game loop.
   *
   * @param deltaMs - Time since last update in milliseconds
   */
  update(deltaMs: number): void {
    if (this._phase !== 'playing') {
      return;
    }

    // Track play time
    this._playTimeMs += deltaMs;

    // Update timer if this is a timed game
    if (this._timeLimitMs > 0) {
      const previousTime = this._timeRemainingMs;
      this._timeRemainingMs = Math.max(0, this._timeRemainingMs - deltaMs);

      // Check for time warning (10 seconds remaining)
      if (previousTime > 10000 && this._timeRemainingMs <= 10000) {
        this.emit('time-warning', { minigameId: this.id });
      }

      // Check for time up
      if (this._timeRemainingMs <= 0) {
        this.emit('time-up', { minigameId: this.id });
        this.end();
        return;
      }
    }

    // Call subclass update
    this.onUpdate(deltaMs);
  }

  // ==========================================================================
  // Scoring Methods
  // ==========================================================================

  /**
   * Add points to the score.
   * Points are multiplied by the current combo.
   *
   * @param basePoints - Base points before combo multiplier
   */
  protected addScore(basePoints: number): void {
    const pointsWithCombo = Math.floor(basePoints * this._combo);
    this._score += pointsWithCombo;

    this.emit('score', {
      minigameId: this.id,
      data: {
        pointsAdded: pointsWithCombo,
        totalScore: this._score,
      },
    } as ScoreEventPayload);
  }

  /**
   * Add raw points to the score without combo multiplier.
   *
   * @param points - Points to add
   */
  protected addRawScore(points: number): void {
    this._score += points;

    this.emit('score', {
      minigameId: this.id,
      data: {
        pointsAdded: points,
        totalScore: this._score,
      },
    } as ScoreEventPayload);
  }

  // ==========================================================================
  // Combo Methods
  // ==========================================================================

  /**
   * Increment the combo multiplier.
   * Call this on successful actions.
   *
   * @param increment - Amount to add to combo (default: 1)
   */
  protected incrementCombo(increment: number = 1): void {
    this._combo += increment;
    const isNewMax = this._combo > this._maxCombo;

    if (isNewMax) {
      this._maxCombo = this._combo;
    }

    this._successCount++;

    this.emit('combo', {
      minigameId: this.id,
      data: {
        combo: this._combo,
        isNewMax,
      },
    } as ComboEventPayload);
  }

  /**
   * Reset the combo multiplier to 1.
   * Call this on failed actions.
   */
  protected resetCombo(): void {
    const wasReset = this._combo > 1;
    this._combo = 1;
    this._failCount++;

    if (wasReset) {
      this.emit('combo-reset', { minigameId: this.id });
    }
  }

  // ==========================================================================
  // Timer Methods
  // ==========================================================================

  /**
   * Set the time limit for the minigame.
   * Call this in constructor or onStart().
   *
   * @param ms - Time limit in milliseconds (0 for no limit)
   */
  protected setTimeLimit(ms: number): void {
    this._timeLimitMs = ms;
    this._timeRemainingMs = ms;
  }

  /**
   * Add bonus time.
   *
   * @param ms - Milliseconds to add
   */
  protected addTime(ms: number): void {
    this._timeRemainingMs += ms;
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Reset all state to initial values.
   */
  protected resetState(): void {
    this._phase = 'idle';
    this._score = 0;
    this._combo = 1;
    this._maxCombo = 1;
    this._successCount = 0;
    this._failCount = 0;
    this._timeRemainingMs = this._timeLimitMs;
    this._startTime = 0;
    this._playTimeMs = 0;
  }

  /**
   * Get final stats for the minigame session.
   * Useful for reward calculations.
   */
  getFinalStats(): {
    score: number;
    maxCombo: number;
    durationMs: number;
    successCount: number;
    failCount: number;
  } {
    return {
      score: this._score,
      maxCombo: this._maxCombo,
      durationMs: this._playTimeMs,
      successCount: this._successCount,
      failCount: this._failCount,
    };
  }

  // ==========================================================================
  // Event Emitter
  // ==========================================================================

  /**
   * Subscribe to minigame events.
   *
   * @param eventType - The event type to listen for
   * @param listener - Callback function
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = game.on('score', (payload) => {
   *   console.log('Score:', payload.data.totalScore);
   * });
   *
   * // Later: unsubscribe();
   * ```
   */
  on<T extends MinigameEventPayload = MinigameEventPayload>(
    eventType: MinigameEventType,
    listener: MinigameEventListener<T>
  ): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }

    const listeners = this.eventListeners.get(eventType)!;
    listeners.add(listener as MinigameEventListener);

    // Return unsubscribe function
    return () => {
      listeners.delete(listener as MinigameEventListener);
    };
  }

  /**
   * Remove a specific event listener.
   *
   * @param eventType - The event type
   * @param listener - The listener to remove
   */
  off<T extends MinigameEventPayload = MinigameEventPayload>(
    eventType: MinigameEventType,
    listener: MinigameEventListener<T>
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener as MinigameEventListener);
    }
  }

  /**
   * Emit an event to all listeners.
   *
   * @param eventType - The event type to emit
   * @param payload - The event payload
   */
  protected emit(eventType: MinigameEventType, payload: MinigameEventPayload): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(payload);
        } catch (error) {
          console.error(`[${this.id}] Error in ${eventType} listener:`, error);
        }
      }
    }
  }

  /**
   * Remove all event listeners.
   */
  clearListeners(): void {
    this.eventListeners.clear();
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clean up the minigame.
   * Call this when the minigame is being destroyed.
   */
  destroy(): void {
    if (this._phase === 'playing' || this._phase === 'paused') {
      this.end();
    }
    this.clearListeners();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format milliseconds as MM:SS string.
 *
 * @param ms - Time in milliseconds
 * @returns Formatted time string
 */
export function formatTimeMMSS(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format combo multiplier for display.
 *
 * @param combo - The combo value
 * @returns Formatted string (e.g., "x3", "x1.5")
 */
export function formatCombo(combo: number): string {
  if (combo === Math.floor(combo)) {
    return `x${combo}`;
  }
  return `x${combo.toFixed(1)}`;
}
