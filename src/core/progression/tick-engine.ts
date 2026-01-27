/**
 * Tick Engine for Idle Progression
 *
 * This module manages the game tick loop that applies auto-generation
 * resources based on the player's top minigame scores.
 *
 * Features:
 * - Runs at frame rate using requestAnimationFrame
 * - Applies auto-generation based on calculated rate
 * - Provides rate display updates for HUD
 * - Tracks play time for stats
 *
 * Usage:
 *   import { TickEngine } from './tick-engine';
 *
 *   const tickEngine = new TickEngine(store, config);
 *   tickEngine.start();
 *
 *   // Update HUD rate display
 *   tickEngine.onRateUpdate((rate) => hud.updateRate(rate));
 *
 *   // On shutdown
 *   tickEngine.stop();
 */

import { toDecimal, multiplyDecimals, formatRate, ZERO } from '../resources/resource-manager';
import { getMoneyGenerationRate, hasActiveGeneration } from './auto-generation';
import { processAutomations } from './automations';
import type { GameStore } from '../state/game-store';
import type { GameConfig } from '../../game/GameConfig';

// ============================================================================
// Types
// ============================================================================

/**
 * Callback for rate updates.
 */
export type RateUpdateCallback = (rate: string, formattedRate: string) => void;

// ============================================================================
// Tick Engine
// ============================================================================

/**
 * Tick engine class that manages idle progression.
 */
export class TickEngine {
  /** Whether the engine is currently running */
  private running = false;

  /** Timestamp of last tick */
  private lastTick = 0;

  /** Request animation frame ID */
  private tickId: number | null = null;

  /** Bound tick handler for cleanup */
  private readonly boundTick: () => void;

  /** Callback for rate updates */
  private rateUpdateCallback: RateUpdateCallback | null = null;

  /** Last time HUD was updated */
  private lastHudUpdate = 0;

  /** Current money rate (cached for display) */
  private currentMoneyRate: string = ZERO;

  /**
   * Create a new tick engine.
   *
   * @param store - The game store
   * @param config - Game configuration
   */
  constructor(
    private readonly store: GameStore,
    private readonly config: GameConfig
  ) {
    this.boundTick = this.tick.bind(this);
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  /**
   * Start the tick engine.
   */
  start(): void {
    if (this.running) {
      console.warn('[TickEngine] Already running');
      return;
    }

    this.running = true;
    this.lastTick = performance.now();
    this.lastHudUpdate = this.lastTick;

    // Calculate initial rate
    this.recalculateRate();

    // Start the loop
    this.tickId = requestAnimationFrame(this.boundTick);
    console.log('[TickEngine] Started');
  }

  /**
   * Stop the tick engine.
   */
  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    if (this.tickId !== null) {
      cancelAnimationFrame(this.tickId);
      this.tickId = null;
    }
    console.log('[TickEngine] Stopped');
  }

  /**
   * Check if the engine is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  // ==========================================================================
  // Tick Loop
  // ==========================================================================

  /**
   * Main tick loop.
   */
  private tick(): void {
    if (!this.running) {
      return;
    }

    const now = performance.now();
    const deltaMs = Math.min(now - this.lastTick, this.config.gameplay.maxDeltaMs);
    this.lastTick = now;

    // Apply auto-generation
    this.applyAutoGeneration(deltaMs);

    // Process automations (uses wall clock time for intervals)
    processAutomations(this.store, Date.now());

    // Track play time
    this.store.getState().addPlayTime(deltaMs);

    // Update HUD rate display periodically
    if (now - this.lastHudUpdate >= this.config.gameplay.hudUpdateIntervalMs) {
      this.lastHudUpdate = now;
      this.recalculateRate();
      this.notifyRateUpdate();
    }

    // Schedule next tick
    this.tickId = requestAnimationFrame(this.boundTick);
  }

  /**
   * Apply auto-generation resources based on the current rate.
   *
   * @param deltaMs - Time since last tick in milliseconds
   */
  private applyAutoGeneration(deltaMs: number): void {
    if (!hasActiveGeneration(this.store, this.config)) {
      return;
    }

    const rate = this.currentMoneyRate;
    if (toDecimal(rate).lte(0)) {
      return;
    }

    // Calculate amount: rate * (deltaMs / 1000)
    const deltaSeconds = deltaMs / 1000;
    const amount = multiplyDecimals(rate, deltaSeconds);

    // Only add if amount is positive (avoid adding 0)
    if (toDecimal(amount).gt(0)) {
      const state = this.store.getState();
      state.addResource('money', amount);
      state.trackResourceEarned('money', amount);
    }
  }

  // ==========================================================================
  // Rate Management
  // ==========================================================================

  /**
   * Recalculate the current generation rate.
   * Called when upgrades are purchased or scores change.
   */
  recalculateRate(): void {
    this.currentMoneyRate = getMoneyGenerationRate(this.store, this.config);
  }

  /**
   * Force a rate recalculation and notify listeners.
   * Useful after upgrades or score changes.
   */
  forceRateUpdate(): void {
    this.recalculateRate();
    this.notifyRateUpdate();
  }

  /**
   * Get the current money generation rate.
   */
  getCurrentRate(): string {
    return this.currentMoneyRate;
  }

  /**
   * Get the formatted rate for display.
   */
  getFormattedRate(): string {
    return formatRate(this.currentMoneyRate);
  }

  // ==========================================================================
  // Callbacks
  // ==========================================================================

  /**
   * Set the callback for rate updates.
   *
   * @param callback - Function to call when rate changes
   */
  onRateUpdate(callback: RateUpdateCallback): void {
    this.rateUpdateCallback = callback;
  }

  /**
   * Notify the rate update callback.
   */
  private notifyRateUpdate(): void {
    if (this.rateUpdateCallback) {
      this.rateUpdateCallback(this.currentMoneyRate, formatRate(this.currentMoneyRate));
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Destroy the tick engine.
   */
  destroy(): void {
    this.stop();
    this.rateUpdateCallback = null;
  }
}
