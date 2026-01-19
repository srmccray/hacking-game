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

// ============================================================================
// Configuration
// ============================================================================

/**
 * Maximum delta time in milliseconds.
 * Caps frame delta to prevent huge resource jumps when tab regains focus.
 * Set to 1000ms (1 second) per FRD specification.
 */
const MAX_DELTA_MS = 1000;

/**
 * How often to update the HUD rate display (in milliseconds).
 * No need to update every frame - once per second is sufficient.
 */
const HUD_UPDATE_INTERVAL_MS = 1000;

// ============================================================================
// Engine State
// ============================================================================

/** Whether the tick engine is running */
let isRunning = false;

/** Whether the tick engine is paused (still "running" but not processing) */
let isPaused = false;

/** Timestamp of the last frame */
let lastFrameTime = 0;

/** Time since last HUD update */
let timeSinceHudUpdate = 0;

/** Accumulated fractional resources (not yet whole enough to add to store) */
const accumulatedResources = {
  money: new Decimal(0),
  technique: new Decimal(0),
  renown: new Decimal(0),
};

/** requestAnimationFrame ID for cancellation */
let animationFrameId: number | null = null;

/** Current generation rate (cached for display and offline calculations) */
let currentMoneyRate: Decimal = ZERO;

// ============================================================================
// Tick Engine Core
// ============================================================================

/**
 * The main tick function, called every frame.
 *
 * @param currentTime - High resolution timestamp from requestAnimationFrame
 */
function tick(currentTime: number): void {
  if (!isRunning) return;

  // Calculate delta time
  const deltaMs = lastFrameTime === 0 ? 0 : currentTime - lastFrameTime;
  lastFrameTime = currentTime;

  // Skip processing if paused, but keep the loop running
  if (!isPaused && deltaMs > 0) {
    // Cap delta time to prevent huge jumps
    const cappedDeltaMs = Math.min(deltaMs, MAX_DELTA_MS);
    const deltaSeconds = cappedDeltaMs / 1000;

    // Process resource generation
    processGeneration(deltaSeconds);

    // Update HUD periodically
    timeSinceHudUpdate += cappedDeltaMs;
    if (timeSinceHudUpdate >= HUD_UPDATE_INTERVAL_MS) {
      updateHudDisplay();
      timeSinceHudUpdate = 0;
    }
  }

  // Continue the loop
  animationFrameId = requestAnimationFrame(tick);
}

/**
 * Process auto-generation of resources for the given time delta.
 *
 * @param deltaSeconds - Time elapsed in seconds
 */
function processGeneration(deltaSeconds: number): void {
  const store = useGameStore.getState();

  // Calculate current money generation rate
  currentMoneyRate = getMoneyGenerationRate();

  // Calculate money generated this frame
  const moneyGenerated = currentMoneyRate.mul(deltaSeconds);

  // Accumulate fractional resources
  accumulatedResources.money = accumulatedResources.money.add(moneyGenerated);

  // Check if we have whole units to add
  if (accumulatedResources.money.gte(1)) {
    // Get the whole number part
    const wholeAmount = accumulatedResources.money.floor();

    // Add to store
    store.addResource('money', decimalToString(wholeAmount));

    // Track for stats
    store.trackResourceEarned('money', decimalToString(wholeAmount));

    // Keep only the fractional part
    accumulatedResources.money = accumulatedResources.money.sub(wholeAmount);
  }

  // Placeholder for future resources (technique, renown)
  // These will follow the same pattern when implemented
}

/**
 * Update the HUD with the current generation rate.
 */
function updateHudDisplay(): void {
  // Update the HUD with current money rate
  updateAutoRate(decimalToString(currentMoneyRate));
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Start the tick engine.
 * Should be called once during game initialization.
 * Does nothing if already running.
 */
export function startTickEngine(): void {
  if (isRunning) {
    console.warn('Tick engine is already running');
    return;
  }

  isRunning = true;
  isPaused = false;
  lastFrameTime = 0;
  timeSinceHudUpdate = 0;

  // Reset accumulated resources
  accumulatedResources.money = new Decimal(0);
  accumulatedResources.technique = new Decimal(0);
  accumulatedResources.renown = new Decimal(0);

  // Initial HUD update
  currentMoneyRate = getMoneyGenerationRate();
  updateHudDisplay();

  // Start the tick loop
  animationFrameId = requestAnimationFrame(tick);

  console.log('Tick engine started');
}

/**
 * Stop the tick engine completely.
 * Should be called during game shutdown or HMR cleanup.
 */
export function stopTickEngine(): void {
  if (!isRunning) return;

  isRunning = false;
  isPaused = false;

  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  console.log('Tick engine stopped');
}

/**
 * Pause the tick engine.
 * The engine loop continues but resources are not generated.
 * Useful during minigames or menus.
 */
export function pauseTickEngine(): void {
  if (!isRunning || isPaused) return;

  isPaused = true;
  console.log('Tick engine paused');
}

/**
 * Resume the tick engine after being paused.
 */
export function resumeTickEngine(): void {
  if (!isRunning || !isPaused) return;

  isPaused = false;
  // Reset lastFrameTime to prevent large delta on resume
  lastFrameTime = 0;
  console.log('Tick engine resumed');
}

/**
 * Check if the tick engine is running.
 *
 * @returns true if the engine is running (may be paused)
 */
export function isTickEngineRunning(): boolean {
  return isRunning;
}

/**
 * Check if the tick engine is paused.
 *
 * @returns true if the engine is running but paused
 */
export function isTickEnginePaused(): boolean {
  return isRunning && isPaused;
}

/**
 * Get the current money generation rate per second.
 * This is the cached rate from the last tick.
 *
 * @returns Rate as Decimal
 */
export function getCurrentMoneyRate(): Decimal {
  return currentMoneyRate;
}

/**
 * Get the current money generation rate as a string.
 * Convenience function for use with offline progression.
 *
 * @returns Rate as string
 */
export function getCurrentMoneyRateString(): string {
  return decimalToString(currentMoneyRate);
}

/**
 * Force a recalculation of the generation rate.
 * Useful after purchasing upgrades that affect the rate.
 */
export function recalculateRate(): void {
  currentMoneyRate = getMoneyGenerationRate();
  updateHudDisplay();
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
export function getAccumulatedResources(): {
  money: Decimal;
  technique: Decimal;
  renown: Decimal;
} {
  return { ...accumulatedResources };
}
