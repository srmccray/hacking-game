/**
 * Apartment HUD (Resource Display)
 *
 * Displays game resources (money, technique, renown) in a horizontal bar
 * positioned in the top margin above the room ceiling.
 *
 * Layout (horizontal, top center):
 * +------------------------------------------------------------------------+
 * |   $ 1,234,567    |    TP 0    |    RP 0                                |
 * +------------------------------------------------------------------------+
 *
 * Visual design:
 * - Terminal/hacker aesthetic with color-coded resources
 * - Green for money, Cyan for technique, Yellow for renown
 * - Reactive updates via Zustand subscriptions
 *
 * Usage:
 *   import { ApartmentHUD } from './ApartmentHUD';
 *
 *   const hud = new ApartmentHUD(store, container, config);
 *   // ... later during cleanup:
 *   hud.destroy();
 */

import { Container, Text, Graphics, TextStyle } from 'pixi.js';
import type { GameStore } from '../../core/state/game-store';
import type { GameConfig } from '../../game/GameConfig';
import type { ResourceType } from '../../core/types';
import {
  selectMoney,
  selectTechnique,
  selectRenown,
} from '../../core/state/selectors';
import { formatResource } from '../../core/resources/resource-manager';
import { FONT_FAMILY, FONT_SIZES } from '../../rendering/styles';
import { COLORS } from '../../rendering/Renderer';

// ============================================================================
// Configuration
// ============================================================================

/** HUD positioning */
const HUD_Y = 20; // At top of screen, title will be below
const HUD_PADDING_X = 60; // Match room left/right bounds

/** HUD dimensions */
const HUD_HEIGHT = 32;

/** Internal padding within HUD */
const HUD_INTERNAL_PADDING = 16;

/** Separator character */
const SEPARATOR = '|';

// ============================================================================
// Resource Colors
// ============================================================================

const RESOURCE_COLORS = {
  money: COLORS.TERMINAL_GREEN,
  technique: COLORS.TERMINAL_CYAN,
  renown: COLORS.TERMINAL_YELLOW,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * Text element references for dynamic updates.
 */
interface HUDTextElements {
  moneyValue: Text;
  techniqueValue: Text;
  renownValue: Text;
}

// ============================================================================
// ApartmentHUD Class
// ============================================================================

/**
 * Apartment scene HUD that displays resources with reactive updates.
 *
 * Uses Zustand's subscribeWithSelector for efficient, targeted updates.
 * Only re-renders text elements when their specific values change.
 */
export class ApartmentHUD {
  /** The main container for all HUD elements */
  private readonly container: Container;

  /** Reference to the parent container for cleanup */
  private readonly parentContainer: Container;

  /** Text elements for dynamic updates */
  private readonly textElements: HUDTextElements;

  /** Subscription cleanup functions */
  private readonly unsubscribers: (() => void)[] = [];

  /** Reference to the game store */
  private readonly store: GameStore;

  /** Canvas width for positioning */
  private readonly canvasWidth: number;

  /**
   * Create a new ApartmentHUD instance.
   *
   * @param store - The Zustand game store for state subscriptions
   * @param parentContainer - The parent container to add the HUD to
   * @param config - Game configuration for sizing and positioning
   */
  constructor(
    store: GameStore,
    parentContainer: Container,
    config: GameConfig
  ) {
    this.store = store;
    this.parentContainer = parentContainer;
    this.canvasWidth = config.canvas.width;

    // Create main container
    this.container = new Container();
    this.container.label = 'apartment-hud';

    // Create visual elements
    this.createBackground();
    this.textElements = this.createTextElements();

    // Position HUD centered in top margin
    this.container.x = HUD_PADDING_X;
    this.container.y = HUD_Y - HUD_HEIGHT / 2;

    // Set up reactive subscriptions
    this.setupSubscriptions();

    // Perform initial render from current state
    this.renderFromState();

    // Add to parent
    parentContainer.addChild(this.container);
  }

  // ==========================================================================
  // Visual Creation
  // ==========================================================================

  /**
   * Create the decorative HUD background.
   */
  private createBackground(): void {
    const width = this.canvasWidth - HUD_PADDING_X * 2;
    const graphics = new Graphics();

    // Semi-transparent background
    graphics.roundRect(0, 0, width, HUD_HEIGHT, 3);
    graphics.fill({ color: 0x0a0a0a, alpha: 0.8 });

    // Border with terminal green
    graphics.roundRect(0, 0, width, HUD_HEIGHT, 3);
    graphics.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.5 });

    // Corner accents (top-left and top-right)
    const accentSize = 5;

    // Top-left corner
    graphics.moveTo(0, accentSize);
    graphics.lineTo(0, 0);
    graphics.lineTo(accentSize, 0);
    graphics.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });

    // Top-right corner
    graphics.moveTo(width - accentSize, 0);
    graphics.lineTo(width, 0);
    graphics.lineTo(width, accentSize);
    graphics.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });

    // Bottom-left corner
    graphics.moveTo(0, HUD_HEIGHT - accentSize);
    graphics.lineTo(0, HUD_HEIGHT);
    graphics.lineTo(accentSize, HUD_HEIGHT);
    graphics.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });

    // Bottom-right corner
    graphics.moveTo(width - accentSize, HUD_HEIGHT);
    graphics.lineTo(width, HUD_HEIGHT);
    graphics.lineTo(width, HUD_HEIGHT - accentSize);
    graphics.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });

    this.container.addChild(graphics);
  }

  /**
   * Create all text elements for the HUD.
   * Returns references for later updates.
   */
  private createTextElements(): HUDTextElements {
    const hudWidth = this.canvasWidth - HUD_PADDING_X * 2;
    const centerY = HUD_HEIGHT / 2;

    // Divide the HUD into 3 equal sections for the resources
    const sectionWidth = (hudWidth - HUD_INTERNAL_PADDING * 2) / 3;

    // Create styles for each resource type
    const moneyStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZES.NORMAL,
      fill: RESOURCE_COLORS.money,
      dropShadow: {
        alpha: 0.5,
        blur: 2,
        color: RESOURCE_COLORS.money,
        distance: 0,
      },
    });

    const techniqueStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZES.NORMAL,
      fill: RESOURCE_COLORS.technique,
      dropShadow: {
        alpha: 0.5,
        blur: 2,
        color: RESOURCE_COLORS.technique,
        distance: 0,
      },
    });

    const renownStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZES.NORMAL,
      fill: RESOURCE_COLORS.renown,
      dropShadow: {
        alpha: 0.5,
        blur: 2,
        color: RESOURCE_COLORS.renown,
        distance: 0,
      },
    });

    const separatorStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZES.NORMAL,
      fill: COLORS.TERMINAL_DIM,
    });

    // ========================================================================
    // Money Section (left) - left-anchored to prevent flickering
    // ========================================================================

    const moneyX = HUD_INTERNAL_PADDING + 10; // Small offset from left edge
    const moneyValue = new Text({
      text: '$0',
      style: moneyStyle,
    });
    moneyValue.anchor.set(0, 0.5); // Left-anchor to prevent shifting when value changes
    moneyValue.x = moneyX;
    moneyValue.y = centerY;
    this.container.addChild(moneyValue);

    // ========================================================================
    // Separator 1
    // ========================================================================

    const separator1X = HUD_INTERNAL_PADDING + sectionWidth;
    const separator1 = new Text({
      text: SEPARATOR,
      style: separatorStyle,
    });
    separator1.anchor.set(0.5, 0.5);
    separator1.x = separator1X;
    separator1.y = centerY;
    this.container.addChild(separator1);

    // ========================================================================
    // Technique Section (center) - left-anchored to prevent flickering
    // ========================================================================

    const techniqueX = HUD_INTERNAL_PADDING + sectionWidth + 15; // After separator with padding
    const techniqueValue = new Text({
      text: '0 TP',
      style: techniqueStyle,
    });
    techniqueValue.anchor.set(0, 0.5); // Left-anchor to prevent shifting
    techniqueValue.x = techniqueX;
    techniqueValue.y = centerY;
    this.container.addChild(techniqueValue);

    // ========================================================================
    // Separator 2
    // ========================================================================

    const separator2X = HUD_INTERNAL_PADDING + sectionWidth * 2;
    const separator2 = new Text({
      text: SEPARATOR,
      style: separatorStyle,
    });
    separator2.anchor.set(0.5, 0.5);
    separator2.x = separator2X;
    separator2.y = centerY;
    this.container.addChild(separator2);

    // ========================================================================
    // Renown Section (right) - left-anchored to prevent flickering
    // ========================================================================

    const renownX = HUD_INTERNAL_PADDING + sectionWidth * 2 + 15; // After separator with padding
    const renownValue = new Text({
      text: '0 RP',
      style: renownStyle,
    });
    renownValue.anchor.set(0, 0.5); // Left-anchor to prevent shifting
    renownValue.x = renownX;
    renownValue.y = centerY;
    this.container.addChild(renownValue);

    return {
      moneyValue,
      techniqueValue,
      renownValue,
    };
  }

  // ==========================================================================
  // Reactive Subscriptions
  // ==========================================================================

  /**
   * Set up Zustand subscriptions for reactive updates.
   * Each resource gets its own subscription for fine-grained reactivity.
   */
  private setupSubscriptions(): void {
    // Subscribe to money changes
    const unsubMoney = this.store.subscribe(
      selectMoney,
      (money) => {
        this.updateResourceDisplay('money', money);
      }
    );
    this.unsubscribers.push(unsubMoney);

    // Subscribe to technique changes
    const unsubTechnique = this.store.subscribe(
      selectTechnique,
      (technique) => {
        this.updateResourceDisplay('technique', technique);
      }
    );
    this.unsubscribers.push(unsubTechnique);

    // Subscribe to renown changes
    const unsubRenown = this.store.subscribe(
      selectRenown,
      (renown) => {
        this.updateResourceDisplay('renown', renown);
      }
    );
    this.unsubscribers.push(unsubRenown);
  }

  /**
   * Update a specific resource display.
   */
  private updateResourceDisplay(resource: ResourceType, value: string): void {
    switch (resource) {
      case 'money':
        this.textElements.moneyValue.text = formatResource('money', value);
        break;
      case 'technique':
        this.textElements.techniqueValue.text = formatResource('technique', value);
        break;
      case 'renown':
        this.textElements.renownValue.text = formatResource('renown', value);
        break;
    }
  }

  /**
   * Render all values from current state.
   * Called once on initialization.
   */
  private renderFromState(): void {
    const state = this.store.getState();
    this.updateResourceDisplay('money', state.resources.money);
    this.updateResourceDisplay('technique', state.resources.technique);
    this.updateResourceDisplay('renown', state.resources.renown);
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Show the HUD.
   */
  show(): void {
    this.container.visible = true;
  }

  /**
   * Hide the HUD.
   */
  hide(): void {
    this.container.visible = false;
  }

  /**
   * Check if the HUD is currently visible.
   */
  isVisible(): boolean {
    return this.container.visible;
  }

  /**
   * Get the HUD container.
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Force a refresh of all displays from current state.
   * Useful after loading a saved game.
   */
  refresh(): void {
    this.renderFromState();
  }

  /**
   * Destroy the HUD and clean up all resources.
   * Unsubscribes from all state changes and removes display objects.
   */
  destroy(): void {
    // Unsubscribe from all state changes
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe();
    }
    this.unsubscribers.length = 0;

    // Remove from parent container
    if (this.container.parent === this.parentContainer) {
      this.parentContainer.removeChild(this.container);
    }

    // Destroy container and all children
    this.container.destroy({ children: true });
  }
}
