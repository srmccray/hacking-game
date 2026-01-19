/**
 * Resource Display HUD for the Hacker Incremental Game
 *
 * This module creates and manages the heads-up display showing
 * current resource values and auto-generation rates.
 *
 * The HUD subscribes to Zustand store changes and updates automatically.
 *
 * Layout:
 * +------------------------------------------+
 * | $ MONEY                                  |
 * | 1,234,567                                |
 * | +123.45/sec                              |
 * |                                          |
 * | TECHNIQUE (dimmed - placeholder)         |
 * | 0 TP                                     |
 * |                                          |
 * | RENOWN (dimmed - placeholder)            |
 * | 0 RP                                     |
 * +------------------------------------------+
 *
 * Usage:
 *   import { createHUD, updateHUD, destroyHUD } from '@ui/hud';
 *
 *   const hud = createHUD();
 *   getRootContainer().addChild(hud);
 */

import { Container, Text, Graphics } from 'pixi.js';
import { useGameStore, type GameState } from '../core/game-state';
import { formatResource, formatRate, createDecimal } from '../core/resource-manager';
import type { ResourceType } from '../core/types';
import {
  createTerminalText,
  labelStyle,
  valueStyle,
  rateStyle,
  dimStyle,
} from './styles';
import { TERMINAL_GREEN, TERMINAL_DIM } from './renderer';

// ============================================================================
// HUD Configuration
// ============================================================================

/** Padding from canvas edge */
const HUD_PADDING = 16;

/** Vertical spacing between resource displays */
const RESOURCE_SPACING = 60;

/** Spacing between label and value */
const LABEL_VALUE_SPACING = 20;

/** Spacing between value and rate */
const VALUE_RATE_SPACING = 16;

// ============================================================================
// HUD State
// ============================================================================

let hudContainer: Container | null = null;
let unsubscribe: (() => void) | null = null;

// Text elements for dynamic updates
const textElements: {
  moneyValue: Text | null;
  moneyRate: Text | null;
  techniqueValue: Text | null;
  renownValue: Text | null;
} = {
  moneyValue: null,
  moneyRate: null,
  techniqueValue: null,
  renownValue: null,
};

// Current auto-generation rate (will be updated by tick engine in task-08)
let currentAutoRate: string = '0';

// ============================================================================
// Resource Display Component
// ============================================================================

/**
 * Create a resource display group (label, value, optional rate).
 *
 * @param label - Resource label text
 * @param resourceType - The resource type for formatting
 * @param initialValue - Initial value string
 * @param showRate - Whether to show rate (for money)
 * @param isDimmed - Whether to display in dimmed style (for placeholders)
 * @returns Object with container and text references
 */
function createResourceDisplay(
  label: string,
  resourceType: ResourceType,
  initialValue: string,
  showRate: boolean = false,
  isDimmed: boolean = false
): {
  container: Container;
  valueText: Text;
  rateText: Text | null;
} {
  const container = new Container();
  container.label = `resource-${resourceType}`;

  // Label
  const useLabelStyle = isDimmed ? dimStyle : labelStyle;
  const labelText = createTerminalText(label, useLabelStyle);
  labelText.y = 0;
  container.addChild(labelText);

  // Value
  const useValueStyle = isDimmed ? dimStyle : valueStyle;
  const valueText = createTerminalText(
    formatResource(resourceType, initialValue),
    useValueStyle
  );
  valueText.y = LABEL_VALUE_SPACING;
  container.addChild(valueText);

  // Rate (only for money for MVP)
  let rateText: Text | null = null;
  if (showRate) {
    rateText = createTerminalText('+' + formatRate('0'), rateStyle);
    rateText.y = LABEL_VALUE_SPACING + VALUE_RATE_SPACING;
    container.addChild(rateText);
  }

  return { container, valueText, rateText };
}

// ============================================================================
// HUD Creation
// ============================================================================

/**
 * Create the HUD container with all resource displays.
 *
 * The HUD automatically subscribes to game state changes
 * and updates the display when resources change.
 *
 * @returns The HUD Container to add to the stage
 */
export function createHUD(): Container {
  // Clean up existing HUD if any
  if (hudContainer) {
    destroyHUD();
  }

  hudContainer = new Container();
  hudContainer.label = 'hud';
  hudContainer.x = HUD_PADDING;
  hudContainer.y = HUD_PADDING;

  // Get initial state
  const state = useGameStore.getState();

  // Create decorative border/background
  const background = createHUDBackground();
  hudContainer.addChild(background);

  let currentY = 12;

  // Money display (primary resource)
  const moneyDisplay = createResourceDisplay(
    '$ MONEY',
    'money',
    state.resources.money,
    true, // Show rate
    false // Not dimmed
  );
  moneyDisplay.container.x = 12;
  moneyDisplay.container.y = currentY;
  hudContainer.addChild(moneyDisplay.container);
  textElements.moneyValue = moneyDisplay.valueText;
  textElements.moneyRate = moneyDisplay.rateText;

  currentY += RESOURCE_SPACING + 8;

  // Technique display (placeholder for MVP)
  const techniqueDisplay = createResourceDisplay(
    'TECHNIQUE',
    'technique',
    state.resources.technique,
    false, // No rate
    true // Dimmed (placeholder)
  );
  techniqueDisplay.container.x = 12;
  techniqueDisplay.container.y = currentY;
  hudContainer.addChild(techniqueDisplay.container);
  textElements.techniqueValue = techniqueDisplay.valueText;

  currentY += RESOURCE_SPACING - 12;

  // Renown display (placeholder for MVP)
  const renownDisplay = createResourceDisplay(
    'RENOWN',
    'renown',
    state.resources.renown,
    false, // No rate
    true // Dimmed (placeholder)
  );
  renownDisplay.container.x = 12;
  renownDisplay.container.y = currentY;
  hudContainer.addChild(renownDisplay.container);
  textElements.renownValue = renownDisplay.valueText;

  // Subscribe to state changes
  subscribeToState();

  return hudContainer;
}

/**
 * Create the decorative HUD background.
 */
function createHUDBackground(): Graphics {
  const graphics = new Graphics();

  // Semi-transparent background
  graphics.fill({ color: 0x0a0a0a, alpha: 0.8 });
  graphics.roundRect(0, 0, 180, 170, 4);
  graphics.fill();

  // Border
  graphics.stroke({ color: TERMINAL_DIM, width: 1, alpha: 0.6 });
  graphics.roundRect(0, 0, 180, 170, 4);
  graphics.stroke();

  // Corner accents
  const accentSize = 8;
  graphics.stroke({ color: TERMINAL_GREEN, width: 2 });

  // Top-left corner
  graphics.moveTo(0, accentSize);
  graphics.lineTo(0, 0);
  graphics.lineTo(accentSize, 0);
  graphics.stroke();

  // Top-right corner
  graphics.moveTo(180 - accentSize, 0);
  graphics.lineTo(180, 0);
  graphics.lineTo(180, accentSize);
  graphics.stroke();

  // Bottom-left corner
  graphics.moveTo(0, 170 - accentSize);
  graphics.lineTo(0, 170);
  graphics.lineTo(accentSize, 170);
  graphics.stroke();

  // Bottom-right corner
  graphics.moveTo(180 - accentSize, 170);
  graphics.lineTo(180, 170);
  graphics.lineTo(180, 170 - accentSize);
  graphics.stroke();

  return graphics;
}

// ============================================================================
// State Subscription
// ============================================================================

/**
 * Subscribe to game state changes and update HUD accordingly.
 */
function subscribeToState(): void {
  // Unsubscribe from previous subscription if any
  if (unsubscribe) {
    unsubscribe();
  }

  // Subscribe to resource changes using Zustand's subscribeWithSelector
  unsubscribe = useGameStore.subscribe(
    (state) => state.resources,
    (resources) => {
      updateResourceDisplays(resources);
    }
  );
}

/**
 * Update all resource text displays.
 *
 * @param resources - Current resources from state
 */
function updateResourceDisplays(resources: GameState['resources']): void {
  if (textElements.moneyValue) {
    textElements.moneyValue.text = formatResource('money', resources.money);
  }

  if (textElements.techniqueValue) {
    textElements.techniqueValue.text = formatResource('technique', resources.technique);
  }

  if (textElements.renownValue) {
    textElements.renownValue.text = formatResource('renown', resources.renown);
  }
}

// ============================================================================
// HUD Updates
// ============================================================================

/**
 * Update the auto-generation rate display.
 * Called by the tick engine when rate changes.
 *
 * @param ratePerSecond - The current rate as a Decimal string
 */
export function updateAutoRate(ratePerSecond: string): void {
  currentAutoRate = ratePerSecond;

  if (textElements.moneyRate) {
    const rate = createDecimal(ratePerSecond);
    const prefix = rate.gte(0) ? '+' : '';
    textElements.moneyRate.text = prefix + formatRate(ratePerSecond);
  }
}

/**
 * Get the current auto-generation rate.
 *
 * @returns The current rate as a string
 */
export function getDisplayedAutoRate(): string {
  return currentAutoRate;
}

/**
 * Force a refresh of all HUD displays from current state.
 * Useful after loading a saved game.
 */
export function refreshHUD(): void {
  const state = useGameStore.getState();
  updateResourceDisplays(state.resources);
}

/**
 * Get the HUD container.
 *
 * @returns The HUD Container or null if not created
 */
export function getHUDContainer(): Container | null {
  return hudContainer;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Destroy the HUD and clean up subscriptions.
 */
export function destroyHUD(): void {
  // Unsubscribe from state
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  // Clear text references
  textElements.moneyValue = null;
  textElements.moneyRate = null;
  textElements.techniqueValue = null;
  textElements.renownValue = null;

  // Destroy container
  if (hudContainer) {
    hudContainer.destroy({ children: true });
    hudContainer = null;
  }

  console.log('HUD destroyed');
}
