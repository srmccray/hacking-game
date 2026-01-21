/**
 * Resource Display HUD for the Hacker Incremental Game
 *
 * This module creates and manages the heads-up display showing
 * current resource values and auto-generation rates.
 *
 * The HUD subscribes to Zustand store changes and updates automatically.
 *
 * Layout (top-right, horizontal):
 * +-------------------------------------------------------------------+
 * | $ MONEY: 1,234,567 (+123.45/sec) | TECHNIQUE: 0 TP | RENOWN: 0 RP |
 * +-------------------------------------------------------------------+
 *
 * Usage:
 *   import { createHUD, updateHUD, destroyHUD } from '@ui/hud';
 *
 *   const hud = createHUD();
 *   getRootContainer().addChild(hud);
 */

import { Container, Text, Graphics, TextStyle } from 'pixi.js';
import { useGameStore, type GameState } from '../core/game-state';
import { formatResource, formatRate, createDecimal } from '../core/resource-manager';
import type { ResourceType } from '../core/types';
import { MONOSPACE_FONT } from './styles';
import { CANVAS_WIDTH, TERMINAL_GREEN, TERMINAL_DIM, TERMINAL_BRIGHT, colorToHex } from './renderer';

// ============================================================================
// HUD Configuration
// ============================================================================

/** Padding from canvas edge (right side, indented like room title) */
const HUD_PADDING_RIGHT = 30;

/** Vertical offset from top (above room border at y=80) */
const HUD_PADDING_TOP = 38;

/** Horizontal spacing between resource displays */
const RESOURCE_SPACING_H = 14;

/** Spacing between label and value (horizontal) */
const LABEL_VALUE_SPACING_H = 6;

/** Background dimensions for horizontal layout */
const HUD_WIDTH = 480;
const HUD_HEIGHT = 36;

// ============================================================================
// HUD-Specific Styles (smaller than global styles)
// ============================================================================

/** HUD label style - small dim text */
const hudLabelStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: 11,
  fill: colorToHex(TERMINAL_DIM),
});

/** HUD value style - small bright text */
const hudValueStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: 13,
  fill: colorToHex(TERMINAL_BRIGHT),
  fontWeight: 'bold',
});

/** HUD rate style - tiny dim text */
const hudRateStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: 10,
  fill: colorToHex(TERMINAL_DIM),
});

/** HUD dimmed style - for placeholder resources */
const hudDimStyle = new TextStyle({
  fontFamily: MONOSPACE_FONT,
  fontSize: 11,
  fill: colorToHex(TERMINAL_DIM),
});

// ============================================================================
// Text Elements Interface
// ============================================================================

interface HUDTextElements {
  moneyValue: Text | null;
  moneyRate: Text | null;
  techniqueValue: Text | null;
  renownValue: Text | null;
}

// ============================================================================
// HUD Manager Class
// ============================================================================

/**
 * Encapsulates all HUD state and logic.
 * Using a class prevents module-level mutable state issues.
 */
class HUDManager {
  /** The HUD container */
  private _container: Container | null = null;

  /** State subscription cleanup function */
  private _unsubscribe: (() => void) | null = null;

  /** Text elements for dynamic updates */
  private readonly _textElements: HUDTextElements = {
    moneyValue: null,
    moneyRate: null,
    techniqueValue: null,
    renownValue: null,
  };

  /** Current auto-generation rate */
  private _currentAutoRate: string = '0';

  // ==========================================================================
  // Resource Display Component
  // ==========================================================================

  /**
   * Create a resource display group (label and value inline, optional rate).
   * Horizontal layout: "$ MONEY: 1,234,567 (+123.45/sec)"
   */
  private createResourceDisplay(
    label: string,
    resourceType: ResourceType,
    initialValue: string,
    showRate: boolean = false,
    isDimmed: boolean = false
  ): {
    container: Container;
    valueText: Text;
    rateText: Text | null;
    width: number;
  } {
    const container = new Container();
    container.label = `resource-${resourceType}`;

    let currentX = 0;

    // Label
    const useLabelStyle = isDimmed ? hudDimStyle : hudLabelStyle;
    const labelText = new Text({ text: label + ':', style: useLabelStyle });
    labelText.x = currentX;
    labelText.y = 0;
    container.addChild(labelText);
    currentX += labelText.width + LABEL_VALUE_SPACING_H;

    // Value
    const useValueStyle = isDimmed ? hudDimStyle : hudValueStyle;
    const valueText = new Text({
      text: formatResource(resourceType, initialValue),
      style: useValueStyle,
    });
    valueText.x = currentX;
    valueText.y = 0;
    container.addChild(valueText);
    currentX += valueText.width;

    // Rate (only for money for MVP)
    let rateText: Text | null = null;
    if (showRate) {
      currentX += LABEL_VALUE_SPACING_H;
      rateText = new Text({ text: '(+' + formatRate('0') + ')', style: hudRateStyle });
      rateText.x = currentX;
      rateText.y = 0;
      container.addChild(rateText);
      currentX += rateText.width;
    }

    return { container, valueText, rateText, width: currentX };
  }

  /**
   * Create the decorative HUD background.
   */
  private createHUDBackground(): Graphics {
    const graphics = new Graphics();

    // Semi-transparent background
    graphics.fill({ color: 0x0a0a0a, alpha: 0.8 });
    graphics.roundRect(0, 0, HUD_WIDTH, HUD_HEIGHT, 4);
    graphics.fill();

    // Border
    graphics.stroke({ color: TERMINAL_DIM, width: 1, alpha: 0.6 });
    graphics.roundRect(0, 0, HUD_WIDTH, HUD_HEIGHT, 4);
    graphics.stroke();

    // Corner accents
    const accentSize = 6;
    graphics.stroke({ color: TERMINAL_GREEN, width: 2 });

    // Top-left corner
    graphics.moveTo(0, accentSize);
    graphics.lineTo(0, 0);
    graphics.lineTo(accentSize, 0);
    graphics.stroke();

    // Top-right corner
    graphics.moveTo(HUD_WIDTH - accentSize, 0);
    graphics.lineTo(HUD_WIDTH, 0);
    graphics.lineTo(HUD_WIDTH, accentSize);
    graphics.stroke();

    // Bottom-left corner
    graphics.moveTo(0, HUD_HEIGHT - accentSize);
    graphics.lineTo(0, HUD_HEIGHT);
    graphics.lineTo(accentSize, HUD_HEIGHT);
    graphics.stroke();

    // Bottom-right corner
    graphics.moveTo(HUD_WIDTH - accentSize, HUD_HEIGHT);
    graphics.lineTo(HUD_WIDTH, HUD_HEIGHT);
    graphics.lineTo(HUD_WIDTH, HUD_HEIGHT - accentSize);
    graphics.stroke();

    return graphics;
  }

  // ==========================================================================
  // State Subscription
  // ==========================================================================

  /**
   * Subscribe to game state changes and update HUD accordingly.
   */
  private subscribeToState(): void {
    // Unsubscribe from previous subscription if any
    if (this._unsubscribe) {
      this._unsubscribe();
    }

    // Subscribe to resource changes using Zustand's subscribeWithSelector
    this._unsubscribe = useGameStore.subscribe(
      (state) => state.resources,
      (resources) => {
        this.updateResourceDisplays(resources);
      }
    );
  }

  /**
   * Update all resource text displays.
   */
  private updateResourceDisplays(resources: GameState['resources']): void {
    if (this._textElements.moneyValue) {
      this._textElements.moneyValue.text = formatResource('money', resources.money);
    }

    if (this._textElements.techniqueValue) {
      this._textElements.techniqueValue.text = formatResource('technique', resources.technique);
    }

    if (this._textElements.renownValue) {
      this._textElements.renownValue.text = formatResource('renown', resources.renown);
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Create the HUD container with all resource displays.
   *
   * The HUD automatically subscribes to game state changes
   * and updates the display when resources change.
   *
   * @returns The HUD Container to add to the stage
   */
  create(): Container {
    // Clean up existing HUD if any
    if (this._container) {
      this.destroy();
    }

    this._container = new Container();
    this._container.label = 'hud';

    // Get initial state
    const state = useGameStore.getState();

    // Create decorative border/background
    const background = this.createHUDBackground();
    this._container.addChild(background);

    const contentY = 10; // Vertical center within HUD
    let currentX = 10;

    // Money display (primary resource)
    const moneyDisplay = this.createResourceDisplay(
      '$ MONEY',
      'money',
      state.resources.money,
      true, // Show rate
      false // Not dimmed
    );
    moneyDisplay.container.x = currentX;
    moneyDisplay.container.y = contentY;
    this._container.addChild(moneyDisplay.container);
    this._textElements.moneyValue = moneyDisplay.valueText;
    this._textElements.moneyRate = moneyDisplay.rateText;

    currentX += moneyDisplay.width + RESOURCE_SPACING_H;

    // Separator
    const sep1 = new Text({ text: '|', style: hudDimStyle });
    sep1.x = currentX;
    sep1.y = contentY;
    this._container.addChild(sep1);
    currentX += sep1.width + RESOURCE_SPACING_H;

    // Technique display (placeholder for MVP)
    const techniqueDisplay = this.createResourceDisplay(
      'TECHNIQUE',
      'technique',
      state.resources.technique,
      false, // No rate
      true // Dimmed (placeholder)
    );
    techniqueDisplay.container.x = currentX;
    techniqueDisplay.container.y = contentY;
    this._container.addChild(techniqueDisplay.container);
    this._textElements.techniqueValue = techniqueDisplay.valueText;

    currentX += techniqueDisplay.width + RESOURCE_SPACING_H;

    // Separator
    const sep2 = new Text({ text: '|', style: hudDimStyle });
    sep2.x = currentX;
    sep2.y = contentY;
    this._container.addChild(sep2);
    currentX += sep2.width + RESOURCE_SPACING_H;

    // Renown display (placeholder for MVP)
    const renownDisplay = this.createResourceDisplay(
      'RENOWN',
      'renown',
      state.resources.renown,
      false, // No rate
      true // Dimmed (placeholder)
    );
    renownDisplay.container.x = currentX;
    renownDisplay.container.y = contentY;
    this._container.addChild(renownDisplay.container);
    this._textElements.renownValue = renownDisplay.valueText;

    // Position HUD at top-right
    this._container.x = CANVAS_WIDTH - HUD_WIDTH - HUD_PADDING_RIGHT;
    this._container.y = HUD_PADDING_TOP;

    // Subscribe to state changes
    this.subscribeToState();

    return this._container;
  }

  /**
   * Update the auto-generation rate display.
   * Called by the tick engine when rate changes.
   *
   * @param ratePerSecond - The current rate as a Decimal string
   */
  updateAutoRate(ratePerSecond: string): void {
    this._currentAutoRate = ratePerSecond;

    if (this._textElements.moneyRate) {
      const rate = createDecimal(ratePerSecond);
      const prefix = rate.gte(0) ? '+' : '';
      this._textElements.moneyRate.text = '(' + prefix + formatRate(ratePerSecond) + ')';
    }
  }

  /**
   * Get the current auto-generation rate.
   *
   * @returns The current rate as a string
   */
  get displayedAutoRate(): string {
    return this._currentAutoRate;
  }

  /**
   * Force a refresh of all HUD displays from current state.
   * Useful after loading a saved game.
   */
  refresh(): void {
    const state = useGameStore.getState();
    this.updateResourceDisplays(state.resources);
  }

  /**
   * Get the HUD container.
   *
   * @returns The HUD Container or null if not created
   */
  get container(): Container | null {
    return this._container;
  }

  /**
   * Destroy the HUD and clean up subscriptions.
   */
  destroy(): void {
    // Unsubscribe from state
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }

    // Clear text references
    this._textElements.moneyValue = null;
    this._textElements.moneyRate = null;
    this._textElements.techniqueValue = null;
    this._textElements.renownValue = null;

    // Destroy container
    if (this._container) {
      this._container.destroy({ children: true });
      this._container = null;
    }

    console.log('HUD destroyed');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * The singleton HUD manager instance.
 * Using a singleton ensures consistent state across the application.
 */
const hudManager = new HUDManager();

// ============================================================================
// Exported Functions (maintain backward compatibility)
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
  return hudManager.create();
}

/**
 * Update the auto-generation rate display.
 * Called by the tick engine when rate changes.
 *
 * @param ratePerSecond - The current rate as a Decimal string
 */
export function updateAutoRate(ratePerSecond: string): void {
  hudManager.updateAutoRate(ratePerSecond);
}

/**
 * Get the current auto-generation rate.
 *
 * @returns The current rate as a string
 */
export function getDisplayedAutoRate(): string {
  return hudManager.displayedAutoRate;
}

/**
 * Force a refresh of all HUD displays from current state.
 * Useful after loading a saved game.
 */
export function refreshHUD(): void {
  hudManager.refresh();
}

/**
 * Get the HUD container.
 *
 * @returns The HUD Container or null if not created
 */
export function getHUDContainer(): Container | null {
  return hudManager.container;
}

/**
 * Destroy the HUD and clean up subscriptions.
 */
export function destroyHUD(): void {
  hudManager.destroy();
}

/**
 * Get the HUD manager instance for testing purposes.
 * Not recommended for production use - use the exported functions instead.
 */
export function getHUDManagerInstance(): HUDManager {
  return hudManager;
}
