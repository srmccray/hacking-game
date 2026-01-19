/**
 * Upgrade Panel UI for the Hacker Incremental Game
 *
 * This module creates and manages the upgrade purchasing interface.
 * It displays available upgrades organized by category with costs,
 * effects, and purchase buttons.
 *
 * The panel subscribes to Zustand store changes and updates automatically.
 *
 * Layout:
 * +------------------------------------------+
 * | UPGRADES                                 |
 * |------------------------------------------|
 * | [Equipment]                              |
 * |   Auto-Typer     Lv.3   $150   [BUY]    |
 * |   Better Keyboard Lv.1  $287   [BUY]    |
 * |------------------------------------------|
 * | [Apartment]                              |
 * |   Coffee Machine  --    $500   [BUY]    |
 * |------------------------------------------|
 * | [Minigame]                               |
 * |   Skill Tutorial  Lv.2  $198   [BUY]    |
 * +------------------------------------------+
 *
 * Usage:
 *   import { createUpgradePanel, destroyUpgradePanel, showUpgradePanel, hideUpgradePanel } from '@ui/upgrade-panel';
 *
 *   const panel = createUpgradePanel();
 *   getRootContainer().addChild(panel);
 */

import { Container, Text, Graphics } from 'pixi.js';
import { useGameStore } from '../core/game-state';
import {
  getAllUpgrades,
  getUpgradesByCategory,
  getUpgradeDisplayInfo,
  purchaseUpgrade,
  type UpgradeCategory,
  type Upgrade,
} from '../core/upgrades';
import { recalculateRate } from '../core/tick-engine';
import {
  createTerminalText,
  headerStyle,
  primaryStyle,
  dimStyle,
  brightStyle,
  smallStyle,
  labelStyle,
} from './styles';
import {
  CANVAS_WIDTH,
  TERMINAL_GREEN,
  TERMINAL_DIM,
} from './renderer';

// ============================================================================
// Panel Configuration
// ============================================================================

/** Panel dimensions */
const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 450;

/** Panel position (right side of screen) */
const PANEL_X = CANVAS_WIDTH - PANEL_WIDTH - 16;
const PANEL_Y = 16;

/** Internal padding */
const PADDING = 12;

/** Spacing between upgrade rows */
const ROW_SPACING = 36;

/** Category header height */
const CATEGORY_HEADER_HEIGHT = 28;

/** Spacing between categories */
const CATEGORY_SPACING = 16;

// ============================================================================
// Panel State
// ============================================================================

let panelContainer: Container | null = null;
let unsubscribe: (() => void) | null = null;
let upgradeRows: Map<string, UpgradeRowElements> = new Map();
let isVisible = true;

/**
 * Elements for a single upgrade row
 */
interface UpgradeRowElements {
  container: Container;
  levelText: Text;
  costText: Text;
  effectText: Text;
  buyButton: Container;
  buyButtonBg: Graphics;
  buyButtonText: Text;
}

// ============================================================================
// Upgrade Row Component
// ============================================================================

/**
 * Create a single upgrade row with name, level, cost, and buy button.
 *
 * @param upgrade - The upgrade definition
 * @param y - Y position within parent container
 * @returns Object with container and text references
 */
function createUpgradeRow(upgrade: Upgrade, y: number): UpgradeRowElements {
  const info = getUpgradeDisplayInfo(upgrade.id);
  if (!info) {
    throw new Error(`Upgrade not found: ${upgrade.id}`);
  }

  const container = new Container();
  container.label = `upgrade-row-${upgrade.id}`;
  container.y = y;

  // Name
  const nameText = createTerminalText(upgrade.name, primaryStyle);
  nameText.x = 0;
  nameText.y = 0;
  container.addChild(nameText);

  // Level (below name)
  const levelLabel = info.maxLevel === 1
    ? (info.level > 0 ? 'Owned' : '--')
    : `Lv.${info.level}`;
  const levelText = createTerminalText(levelLabel, smallStyle);
  levelText.x = 0;
  levelText.y = 18;
  container.addChild(levelText);

  // Effect (to the right of level)
  const effectText = createTerminalText(info.effect, smallStyle);
  effectText.x = 60;
  effectText.y = 18;
  container.addChild(effectText);

  // Cost (positioned before buy button)
  const costLabel = info.isMaxed ? 'MAX' : `$${info.cost}`;
  const costStyle = info.canAfford && !info.isMaxed ? brightStyle : dimStyle;
  const costText = createTerminalText(costLabel, costStyle);
  costText.x = PANEL_WIDTH - PADDING * 2 - 120;
  costText.y = 4;
  container.addChild(costText);

  // Buy button
  const buyButton = createBuyButton(upgrade.id, info.canAfford, info.isMaxed);
  buyButton.x = PANEL_WIDTH - PADDING * 2 - 50;
  buyButton.y = 0;
  container.addChild(buyButton);

  // Extract button elements for updating
  const buyButtonBg = buyButton.getChildByLabel('button-bg') as Graphics;
  const buyButtonText = buyButton.getChildByLabel('button-text') as Text;

  return {
    container,
    levelText,
    costText,
    effectText,
    buyButton,
    buyButtonBg,
    buyButtonText,
  };
}

/**
 * Create a buy button for an upgrade.
 *
 * @param upgradeId - The upgrade identifier
 * @param canAfford - Whether the player can afford this upgrade
 * @param isMaxed - Whether the upgrade is at max level
 * @returns The button container
 */
function createBuyButton(
  upgradeId: string,
  canAfford: boolean,
  isMaxed: boolean
): Container {
  const button = new Container();
  button.label = 'buy-button';

  const width = 44;
  const height = 24;

  // Background
  const bg = new Graphics();
  bg.label = 'button-bg';

  if (isMaxed) {
    // Maxed state - dimmed
    bg.fill({ color: 0x222222, alpha: 0.8 });
    bg.roundRect(0, 0, width, height, 3);
    bg.fill();
    bg.stroke({ color: TERMINAL_DIM, width: 1 });
    bg.roundRect(0, 0, width, height, 3);
    bg.stroke();
  } else if (canAfford) {
    // Affordable - highlighted
    bg.fill({ color: 0x003300, alpha: 0.9 });
    bg.roundRect(0, 0, width, height, 3);
    bg.fill();
    bg.stroke({ color: TERMINAL_GREEN, width: 1 });
    bg.roundRect(0, 0, width, height, 3);
    bg.stroke();
  } else {
    // Not affordable - dimmed
    bg.fill({ color: 0x1a1a1a, alpha: 0.8 });
    bg.roundRect(0, 0, width, height, 3);
    bg.fill();
    bg.stroke({ color: TERMINAL_DIM, width: 1 });
    bg.roundRect(0, 0, width, height, 3);
    bg.stroke();
  }
  button.addChild(bg);

  // Text
  const textLabel = isMaxed ? 'MAX' : 'BUY';
  const textStyle = isMaxed ? dimStyle : canAfford ? brightStyle : dimStyle;
  const text = createTerminalText(textLabel, textStyle);
  text.label = 'button-text';
  text.x = width / 2;
  text.y = height / 2;
  text.anchor.set(0.5);
  button.addChild(text);

  // Make interactive if not maxed
  if (!isMaxed) {
    button.eventMode = 'static';
    button.cursor = canAfford ? 'pointer' : 'not-allowed';

    button.on('pointerdown', () => {
      if (canAfford) {
        const success = purchaseUpgrade(upgradeId);
        if (success) {
          // Recalculate auto-generation rate after upgrade purchase
          recalculateRate();

          // Visual feedback - flash
          bg.tint = 0x00ff00;
          setTimeout(() => {
            bg.tint = 0xffffff;
          }, 100);
        }
      }
    });

    // Hover effects
    button.on('pointerover', () => {
      if (canAfford) {
        bg.tint = 0x44ff44;
      }
    });

    button.on('pointerout', () => {
      bg.tint = 0xffffff;
    });
  }

  return button;
}

/**
 * Update a buy button's appearance based on affordability.
 */
function updateBuyButton(
  _upgradeId: string,
  elements: UpgradeRowElements,
  canAfford: boolean,
  isMaxed: boolean
): void {
  const { buyButton, buyButtonBg, buyButtonText } = elements;

  const width = 44;
  const height = 24;

  // Clear and redraw background
  buyButtonBg.clear();

  if (isMaxed) {
    buyButtonBg.fill({ color: 0x222222, alpha: 0.8 });
    buyButtonBg.roundRect(0, 0, width, height, 3);
    buyButtonBg.fill();
    buyButtonBg.stroke({ color: TERMINAL_DIM, width: 1 });
    buyButtonBg.roundRect(0, 0, width, height, 3);
    buyButtonBg.stroke();
    buyButtonText.text = 'MAX';
    buyButtonText.style = dimStyle;
    buyButton.eventMode = 'none';
    buyButton.cursor = 'default';
  } else if (canAfford) {
    buyButtonBg.fill({ color: 0x003300, alpha: 0.9 });
    buyButtonBg.roundRect(0, 0, width, height, 3);
    buyButtonBg.fill();
    buyButtonBg.stroke({ color: TERMINAL_GREEN, width: 1 });
    buyButtonBg.roundRect(0, 0, width, height, 3);
    buyButtonBg.stroke();
    buyButtonText.text = 'BUY';
    buyButtonText.style = brightStyle;
    buyButton.eventMode = 'static';
    buyButton.cursor = 'pointer';
  } else {
    buyButtonBg.fill({ color: 0x1a1a1a, alpha: 0.8 });
    buyButtonBg.roundRect(0, 0, width, height, 3);
    buyButtonBg.fill();
    buyButtonBg.stroke({ color: TERMINAL_DIM, width: 1 });
    buyButtonBg.roundRect(0, 0, width, height, 3);
    buyButtonBg.stroke();
    buyButtonText.text = 'BUY';
    buyButtonText.style = dimStyle;
    buyButton.eventMode = 'static';
    buyButton.cursor = 'not-allowed';
  }
}

// ============================================================================
// Category Section Component
// ============================================================================

/**
 * Create a category section header.
 *
 * @param category - The category name
 * @param y - Y position
 * @returns The header text element
 */
function createCategoryHeader(category: string, y: number): Text {
  const header = createTerminalText(`[ ${category.toUpperCase()} ]`, labelStyle);
  header.x = 0;
  header.y = y;
  return header;
}

// ============================================================================
// Panel Creation
// ============================================================================

/**
 * Create the upgrade panel container.
 *
 * The panel automatically subscribes to game state changes
 * and updates the display when resources or upgrades change.
 *
 * @returns The panel Container to add to the stage
 */
export function createUpgradePanel(): Container {
  // Clean up existing panel if any
  if (panelContainer) {
    destroyUpgradePanel();
  }

  panelContainer = new Container();
  panelContainer.label = 'upgrade-panel';
  panelContainer.x = PANEL_X;
  panelContainer.y = PANEL_Y;

  // Create background
  const background = createPanelBackground();
  panelContainer.addChild(background);

  // Header
  const header = createTerminalText('UPGRADES', headerStyle);
  header.x = PADDING;
  header.y = PADDING;
  panelContainer.addChild(header);

  // Divider line
  const divider = new Graphics();
  divider.stroke({ color: TERMINAL_DIM, width: 1 });
  divider.moveTo(PADDING, 42);
  divider.lineTo(PANEL_WIDTH - PADDING, 42);
  divider.stroke();
  panelContainer.addChild(divider);

  // Content container
  const content = new Container();
  content.label = 'upgrade-content';
  content.x = PADDING;
  content.y = 52;
  panelContainer.addChild(content);

  // Build upgrade rows by category
  let currentY = 0;
  const categories: UpgradeCategory[] = ['equipment', 'apartment', 'minigame'];

  for (const category of categories) {
    const upgrades = getUpgradesByCategory(category);
    if (upgrades.length === 0) continue;

    // Category header
    const categoryHeader = createCategoryHeader(category, currentY);
    content.addChild(categoryHeader);
    currentY += CATEGORY_HEADER_HEIGHT;

    // Upgrade rows
    for (const upgrade of upgrades) {
      const row = createUpgradeRow(upgrade, currentY);
      content.addChild(row.container);
      upgradeRows.set(upgrade.id, row);
      currentY += ROW_SPACING;
    }

    currentY += CATEGORY_SPACING;
  }

  // Subscribe to state changes
  subscribeToState();

  return panelContainer;
}

/**
 * Create the panel background with border.
 */
function createPanelBackground(): Graphics {
  const graphics = new Graphics();

  // Semi-transparent background
  graphics.fill({ color: 0x0a0a0a, alpha: 0.9 });
  graphics.roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 4);
  graphics.fill();

  // Border
  graphics.stroke({ color: TERMINAL_DIM, width: 1, alpha: 0.8 });
  graphics.roundRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 4);
  graphics.stroke();

  // Corner accents
  const accentSize = 10;
  graphics.stroke({ color: TERMINAL_GREEN, width: 2 });

  // Top-left corner
  graphics.moveTo(0, accentSize);
  graphics.lineTo(0, 0);
  graphics.lineTo(accentSize, 0);
  graphics.stroke();

  // Top-right corner
  graphics.moveTo(PANEL_WIDTH - accentSize, 0);
  graphics.lineTo(PANEL_WIDTH, 0);
  graphics.lineTo(PANEL_WIDTH, accentSize);
  graphics.stroke();

  // Bottom-left corner
  graphics.moveTo(0, PANEL_HEIGHT - accentSize);
  graphics.lineTo(0, PANEL_HEIGHT);
  graphics.lineTo(accentSize, PANEL_HEIGHT);
  graphics.stroke();

  // Bottom-right corner
  graphics.moveTo(PANEL_WIDTH - accentSize, PANEL_HEIGHT);
  graphics.lineTo(PANEL_WIDTH, PANEL_HEIGHT);
  graphics.lineTo(PANEL_WIDTH, PANEL_HEIGHT - accentSize);
  graphics.stroke();

  return graphics;
}

// ============================================================================
// State Subscription
// ============================================================================

/**
 * Subscribe to game state changes and update panel accordingly.
 */
function subscribeToState(): void {
  if (unsubscribe) {
    unsubscribe();
  }

  // Subscribe to both resources and upgrades changes
  unsubscribe = useGameStore.subscribe(
    (state) => ({
      resources: state.resources,
      upgrades: state.upgrades,
      minigames: state.minigames,
    }),
    () => {
      refreshUpgradePanel();
    }
  );
}

// ============================================================================
// Panel Updates
// ============================================================================

/**
 * Refresh all upgrade displays with current state.
 */
export function refreshUpgradePanel(): void {
  const upgrades = getAllUpgrades();

  for (const upgrade of upgrades) {
    const elements = upgradeRows.get(upgrade.id);
    if (!elements) continue;

    const info = getUpgradeDisplayInfo(upgrade.id);
    if (!info) continue;

    // Update level text
    const levelLabel = info.maxLevel === 1
      ? (info.level > 0 ? 'Owned' : '--')
      : `Lv.${info.level}`;
    elements.levelText.text = levelLabel;

    // Update effect text
    elements.effectText.text = info.effect;

    // Update cost text
    const costLabel = info.isMaxed ? 'MAX' : `$${info.cost}`;
    elements.costText.text = costLabel;
    elements.costText.style = info.canAfford && !info.isMaxed ? brightStyle : dimStyle;

    // Update buy button
    updateBuyButton(upgrade.id, elements, info.canAfford, info.isMaxed);
  }
}

// ============================================================================
// Visibility Control
// ============================================================================

/**
 * Show the upgrade panel.
 */
export function showUpgradePanel(): void {
  if (panelContainer) {
    panelContainer.visible = true;
    isVisible = true;
  }
}

/**
 * Hide the upgrade panel.
 */
export function hideUpgradePanel(): void {
  if (panelContainer) {
    panelContainer.visible = false;
    isVisible = false;
  }
}

/**
 * Toggle upgrade panel visibility.
 */
export function toggleUpgradePanel(): void {
  if (isVisible) {
    hideUpgradePanel();
  } else {
    showUpgradePanel();
  }
}

/**
 * Check if upgrade panel is visible.
 */
export function isUpgradePanelVisible(): boolean {
  return isVisible;
}

/**
 * Get the upgrade panel container.
 *
 * @returns The panel Container or null if not created
 */
export function getUpgradePanelContainer(): Container | null {
  return panelContainer;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Destroy the upgrade panel and clean up subscriptions.
 */
export function destroyUpgradePanel(): void {
  // Unsubscribe from state
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  // Clear row references
  upgradeRows.clear();

  // Destroy container
  if (panelContainer) {
    panelContainer.destroy({ children: true });
    panelContainer = null;
  }

  isVisible = true;

  console.log('Upgrade panel destroyed');
}
