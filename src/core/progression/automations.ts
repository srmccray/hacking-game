/**
 * Automation System
 *
 * Manages automated processes that run periodically during game ticks.
 * Automations are enabled by hardware upgrades and run at defined intervals.
 *
 * Currently implemented automations:
 * - book-summarizer: Every 60s, if $10 available, deduct $10 and grant +1 TP
 *
 * Usage:
 *   import { processAutomations, AUTOMATION_DEFINITIONS } from './automations';
 *
 *   // In tick engine loop:
 *   processAutomations(store, deltaMs);
 */

import { isGreaterOrEqual } from '../resources/resource-manager';
import type { GameStore } from '../state/game-store';

// ============================================================================
// Types
// ============================================================================

/**
 * Definition for an automation.
 */
export interface AutomationDefinition {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of what this automation does */
  description: string;
  /** Interval between triggers in milliseconds */
  intervalMs: number;
  /** The upgrade ID that enables this automation */
  enabledByUpgrade: string;
  /**
   * Execute the automation logic.
   * @param store - The game store
   * @returns true if the automation successfully triggered
   */
  execute: (store: GameStore) => boolean;
}

// ============================================================================
// Automation Definitions
// ============================================================================

/**
 * Book Summarizer Automation
 * Every 60 seconds of game time, if $10 is available, deduct $10 and grant +1 TP.
 */
const bookSummarizerAutomation: AutomationDefinition = {
  id: 'book-summarizer',
  name: 'Book Summarizer',
  description: 'Converts $10 into +1 TP every 60 seconds.',
  intervalMs: 60 * 1000, // 60 seconds
  enabledByUpgrade: 'book-summarizer',
  execute: (store: GameStore): boolean => {
    const state = store.getState();
    const moneyCost = '10';

    // Check if we have enough money
    if (!isGreaterOrEqual(state.resources.money, moneyCost)) {
      return false;
    }

    // Deduct money and grant TP
    const success = state.subtractResource('money', moneyCost);
    if (success) {
      state.addResource('technique', '1');
      console.log('[Automation] Book Summarizer: Converted $10 to +1 TP');
      return true;
    }

    return false;
  },
};

// ============================================================================
// Automation Registry
// ============================================================================

/**
 * All available automations indexed by ID.
 */
export const AUTOMATION_DEFINITIONS: Record<string, AutomationDefinition> = {
  'book-summarizer': bookSummarizerAutomation,
};

/**
 * Get an automation definition by ID.
 *
 * @param automationId - The automation identifier
 * @returns The automation definition or undefined if not found
 */
export function getAutomationDefinition(automationId: string): AutomationDefinition | undefined {
  return AUTOMATION_DEFINITIONS[automationId];
}

/**
 * Get all automation definitions.
 *
 * @returns Array of all automation definitions
 */
export function getAllAutomations(): AutomationDefinition[] {
  return Object.values(AUTOMATION_DEFINITIONS);
}

// ============================================================================
// Automation Processing
// ============================================================================

/**
 * Check if an automation is enabled (has the required upgrade).
 *
 * @param store - The game store
 * @param automationId - The automation identifier
 * @returns true if the automation is enabled
 */
export function isAutomationEnabled(store: GameStore, automationId: string): boolean {
  const definition = getAutomationDefinition(automationId);
  if (!definition) {return false;}

  // Check if the enabling upgrade has been purchased
  const state = store.getState();
  return state.upgrades.apartment[definition.enabledByUpgrade] === true;
}

/**
 * Initialize an automation in the store if it hasn't been initialized yet.
 * Called when the enabling upgrade is purchased.
 *
 * @param store - The game store
 * @param automationId - The automation identifier
 */
export function initializeAutomation(store: GameStore, automationId: string): void {
  const state = store.getState();
  if (!state.automations[automationId]) {
    state.enableAutomation(automationId);
  }
}

/**
 * Process all enabled automations for a tick.
 * This should be called from the tick engine.
 *
 * @param store - The game store
 * @param currentTime - Current timestamp in milliseconds
 */
export function processAutomations(store: GameStore, currentTime: number): void {
  const state = store.getState();

  for (const definition of getAllAutomations()) {
    // Skip if the automation is not enabled (upgrade not purchased)
    if (!isAutomationEnabled(store, definition.id)) {
      continue;
    }

    // Get or initialize automation state
    let automationState = state.automations[definition.id];
    if (!automationState) {
      // Initialize the automation state
      state.enableAutomation(definition.id);
      automationState = state.getAutomationState(definition.id);
      if (!automationState) {continue;}
    }

    // Check if automation is disabled by user
    if (!automationState.enabled) {
      continue;
    }

    // Check if enough time has passed since last trigger
    const timeSinceLastTrigger = currentTime - automationState.lastTriggered;
    if (timeSinceLastTrigger >= definition.intervalMs) {
      // Execute the automation
      const success = definition.execute(store);

      // Update last triggered time regardless of success
      // This prevents rapid-fire attempts when player lacks resources
      state.updateAutomationTrigger(definition.id, currentTime);

      if (success) {
        // Track stats or emit events if needed
      }
    }
  }
}

/**
 * Calculate how many automation triggers should have happened during offline time.
 * Used for offline progress calculation.
 *
 * @param store - The game store
 * @param offlineMs - Time offline in milliseconds
 * @param efficiency - Offline efficiency multiplier (0-1)
 * @returns Map of automation ID to number of triggers
 */
export function calculateOfflineAutomations(
  store: GameStore,
  offlineMs: number,
  efficiency: number
): Map<string, number> {
  const triggers = new Map<string, number>();
  const effectiveTime = offlineMs * efficiency;

  for (const definition of getAllAutomations()) {
    if (!isAutomationEnabled(store, definition.id)) {
      continue;
    }

    const state = store.getState();
    const automationState = state.automations[definition.id];
    if (!automationState?.enabled) {
      continue;
    }

    // Calculate number of potential triggers
    const numTriggers = Math.floor(effectiveTime / definition.intervalMs);
    if (numTriggers > 0) {
      triggers.set(definition.id, numTriggers);
    }
  }

  return triggers;
}

/**
 * Apply offline automation triggers.
 * Attempts to execute each automation the calculated number of times.
 *
 * @param store - The game store
 * @param triggers - Map of automation ID to number of triggers
 * @returns Map of automation ID to successful triggers
 */
export function applyOfflineAutomations(
  store: GameStore,
  triggers: Map<string, number>
): Map<string, number> {
  const successfulTriggers = new Map<string, number>();

  for (const [automationId, count] of triggers) {
    const definition = getAutomationDefinition(automationId);
    if (!definition) {continue;}

    let successful = 0;
    for (let i = 0; i < count; i++) {
      if (definition.execute(store)) {
        successful++;
      } else {
        // Stop trying if we failed (likely ran out of resources)
        break;
      }
    }

    if (successful > 0) {
      successfulTriggers.set(automationId, successful);
      console.log(`[Automation] Offline: ${definition.name} triggered ${successful}/${count} times`);
    }
  }

  // Update trigger times to now
  const state = store.getState();
  const now = Date.now();
  for (const automationId of triggers.keys()) {
    state.updateAutomationTrigger(automationId, now);
  }

  return successfulTriggers;
}
