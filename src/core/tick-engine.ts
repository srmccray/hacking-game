/**
 * Tick Engine for the Hacker Incremental Game
 *
 * This module manages the idle progression game loop, calculating and awarding
 * auto-generated resources based on top minigame scores each frame.
 *
 * The engine uses requestAnimationFrame for smooth updates and accumulates
 * fractional resources to ensure accurate generation over time.
 *
 * Features:
 * - Frame-independent updates using delta time
 * - Fractional resource accumulation
 * - Delta time capping to prevent large jumps on tab focus
 * - Pause/resume functionality
 * - HUD rate display updates
 *
 * Usage:
 *   import { startTickEngine, stopTickEngine, pauseTickEngine, resumeTickEngine } from '@core/tick-engine';
 *
 *   // Start the engine (call once on game init)
 *   startTickEngine();
 *
 *   // Pause during minigames or menus
 *   pauseTickEngine();
 *   resumeTickEngine();
 *
 *   // Stop on game shutdown
 *   stopTickEngine();
 */

import Decimal from 'break_eternity.js';
import { useGameStore } from './game-state';
import { getMoneyGenerationRate } from './auto-generation';
import { decimalToString, ZERO } from './resource-manager';
import { updateAutoRate } from '../ui/hud';
import { TICK_CONFIG } from './game-config';

// ============================================================================
// Tick Engine State Interface
// ============================================================================

interface AccumulatedResources {
  money: Decimal;
  technique: Decimal;
  renown: Decimal;
}

// ============================================================================
// Tick Engine Class
// ============================================================================

/**
 * Encapsulates all tick engine state and logic.
 * Using a class prevents module-level mutable state issues.
 */
class TickEngineInstance {
  /** Whether the tick engine is running */
  private _isRunning = false;

  /** Whether the tick engine is paused (still "running" but not processing) */
  private _isPaused = false;

  /** Timestamp of the last frame */
  private _lastFrameTime = 0;

  /** Time since last HUD update */
  private _timeSinceHudUpdate = 0;

  /** Accumulated fractional resources (not yet whole enough to add to store) */
  private readonly _accumulatedResources: AccumulatedResources = {
    money: new Decimal(0),
    technique: new Decimal(0),
    renown: new Decimal(0),
  };

  /** requestAnimationFrame ID for cancellation */
  private _animationFrameId: number | null = null;

  /** Current generation rate (cached for display and offline calculations) */
  private _currentMoneyRate: Decimal = ZERO;

  /** Bound tick function to maintain 'this' context */
  private readonly _boundTick: (currentTime: number) => void;

  constructor() {
    // Bind the tick function once in constructor
    this._boundTick = this.tick.bind(this);
  }

  // ==========================================================================
  // Tick Engine Core
  // ==========================================================================

  /**
   * The main tick function, called every frame.
   *
   * @param currentTime - High resolution timestamp from requestAnimationFrame
   */
  private tick(currentTime: number): void {
    if (!this._isRunning) {
      return;
    }

    // Calculate delta time
    const deltaMs = this._lastFrameTime === 0 ? 0 : currentTime - this._lastFrameTime;
    this._lastFrameTime = currentTime;

    // Skip processing if paused, but keep the loop running
    if (!this._isPaused && deltaMs > 0) {
      // Cap delta time to prevent huge jumps
      const cappedDeltaMs = Math.min(deltaMs, TICK_CONFIG.maxDeltaMs);
      const deltaSeconds = cappedDeltaMs / 1000;

      // Process resource generation
      this.processGeneration(deltaSeconds);

      // Update HUD periodically
      this._timeSinceHudUpdate += cappedDeltaMs;
      if (this._timeSinceHudUpdate >= TICK_CONFIG.hudUpdateIntervalMs) {
        this.updateHudDisplay();
        this._timeSinceHudUpdate = 0;
      }
    }

    // Continue the loop
    this._animationFrameId = requestAnimationFrame(this._boundTick);
  }

  /**
   * Process auto-generation of resources for the given time delta.
   *
   * @param deltaSeconds - Time elapsed in seconds
   */
  private processGeneration(deltaSeconds: number): void {
    const store = useGameStore.getState();

    // Calculate current money generation rate
    this._currentMoneyRate = getMoneyGenerationRate();

    // Calculate money generated this frame
    const moneyGenerated = this._currentMoneyRate.mul(deltaSeconds);

    // Accumulate fractional resources
    this._accumulatedResources.money = this._accumulatedResources.money.add(moneyGenerated);

    // Check if we have whole units to add
    if (this._accumulatedResources.money.gte(1)) {
      // Get the whole number part
      const wholeAmount = this._accumulatedResources.money.floor();

      // Add to store
      store.addResource('money', decimalToString(wholeAmount));

      // Track for stats
      store.trackResourceEarned('money', decimalToString(wholeAmount));

      // Keep only the fractional part
      this._accumulatedResources.money = this._accumulatedResources.money.sub(wholeAmount);
    }

    // Placeholder for future resources (technique, renown)
    // These will follow the same pattern when implemented
  }

  /**
   * Update the HUD with the current generation rate.
   */
  private updateHudDisplay(): void {
    // Update the HUD with current money rate
    updateAutoRate(decimalToString(this._currentMoneyRate));
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start the tick engine.
   * Should be called once during game initialization.
   * Does nothing if already running.
   */
  start(): void {
    if (this._isRunning) {
      console.warn('Tick engine is already running');
      return;
    }

    this._isRunning = true;
    this._isPaused = false;
    this._lastFrameTime = 0;
    this._timeSinceHudUpdate = 0;

    // Reset accumulated resources
    this._accumulatedResources.money = new Decimal(0);
    this._accumulatedResources.technique = new Decimal(0);
    this._accumulatedResources.renown = new Decimal(0);

    // Initial HUD update
    this._currentMoneyRate = getMoneyGenerationRate();
    this.updateHudDisplay();

    // Start the tick loop
    this._animationFrameId = requestAnimationFrame(this._boundTick);

    console.log('Tick engine started');
  }

  /**
   * Stop the tick engine completely.
   * Should be called during game shutdown or HMR cleanup.
   */
  stop(): void {
    if (!this._isRunning) {
      return;
    }

    this._isRunning = false;
    this._isPaused = false;

    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }

    console.log('Tick engine stopped');
  }

  /**
   * Pause the tick engine.
   * The engine loop continues but resources are not generated.
   * Useful during minigames or menus.
   */
  pause(): void {
    if (!this._isRunning || this._isPaused) {
      return;
    }

    this._isPaused = true;
    console.log('Tick engine paused');
  }

  /**
   * Resume the tick engine after being paused.
   */
  resume(): void {
    if (!this._isRunning || !this._isPaused) {
      return;
    }

    this._isPaused = false;
    // Reset lastFrameTime to prevent large delta on resume
    this._lastFrameTime = 0;
    console.log('Tick engine resumed');
  }

  /**
   * Check if the tick engine is running.
   *
   * @returns true if the engine is running (may be paused)
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Check if the tick engine is paused.
   *
   * @returns true if the engine is running but paused
   */
  get isPaused(): boolean {
    return this._isRunning && this._isPaused;
  }

  /**
   * Get the current money generation rate per second.
   * This is the cached rate from the last tick.
   *
   * @returns Rate as Decimal
   */
  get currentMoneyRate(): Decimal {
    return this._currentMoneyRate;
  }

  /**
   * Get the current money generation rate as a string.
   * Convenience function for use with offline progression.
   *
   * @returns Rate as string
   */
  get currentMoneyRateString(): string {
    return decimalToString(this._currentMoneyRate);
  }

  /**
   * Force a recalculation of the generation rate.
   * Useful after purchasing upgrades that affect the rate.
   */
  recalculateRate(): void {
    this._currentMoneyRate = getMoneyGenerationRate();
    this.updateHudDisplay();
  }

  /**
   * Manually trigger resource generation for a given amount of time.
   * Used by offline progression to "catch up" for time spent away.
   * Does not use the tick loop - directly calculates and awards resources.
   *
   * @param seconds - Number of seconds of generation to process
   * @param efficiency - Efficiency multiplier (1.0 = 100%, 0.5 = 50%)
   * @returns Object with amounts generated for each resource
   */
  processOfflineGeneration(seconds: number, efficiency: number = 1.0): { money: Decimal } {
    // Get current rates (recalculate fresh)
    const moneyRate = getMoneyGenerationRate();

    // Calculate total generation with efficiency
    const moneyGenerated = moneyRate.mul(seconds).mul(efficiency);

    // Award resources if positive
    if (moneyGenerated.gt(0)) {
      const store = useGameStore.getState();
      store.addResource('money', decimalToString(moneyGenerated));
      store.trackResourceEarned('money', decimalToString(moneyGenerated));
    }

    return {
      money: moneyGenerated,
    };
  }

  /**
   * Get the accumulated (fractional) resources that haven't been added yet.
   * For debugging purposes.
   *
   * @returns Object with accumulated amounts
   */
  getAccumulatedResources(): AccumulatedResources {
    return { ...this._accumulatedResources };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * The singleton tick engine instance.
 * Using a singleton ensures consistent state across the application.
 */
const tickEngine = new TickEngineInstance();

// ============================================================================
// Exported Functions (maintain backward compatibility)
// ============================================================================

/**
 * Start the tick engine.
 * Should be called once during game initialization.
 * Does nothing if already running.
 */
export function startTickEngine(): void {
  tickEngine.start();
}

/**
 * Stop the tick engine completely.
 * Should be called during game shutdown or HMR cleanup.
 */
export function stopTickEngine(): void {
  tickEngine.stop();
}

/**
 * Pause the tick engine.
 * The engine loop continues but resources are not generated.
 * Useful during minigames or menus.
 */
export function pauseTickEngine(): void {
  tickEngine.pause();
}

/**
 * Resume the tick engine after being paused.
 */
export function resumeTickEngine(): void {
  tickEngine.resume();
}

/**
 * Check if the tick engine is running.
 *
 * @returns true if the engine is running (may be paused)
 */
export function isTickEngineRunning(): boolean {
  return tickEngine.isRunning;
}

/**
 * Check if the tick engine is paused.
 *
 * @returns true if the engine is running but paused
 */
export function isTickEnginePaused(): boolean {
  return tickEngine.isPaused;
}

/**
 * Get the current money generation rate per second.
 * This is the cached rate from the last tick.
 *
 * @returns Rate as Decimal
 */
export function getCurrentMoneyRate(): Decimal {
  return tickEngine.currentMoneyRate;
}

/**
 * Get the current money generation rate as a string.
 * Convenience function for use with offline progression.
 *
 * @returns Rate as string
 */
export function getCurrentMoneyRateString(): string {
  return tickEngine.currentMoneyRateString;
}

/**
 * Force a recalculation of the generation rate.
 * Useful after purchasing upgrades that affect the rate.
 */
export function recalculateRate(): void {
  tickEngine.recalculateRate();
}

/**
 * Manually trigger resource generation for a given amount of time.
 * Used by offline progression to "catch up" for time spent away.
 * Does not use the tick loop - directly calculates and awards resources.
 *
 * @param seconds - Number of seconds of generation to process
 * @param efficiency - Efficiency multiplier (1.0 = 100%, 0.5 = 50%)
 * @returns Object with amounts generated for each resource
 */
export function processOfflineGeneration(
  seconds: number,
  efficiency: number = 1.0
): { money: Decimal } {
  return tickEngine.processOfflineGeneration(seconds, efficiency);
}

/**
 * Get the accumulated (fractional) resources that haven't been added yet.
 * For debugging purposes.
 *
 * @returns Object with accumulated amounts
 */
export function getAccumulatedResources(): AccumulatedResources {
  return tickEngine.getAccumulatedResources();
}

/**
 * Get the tick engine instance for testing purposes.
 * Not recommended for production use - use the exported functions instead.
 */
export function getTickEngineInstance(): TickEngineInstance {
  return tickEngine;
}
