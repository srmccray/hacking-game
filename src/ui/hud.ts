/**
 * HUD (Heads-Up Display) Component
 *
 * Displays game resources (money, technique, renown) with auto-generation rates
 * using reactive Zustand subscriptions. Updates automatically when state changes.
 *
 * Key features:
 * - Reactive updates via Zustand subscribeWithSelector (NO manual refresh needed)
 * - Displays all three resources with formatted values
 * - Shows per-second generation rate for money
 * - Terminal-style visual design
 * - Proper subscription cleanup on destroy
 *
 * Layout (horizontal, top-right):
 * +-------------------------------------------------------------------+
 * | $ 1,234,567 (+123.45/sec)  |  TP 0  |  RP 0                       |
 * +-------------------------------------------------------------------+
 *
 * Usage:
 *   import { HUD } from './HUD';
 *
 *   const hud = new HUD(store, renderer.root, config);
 *   hud.show();
 *
 *   // Later, when cleaning up:
 *   hud.destroy();
 */

import { Container, Text, Graphics } from 'pixi.js';
import type { GameStore } from '../core/state/game-store';
import type { GameConfig } from '../game/GameConfig';
import type { ResourceType } from '../core/types';
import {
  selectMoney,
  selectTechnique,
  selectRenown,
} from '../core/state/selectors';
import { formatResource, formatRate, isZero } from '../core/resources/resource-manager';
import { hudStyle, hudLabelStyle, terminalDimStyle } from '../rendering/styles';
import { COLORS } from '../rendering/Renderer';

// ============================================================================
// Configuration
// ============================================================================

/** Padding from canvas edge */
const HUD_PADDING_RIGHT = 30;
const HUD_PADDING_TOP = 20;

/** Horizontal spacing between resource sections */
const SECTION_SPACING = 20;

/** Spacing between label and value */
const LABEL_VALUE_SPACING = 8;

/** HUD background dimensions */
const HUD_WIDTH = 480;
const HUD_HEIGHT = 40;

/** Internal padding within HUD */
const HUD_INTERNAL_PADDING = 12;

// ============================================================================
// Types
// ============================================================================

/**
 * Text element references for dynamic updates.
 */
interface HUDTextElements {
  moneyValue: Text;
  moneyRate: Text;
  techniqueValue: Text;
  renownValue: Text;
}

// ============================================================================
// HUD Class
// ============================================================================

/**
 * HUD component that displays resources with reactive updates.
 *
 * Uses Zustand's subscribeWithSelector for efficient, targeted updates.
 * Only re-renders text elements when their specific values change.
 */
export class HUD {
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

  /** Current displayed auto-generation rate */
  private currentAutoRate: string = '0';

  /**
   * Create a new HUD instance.
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

    // Create main container
    this.container = new Container();
    this.container.label = 'hud';

    // Create visual elements
    this.createBackground();
    this.textElements = this.createTextElements();

    // Position HUD in top-right
    this.container.x = config.canvas.width - HUD_WIDTH - HUD_PADDING_RIGHT;
    this.container.y = HUD_PADDING_TOP;

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
    const graphics = new Graphics();

    // Semi-transparent background
    graphics.roundRect(0, 0, HUD_WIDTH, HUD_HEIGHT, 4);
    graphics.fill({ color: 0x0a0a0a, alpha: 0.85 });

    // Border
    graphics.roundRect(0, 0, HUD_WIDTH, HUD_HEIGHT, 4);
    graphics.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.6 });

    // Corner accents
    const accentSize = 6;

    // Top-left corner
    graphics.moveTo(0, accentSize);
    graphics.lineTo(0, 0);
    graphics.lineTo(accentSize, 0);
    graphics.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });

    // Top-right corner
    graphics.moveTo(HUD_WIDTH - accentSize, 0);
    graphics.lineTo(HUD_WIDTH, 0);
    graphics.lineTo(HUD_WIDTH, accentSize);
    graphics.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });

    // Bottom-left corner
    graphics.moveTo(0, HUD_HEIGHT - accentSize);
    graphics.lineTo(0, HUD_HEIGHT);
    graphics.lineTo(accentSize, HUD_HEIGHT);
    graphics.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });

    // Bottom-right corner
    graphics.moveTo(HUD_WIDTH - accentSize, HUD_HEIGHT);
    graphics.lineTo(HUD_WIDTH, HUD_HEIGHT);
    graphics.lineTo(HUD_WIDTH, HUD_HEIGHT - accentSize);
    graphics.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });

    this.container.addChild(graphics);
  }

  /**
   * Create all text elements for the HUD.
   * Returns references for later updates.
   */
  private createTextElements(): HUDTextElements {
    let currentX = HUD_INTERNAL_PADDING;
    const centerY = HUD_HEIGHT / 2;

    // ========================================================================
    // Money Section (primary resource with rate)
    // ========================================================================

    // Money value
    const moneyValue = new Text({
      text: '$0',
      style: hudStyle,
    });
    moneyValue.anchor.set(0, 0.5);
    moneyValue.x = currentX;
    moneyValue.y = centerY;
    this.container.addChild(moneyValue);
    currentX += moneyValue.width + LABEL_VALUE_SPACING;

    // Money rate
    const moneyRate = new Text({
      text: '',
      style: hudLabelStyle,
    });
    moneyRate.anchor.set(0, 0.5);
    moneyRate.x = currentX;
    moneyRate.y = centerY;
    this.container.addChild(moneyRate);

    // ========================================================================
    // Separator 1
    // ========================================================================

    currentX = 200; // Fixed position for consistent layout
    const separator1 = new Text({
      text: '|',
      style: terminalDimStyle,
    });
    separator1.anchor.set(0.5, 0.5);
    separator1.x = currentX;
    separator1.y = centerY;
    this.container.addChild(separator1);
    currentX += SECTION_SPACING;

    // ========================================================================
    // Technique Section (dimmed for MVP)
    // ========================================================================

    const techniqueLabel = new Text({
      text: 'TP',
      style: hudLabelStyle,
    });
    techniqueLabel.anchor.set(0, 0.5);
    techniqueLabel.x = currentX;
    techniqueLabel.y = centerY;
    this.container.addChild(techniqueLabel);
    currentX += techniqueLabel.width + LABEL_VALUE_SPACING;

    const techniqueValue = new Text({
      text: '0',
      style: terminalDimStyle,
    });
    techniqueValue.anchor.set(0, 0.5);
    techniqueValue.x = currentX;
    techniqueValue.y = centerY;
    this.container.addChild(techniqueValue);

    // ========================================================================
    // Separator 2
    // ========================================================================

    currentX = 320; // Fixed position for consistent layout
    const separator2 = new Text({
      text: '|',
      style: terminalDimStyle,
    });
    separator2.anchor.set(0.5, 0.5);
    separator2.x = currentX;
    separator2.y = centerY;
    this.container.addChild(separator2);
    currentX += SECTION_SPACING;

    // ========================================================================
    // Renown Section (dimmed for MVP)
    // ========================================================================

    const renownLabel = new Text({
      text: 'RP',
      style: hudLabelStyle,
    });
    renownLabel.anchor.set(0, 0.5);
    renownLabel.x = currentX;
    renownLabel.y = centerY;
    this.container.addChild(renownLabel);
    currentX += renownLabel.width + LABEL_VALUE_SPACING;

    const renownValue = new Text({
      text: '0',
      style: terminalDimStyle,
    });
    renownValue.anchor.set(0, 0.5);
    renownValue.x = currentX;
    renownValue.y = centerY;
    this.container.addChild(renownValue);

    return {
      moneyValue,
      moneyRate,
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
   * Update the auto-generation rate display.
   * Called by the tick engine when the rate changes.
   *
   * @param ratePerSecond - The current generation rate as a Decimal string
   */
  updateAutoRate(ratePerSecond: string): void {
    this.currentAutoRate = ratePerSecond;

    // Only show rate if it's greater than zero
    if (isZero(ratePerSecond)) {
      this.textElements.moneyRate.text = '';
    } else {
      this.textElements.moneyRate.text = `(+${formatRate(ratePerSecond)})`;
    }
  }

  /**
   * Get the currently displayed auto-generation rate.
   *
   * @returns The rate as a Decimal string
   */
  getDisplayedAutoRate(): string {
    return this.currentAutoRate;
  }

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
