/**
 * Upgrade Panel UI Component
 *
 * A modal overlay panel that displays available upgrades grouped by category.
 * The player can purchase upgrades using resources earned from minigames.
 *
 * Layout:
 * ```
 * +--------------------------------------------------+
 * |  UPGRADES                              [U] Close |
 * +--------------------------------------------------+
 * |  EQUIPMENT                                       |
 * |  +--------------------------------------------+  |
 * |  | Auto-Typer (Lv 3)          $1,150  [BUY]   |  |
 * |  | +5% per level | Current: 115% generation   |  |
 * |  +--------------------------------------------+  |
 * |  | Better Keyboard (Lv 1)     $287    [BUY]   |  |
 * |  | +0.1x combo | Current: +0.1x bonus         |  |
 * |  +--------------------------------------------+  |
 * |                                                  |
 * |  APARTMENT                                       |
 * |  +--------------------------------------------+  |
 * |  | Coffee Machine              $500   [BUY]   |  |
 * |  | +10s minigame time | LOCKED                |  |
 * |  +--------------------------------------------+  |
 * +--------------------------------------------------+
 * ```
 *
 * Usage:
 *   import { UpgradePanel } from './UpgradePanel';
 *
 *   const upgradePanel = new UpgradePanel(game);
 *   stage.addChild(upgradePanel.container);
 *   upgradePanel.show();
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Game } from '../game/Game';
import type { InputContext } from '../input/InputManager';
import { INPUT_PRIORITY } from '../input/InputManager';
import { COLORS } from '../rendering/Renderer';
import {
  FONT_FAMILY,
  terminalDimStyle,
  terminalBrightStyle,
  titleStyle,
  terminalSmallStyle,
} from '../rendering/styles';
import {
  getCategoryDisplayInfo,
  purchaseUpgrade,
  type UpgradeCategory,
  type UpgradeDisplayInfo,
} from '../upgrades';
import { GameEvents } from '../events/game-events';

// ============================================================================
// Configuration
// ============================================================================

const LAYOUT = {
  /** Panel width */
  PANEL_WIDTH: 600,
  /** Panel height */
  PANEL_HEIGHT: 440,
  /** Padding inside panel */
  PADDING: 20,
  /** Height of each upgrade row */
  ROW_HEIGHT: 70,
  /** Gap between rows */
  ROW_GAP: 8,
  /** Width of buy button */
  BUTTON_WIDTH: 80,
  /** Height of buy button */
  BUTTON_HEIGHT: 28,
  /** Header height */
  HEADER_HEIGHT: 50,
  /** Category label height */
  CATEGORY_HEIGHT: 30,
  /** Maximum width for upgrade name text */
  NAME_MAX_WIDTH: 180,
  /** Gap between name and level text */
  NAME_LEVEL_GAP: 15,
};

// ============================================================================
// Types
// ============================================================================

interface UpgradeRow {
  container: Container;
  upgrade: UpgradeDisplayInfo;
  nameText: Text;
  levelText: Text;
  costText: Text;
  effectText: Text;
  button: Graphics;
  buttonText: Text;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate a Text object's content to fit within a maximum width.
 * Adds ellipsis ("...") if truncation is necessary.
 *
 * @param textObject - The PixiJS Text object to truncate
 * @param maxWidth - Maximum allowed width in pixels
 * @param originalText - The original full text string
 */
function truncateTextWithEllipsis(
  textObject: Text,
  maxWidth: number,
  originalText: string
): void {
  // First, try the full text
  textObject.text = originalText;

  if (textObject.width <= maxWidth) {
    return; // No truncation needed
  }

  // Binary search for the right length
  let low = 0;
  let high = originalText.length;
  const ellipsis = '...';

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const truncated = originalText.slice(0, mid) + ellipsis;
    textObject.text = truncated;

    if (textObject.width <= maxWidth) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  // Set final truncated text
  if (low < originalText.length) {
    textObject.text = originalText.slice(0, low) + ellipsis;
  } else {
    textObject.text = originalText;
  }
}

// ============================================================================
// Upgrade Panel
// ============================================================================

/**
 * Upgrade panel modal component.
 */
export class UpgradePanel {
  /** Root container for the panel */
  readonly container: Container;

  /** Whether the panel is currently visible */
  private visible = false;

  /** Reference to the game instance */
  private readonly game: Game;

  /** Input context for keyboard handling */
  private inputContext: InputContext | null = null;

  /** Upgrade rows keyed by upgrade ID */
  private readonly upgradeRows: Map<string, UpgradeRow> = new Map();

  /** Current selected row index */
  private selectedIndex = 0;

  /** List of upgrade IDs in display order */
  private upgradeOrder: string[] = [];

  /** Store subscription unsubscriber */
  private unsubscribeStore: (() => void) | null = null;

  /**
   * Create a new upgrade panel.
   *
   * @param game - The game instance
   */
  constructor(game: Game) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'upgrade-panel';
    this.container.visible = false;

    this.createPanel();
  }

  // ==========================================================================
  // Panel Creation
  // ==========================================================================

  /**
   * Create the panel UI elements.
   */
  private createPanel(): void {
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;

    // Dark overlay
    const overlay = new Graphics();
    overlay.fill({ color: 0x000000, alpha: 0.8 });
    overlay.rect(0, 0, width, height);
    overlay.fill();
    overlay.eventMode = 'static';
    this.container.addChild(overlay);

    // Panel background
    const panelX = (width - LAYOUT.PANEL_WIDTH) / 2;
    const panelY = (height - LAYOUT.PANEL_HEIGHT) / 2;

    const panel = new Graphics();
    panel.fill({ color: COLORS.BACKGROUND });
    panel.roundRect(panelX, panelY, LAYOUT.PANEL_WIDTH, LAYOUT.PANEL_HEIGHT, 8);
    panel.fill();
    panel.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });
    panel.roundRect(panelX, panelY, LAYOUT.PANEL_WIDTH, LAYOUT.PANEL_HEIGHT, 8);
    panel.stroke();
    this.container.addChild(panel);

    // Header
    const header = new Text({
      text: 'UPGRADES',
      style: titleStyle,
    });
    header.anchor.set(0, 0);
    header.x = panelX + LAYOUT.PADDING;
    header.y = panelY + 15;
    this.container.addChild(header);

    // Close hint
    const closeHint = new Text({
      text: '[U] or [ESC] Close',
      style: terminalDimStyle,
    });
    closeHint.anchor.set(1, 0);
    closeHint.x = panelX + LAYOUT.PANEL_WIDTH - LAYOUT.PADDING;
    closeHint.y = panelY + 20;
    this.container.addChild(closeHint);

    // Header divider
    const divider = new Graphics();
    divider.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    divider.moveTo(panelX + LAYOUT.PADDING, panelY + LAYOUT.HEADER_HEIGHT);
    divider.lineTo(panelX + LAYOUT.PANEL_WIDTH - LAYOUT.PADDING, panelY + LAYOUT.HEADER_HEIGHT);
    divider.stroke();
    this.container.addChild(divider);

    // Create scrollable content area
    const contentContainer = new Container();
    contentContainer.label = 'content';
    contentContainer.x = panelX + LAYOUT.PADDING;
    contentContainer.y = panelY + LAYOUT.HEADER_HEIGHT + 10;
    this.container.addChild(contentContainer);

    // Create upgrade rows
    this.createUpgradeRows(contentContainer);

    // Instructions
    const instructions = new Text({
      text: '[W/S] or [UP/DOWN] Navigate | [ENTER] Purchase',
      style: terminalSmallStyle,
    });
    instructions.anchor.set(0.5, 0);
    instructions.x = panelX + LAYOUT.PANEL_WIDTH / 2;
    instructions.y = panelY + LAYOUT.PANEL_HEIGHT - 30;
    this.container.addChild(instructions);
  }

  /**
   * Create upgrade rows for all categories.
   */
  private createUpgradeRows(contentContainer: Container): void {
    let yOffset = 0;
    this.upgradeOrder = [];

    const categories: UpgradeCategory[] = ['equipment', 'apartment'];

    for (const category of categories) {
      // Category label
      const categoryLabel = new Text({
        text: category.toUpperCase(),
        style: new TextStyle({
          fontFamily: FONT_FAMILY,
          fontSize: 14,
          fill: COLORS.TERMINAL_GREEN,
          fontWeight: 'bold',
        }),
      });
      categoryLabel.y = yOffset;
      contentContainer.addChild(categoryLabel);
      yOffset += LAYOUT.CATEGORY_HEIGHT;

      // Get upgrades for this category
      const upgrades = getCategoryDisplayInfo(this.game.store, category);

      for (const upgrade of upgrades) {
        const row = this.createUpgradeRow(upgrade, yOffset);
        contentContainer.addChild(row.container);
        this.upgradeRows.set(upgrade.id, row);
        this.upgradeOrder.push(upgrade.id);
        yOffset += LAYOUT.ROW_HEIGHT + LAYOUT.ROW_GAP;
      }

      yOffset += 10; // Gap between categories
    }
  }

  /**
   * Create a single upgrade row.
   */
  private createUpgradeRow(upgrade: UpgradeDisplayInfo, y: number): UpgradeRow {
    const rowContainer = new Container();
    rowContainer.label = `upgrade-row-${upgrade.id}`;
    rowContainer.y = y;

    const rowWidth = LAYOUT.PANEL_WIDTH - LAYOUT.PADDING * 2;

    // Row background
    const bg = new Graphics();
    bg.fill({ color: COLORS.TERMINAL_DIM, alpha: 0.1 });
    bg.roundRect(0, 0, rowWidth, LAYOUT.ROW_HEIGHT, 4);
    bg.fill();
    bg.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.3 });
    bg.roundRect(0, 0, rowWidth, LAYOUT.ROW_HEIGHT, 4);
    bg.stroke();
    rowContainer.addChild(bg);

    // Upgrade name (with truncation to prevent overflow)
    const nameText = new Text({
      text: upgrade.name,
      style: terminalBrightStyle,
    });
    truncateTextWithEllipsis(nameText, LAYOUT.NAME_MAX_WIDTH, upgrade.name);
    nameText.x = 10;
    nameText.y = 10;
    rowContainer.addChild(nameText);

    // Level indicator
    const levelString = upgrade.maxLevel === 0
      ? `Lv ${upgrade.level}`
      : (upgrade.level > 0 ? 'OWNED' : 'LOCKED');

    const levelText = new Text({
      text: levelString,
      style: terminalDimStyle,
    });
    levelText.x = nameText.x + nameText.width + LAYOUT.NAME_LEVEL_GAP;
    levelText.y = 12;
    rowContainer.addChild(levelText);

    // Cost
    const costString = upgrade.isMaxed ? 'MAX' : `$${upgrade.costFormatted}`;
    const costText = new Text({
      text: costString,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 16,
        fill: upgrade.canAfford ? COLORS.TERMINAL_BRIGHT : COLORS.TERMINAL_RED,
      }),
    });
    costText.anchor.set(1, 0);
    costText.x = rowWidth - LAYOUT.BUTTON_WIDTH - 20;
    costText.y = 10;
    rowContainer.addChild(costText);

    // Description and current effect
    const effectStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: 12,
      fill: COLORS.TERMINAL_DIM,
      wordWrap: true,
      wordWrapWidth: rowWidth - LAYOUT.BUTTON_WIDTH - 40,
    });
    const effectText = new Text({
      text: `${upgrade.description} | Current: ${upgrade.effect}`,
      style: effectStyle,
    });
    effectText.x = 10;
    effectText.y = 35;
    rowContainer.addChild(effectText);

    // Buy button
    const buttonX = rowWidth - LAYOUT.BUTTON_WIDTH - 10;
    const buttonY = (LAYOUT.ROW_HEIGHT - LAYOUT.BUTTON_HEIGHT) / 2;

    const button = new Graphics();
    this.drawButton(button, buttonX, buttonY, upgrade.canAfford && !upgrade.isMaxed);
    rowContainer.addChild(button);

    const buttonLabel = upgrade.isMaxed ? 'MAX' : 'BUY';
    const buttonText = new Text({
      text: buttonLabel,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        fontWeight: 'bold',
        fill: upgrade.canAfford && !upgrade.isMaxed ? COLORS.TERMINAL_BRIGHT : COLORS.TERMINAL_DIM,
      }),
    });
    buttonText.anchor.set(0.5);
    buttonText.x = buttonX + LAYOUT.BUTTON_WIDTH / 2;
    buttonText.y = buttonY + LAYOUT.BUTTON_HEIGHT / 2;
    rowContainer.addChild(buttonText);

    return {
      container: rowContainer,
      upgrade,
      nameText,
      levelText,
      costText,
      effectText,
      button,
      buttonText,
    };
  }

  /**
   * Draw a button graphic.
   */
  private drawButton(
    graphics: Graphics,
    x: number,
    y: number,
    enabled: boolean
  ): void {
    graphics.clear();

    const color = enabled ? COLORS.TERMINAL_GREEN : COLORS.TERMINAL_DIM;

    graphics.stroke({ color, width: enabled ? 2 : 1, alpha: enabled ? 1 : 0.5 });
    graphics.roundRect(x, y, LAYOUT.BUTTON_WIDTH, LAYOUT.BUTTON_HEIGHT, 4);
    graphics.stroke();

    if (enabled) {
      graphics.fill({ color, alpha: 0.1 });
      graphics.roundRect(x, y, LAYOUT.BUTTON_WIDTH, LAYOUT.BUTTON_HEIGHT, 4);
      graphics.fill();
    }
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Show the upgrade panel.
   */
  show(): void {
    if (this.visible) {return;}

    this.visible = true;
    this.container.visible = true;

    // Refresh upgrade data
    this.refreshUpgrades();

    // Subscribe to store changes
    this.unsubscribeStore = this.game.store.subscribe(
      (state) => state.resources.money,
      () => this.refreshUpgrades()
    );

    // Register input context
    this.registerInputContext();

    // Select first item
    this.selectedIndex = 0;
    this.updateSelection();

    this.game.eventBus.emit(GameEvents.UPGRADE_PANEL_TOGGLED, { visible: true });
    console.log('[UpgradePanel] Shown');
  }

  /**
   * Hide the upgrade panel.
   */
  hide(): void {
    if (!this.visible) {return;}

    this.visible = false;
    this.container.visible = false;

    // Unsubscribe from store
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }

    // Disable input context
    if (this.inputContext) {
      this.game.inputManager.disableContext(this.inputContext.id);
    }

    this.game.eventBus.emit(GameEvents.UPGRADE_PANEL_TOGGLED, { visible: false });
    console.log('[UpgradePanel] Hidden');
  }

  /**
   * Toggle panel visibility.
   */
  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Check if panel is visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  // ==========================================================================
  // Refresh Display
  // ==========================================================================

  /**
   * Refresh all upgrade displays with current data.
   */
  refreshUpgrades(): void {
    for (const [upgradeId, row] of this.upgradeRows) {
      const newInfo = getCategoryDisplayInfo(this.game.store, row.upgrade.category)
        .find(u => u.id === upgradeId);

      if (newInfo) {
        row.upgrade = newInfo;
        this.updateRowDisplay(row);
      }
    }
  }

  /**
   * Update a single row's display.
   */
  private updateRowDisplay(row: UpgradeRow): void {
    const upgrade = row.upgrade;

    // Update level text
    const levelString = upgrade.maxLevel === 0
      ? `Lv ${upgrade.level}`
      : (upgrade.level > 0 ? 'OWNED' : 'LOCKED');
    row.levelText.text = levelString;

    // Update cost
    const costString = upgrade.isMaxed ? 'MAX' : `$${upgrade.costFormatted}`;
    row.costText.text = costString;
    row.costText.style.fill = upgrade.canAfford ? COLORS.TERMINAL_BRIGHT : COLORS.TERMINAL_RED;

    // Update effect text
    row.effectText.text = `${upgrade.description} | Current: ${upgrade.effect}`;

    // Update button
    const buttonX = (LAYOUT.PANEL_WIDTH - LAYOUT.PADDING * 2) - LAYOUT.BUTTON_WIDTH - 10;
    const buttonY = (LAYOUT.ROW_HEIGHT - LAYOUT.BUTTON_HEIGHT) / 2;
    this.drawButton(row.button, buttonX, buttonY, upgrade.canAfford && !upgrade.isMaxed);

    // Update button text
    row.buttonText.text = upgrade.isMaxed ? 'MAX' : 'BUY';
    row.buttonText.style.fill = upgrade.canAfford && !upgrade.isMaxed
      ? COLORS.TERMINAL_BRIGHT
      : COLORS.TERMINAL_DIM;
  }

  // ==========================================================================
  // Selection
  // ==========================================================================

  /**
   * Update selection highlight.
   */
  private updateSelection(): void {
    for (let i = 0; i < this.upgradeOrder.length; i++) {
      const upgradeId = this.upgradeOrder[i];
      const row = this.upgradeRows.get(upgradeId ?? '');
      if (row && upgradeId) {
        const bg = row.container.getChildAt(0) as Graphics;
        if (bg) {
          bg.clear();
          if (i === this.selectedIndex) {
            // Selected row
            bg.fill({ color: COLORS.TERMINAL_GREEN, alpha: 0.2 });
            bg.roundRect(0, 0, LAYOUT.PANEL_WIDTH - LAYOUT.PADDING * 2, LAYOUT.ROW_HEIGHT, 4);
            bg.fill();
            bg.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });
            bg.roundRect(0, 0, LAYOUT.PANEL_WIDTH - LAYOUT.PADDING * 2, LAYOUT.ROW_HEIGHT, 4);
            bg.stroke();
          } else {
            // Unselected row
            bg.fill({ color: COLORS.TERMINAL_DIM, alpha: 0.1 });
            bg.roundRect(0, 0, LAYOUT.PANEL_WIDTH - LAYOUT.PADDING * 2, LAYOUT.ROW_HEIGHT, 4);
            bg.fill();
            bg.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.3 });
            bg.roundRect(0, 0, LAYOUT.PANEL_WIDTH - LAYOUT.PADDING * 2, LAYOUT.ROW_HEIGHT, 4);
            bg.stroke();
          }
        }
      }
    }
  }

  /**
   * Move selection up.
   */
  private selectPrevious(): void {
    this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    this.updateSelection();
  }

  /**
   * Move selection down.
   */
  private selectNext(): void {
    this.selectedIndex = Math.min(this.upgradeOrder.length - 1, this.selectedIndex + 1);
    this.updateSelection();
  }

  /**
   * Purchase the selected upgrade.
   */
  private purchaseSelected(): void {
    const upgradeId = this.upgradeOrder[this.selectedIndex];
    if (!upgradeId) {return;}

    const row = this.upgradeRows.get(upgradeId);
    if (!row) {return;}

    if (row.upgrade.canAfford && !row.upgrade.isMaxed) {
      const costString = row.upgrade.costFormatted;
      const success = purchaseUpgrade(this.game.store, upgradeId);
      if (success) {
        // Emit purchase event
        this.game.eventBus.emit(GameEvents.UPGRADE_PURCHASED, {
          category: row.upgrade.category,
          upgradeId,
          newLevel: row.upgrade.level + 1,
          cost: costString,
          resource: 'money', // All upgrades currently cost money
        });

        // Refresh display
        this.refreshUpgrades();
      }
    }
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Register the input context for this panel.
   */
  private registerInputContext(): void {
    const bindings = new Map<string, { onPress?: () => void; onRelease?: () => void }>();

    // Navigation
    bindings.set('KeyW', { onPress: () => this.selectPrevious() });
    bindings.set('ArrowUp', { onPress: () => this.selectPrevious() });
    bindings.set('KeyS', { onPress: () => this.selectNext() });
    bindings.set('ArrowDown', { onPress: () => this.selectNext() });

    // Purchase
    bindings.set('Enter', { onPress: () => this.purchaseSelected() });

    // Close
    bindings.set('KeyU', { onPress: () => this.hide() });
    bindings.set('Escape', { onPress: () => this.hide() });

    this.inputContext = {
      id: 'upgrade-panel',
      priority: INPUT_PRIORITY.MENU,
      enabled: true,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('upgrade-panel');
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Destroy the upgrade panel.
   */
  destroy(): void {
    this.hide();

    if (this.inputContext) {
      this.game.inputManager.unregisterContext(this.inputContext.id);
    }

    this.upgradeRows.clear();
    this.upgradeOrder = [];
    this.container.destroy({ children: true });
  }
}
