/**
 * Workbench Upgrades Scene
 *
 * Displays purchasable hardware upgrades from the workbench station.
 * Hardware upgrades require BOTH Money AND Technique Points (TP) as currencies.
 *
 * Visual Layout:
 * +------------------------------------------+
 * |           HARDWARE UPGRADES              |
 * +------------------------------------------+
 * |   Money: $1.23K           TP: 10         |
 * +------------------------------------------+
 * |                                          |
 * |   > Book Summarizer    $100 + 10 TP      |
 * |     ...                                  |
 * |                                          |
 * +------------------------------------------+
 * |  [Up/Down] Select  [Enter] Purchase      |
 * |  [Esc] Back                              |
 * +------------------------------------------+
 *
 * Usage:
 *   sceneManager.register('workbench-upgrades', () => createWorkbenchUpgradesScene(game));
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene, GameInstance } from '../../core/types';
import type { Game } from '../../game/Game';
import type { InputContext } from '../../input/InputManager';
import { INPUT_PRIORITY } from '../../input/InputManager';
import { COLORS } from '../../rendering/Renderer';
import {
  FONT_FAMILY,
  FONT_SIZES,
  terminalDimStyle,
  terminalBrightStyle,
  titleStyle,
} from '../../rendering/styles';
import { formatResource } from '../../core/resources/resource-manager';
import {
  getUpgradeDisplayInfo,
  purchaseUpgrade,
  getUpgradesByCategory,
  getUpgrade,
  type UpgradeDisplayInfo,
  type HardwareUpgrade,
} from '../../upgrades/upgrade-definitions';

// ============================================================================
// Configuration
// ============================================================================

/** Layout constants */
const LAYOUT = {
  /** Padding from edges */
  PADDING: 60,
  /** Title Y position */
  TITLE_Y: 80,
  /** Resource display Y position */
  RESOURCE_Y: 140,
  /** Upgrade list start Y position */
  UPGRADE_LIST_Y: 200,
  /** Height of each upgrade row */
  UPGRADE_ROW_HEIGHT: 40,
  /** Instructions Y offset from bottom */
  INSTRUCTIONS_BOTTOM_OFFSET: 60,
} as const;

/**
 * Get hardware upgrade IDs dynamically from the upgrade system.
 */
function getHardwareUpgradeIds(): string[] {
  const hardwareUpgrades = getUpgradesByCategory('hardware');
  return hardwareUpgrades.map(u => u.id);
}

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Workbench Upgrades Scene implementation.
 */
class WorkbenchUpgradesScene implements Scene {
  readonly id = 'workbench-upgrades';

  /** The PixiJS container for this scene */
  private readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** Input context for this scene */
  private inputContext: InputContext | null = null;

  /** Money balance text element */
  private moneyText: Text | null = null;

  /** TP balance text element */
  private tpText: Text | null = null;

  /** Upgrade row containers for visual updates */
  private upgradeRows: Container[] = [];

  /** Currently selected upgrade index */
  private selectedIndex = 0;

  /** Store unsubscribe function */
  private unsubscribe: (() => void) | null = null;

  /** Hardware upgrade IDs */
  private readonly hardwareUpgradeIds: string[];

  constructor(game: Game) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'workbench-upgrades-scene';
    this.hardwareUpgradeIds = getHardwareUpgradeIds();
  }

  // ==========================================================================
  // Scene Lifecycle
  // ==========================================================================

  getContainer(): Container {
    return this.container;
  }

  onEnter(): void {
    console.log('[WorkbenchUpgradesScene] Entering scene');

    // Create background
    this.createBackground();

    // Create header
    this.createHeader();

    // Create resource display
    this.createResourceDisplay();

    // Create upgrade list
    this.createUpgradeList();

    // Create instructions
    this.createInstructions();

    // Register input context
    this.registerInputContext();

    // Subscribe to store updates
    this.subscribeToStore();
  }

  onExit(): void {
    console.log('[WorkbenchUpgradesScene] Exiting scene');

    // Unsubscribe from store
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Disable input context
    if (this.inputContext) {
      this.game.inputManager.disableContext(this.inputContext.id);
    }
  }

  onUpdate(_deltaMs: number): void {
    // No continuous updates needed
  }

  onDestroy(): void {
    console.log('[WorkbenchUpgradesScene] Destroying scene');

    // Unsubscribe from store
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Unregister input context
    if (this.inputContext) {
      this.game.inputManager.unregisterContext(this.inputContext.id);
    }

    // Clear references
    this.moneyText = null;
    this.tpText = null;
    this.upgradeRows = [];

    // Destroy container and children
    this.container.destroy({ children: true });
  }

  // ==========================================================================
  // UI Creation
  // ==========================================================================

  /**
   * Create the background.
   */
  private createBackground(): void {
    const { width, height } = this.game.config.canvas;

    const bg = new Graphics();
    bg.fill({ color: COLORS.BACKGROUND });
    bg.rect(0, 0, width, height);
    bg.fill();

    // Border
    bg.stroke({ color: COLORS.TERMINAL_GREEN, width: 2, alpha: 0.5 });
    bg.rect(LAYOUT.PADDING - 20, LAYOUT.TITLE_Y - 30, width - (LAYOUT.PADDING - 20) * 2, height - LAYOUT.TITLE_Y);
    bg.stroke();

    this.container.addChild(bg);
  }

  /**
   * Create the header with title.
   */
  private createHeader(): void {
    const { width } = this.game.config.canvas;

    // Main title
    const title = new Text({
      text: 'HARDWARE UPGRADES',
      style: titleStyle,
    });
    title.anchor.set(0.5, 0);
    title.x = width / 2;
    title.y = LAYOUT.TITLE_Y;
    this.container.addChild(title);
  }

  /**
   * Create the resource display showing Money AND TP (both needed for hardware).
   */
  private createResourceDisplay(): void {
    const { width } = this.game.config.canvas;
    const state = this.game.store.getState();

    // Divider line above resources
    const dividerTop = new Graphics();
    dividerTop.stroke({ color: COLORS.TERMINAL_GREEN, width: 1, alpha: 0.5 });
    dividerTop.moveTo(LAYOUT.PADDING, LAYOUT.RESOURCE_Y - 10);
    dividerTop.lineTo(width - LAYOUT.PADDING, LAYOUT.RESOURCE_Y - 10);
    dividerTop.stroke();
    this.container.addChild(dividerTop);

    // Money display (left side)
    this.moneyText = new Text({
      text: formatResource('money', state.resources.money),
      style: terminalBrightStyle,
    });
    this.moneyText.anchor.set(0, 0);
    this.moneyText.x = LAYOUT.PADDING + 20;
    this.moneyText.y = LAYOUT.RESOURCE_Y;
    this.container.addChild(this.moneyText);

    // TP display (right side) - used bright style since it's a primary currency for hardware
    this.tpText = new Text({
      text: formatResource('technique', state.resources.technique),
      style: terminalBrightStyle,
    });
    this.tpText.anchor.set(1, 0);
    this.tpText.x = width - LAYOUT.PADDING - 20;
    this.tpText.y = LAYOUT.RESOURCE_Y;
    this.container.addChild(this.tpText);

    // Divider line below resources
    const dividerBottom = new Graphics();
    dividerBottom.stroke({ color: COLORS.TERMINAL_GREEN, width: 1, alpha: 0.5 });
    dividerBottom.moveTo(LAYOUT.PADDING, LAYOUT.RESOURCE_Y + 40);
    dividerBottom.lineTo(width - LAYOUT.PADDING, LAYOUT.RESOURCE_Y + 40);
    dividerBottom.stroke();
    this.container.addChild(dividerBottom);
  }

  /**
   * Create the upgrade list.
   */
  private createUpgradeList(): void {
    this.upgradeRows = [];

    if (this.hardwareUpgradeIds.length === 0) {
      // Show empty state message
      const emptyText = new Text({
        text: 'No hardware upgrades available yet.',
        style: terminalDimStyle,
      });
      emptyText.anchor.set(0.5, 0);
      emptyText.x = this.game.config.canvas.width / 2;
      emptyText.y = LAYOUT.UPGRADE_LIST_Y + 40;
      this.container.addChild(emptyText);
      return;
    }

    for (let i = 0; i < this.hardwareUpgradeIds.length; i++) {
      const upgradeId = this.hardwareUpgradeIds[i];
      if (!upgradeId) {
        continue;
      }

      const info = getUpgradeDisplayInfo(this.game.store, upgradeId);

      if (info) {
        const row = this.createUpgradeRow(info, i);
        row.y = LAYOUT.UPGRADE_LIST_Y + i * LAYOUT.UPGRADE_ROW_HEIGHT;
        this.container.addChild(row);
        this.upgradeRows.push(row);
      }
    }

    // Update selection highlight
    this.updateSelection();
  }

  /**
   * Create a single upgrade row with dual-cost display.
   */
  private createUpgradeRow(info: UpgradeDisplayInfo, index: number): Container {
    const { width } = this.game.config.canvas;
    const row = new Container();
    row.label = `upgrade-row-${info.id}`;

    // Selection indicator
    const selector = new Text({
      text: index === this.selectedIndex ? '>' : ' ',
      style: terminalBrightStyle,
    });
    selector.label = 'selector';
    selector.x = LAYOUT.PADDING;
    row.addChild(selector);

    // Upgrade name - bright if affordable or already owned
    const name = new Text({
      text: info.name,
      style: (info.canAfford || info.isMaxed) ? terminalBrightStyle : terminalDimStyle,
    });
    name.label = 'name';
    name.x = LAYOUT.PADDING + 30;
    row.addChild(name);

    // Format dual cost: "$100 + 10 TP"
    let costText: string;
    let automationEnabled = false;
    let isAutomationToggle = false;
    if (info.isMaxed && info.category === 'hardware') {
      // Show automation toggle state for owned hardware upgrades
      const upgrade = getUpgrade(info.id) as HardwareUpgrade | undefined;
      const automationId = upgrade?.automationId;
      if (automationId) {
        const automationState = this.game.store.getState().automations[automationId];
        automationEnabled = automationState?.enabled ?? true;
        isAutomationToggle = true;
        costText = automationEnabled ? '[ENABLED]' : '[DISABLED]';
      } else {
        costText = 'OWNED';
      }
    } else if (info.isMaxed) {
      costText = 'OWNED';
    } else if (info.secondaryCostFormatted && info.secondaryCostResource) {
      const primaryCost = formatResource(info.costResource, info.cost);
      const secondaryCost = formatResource(info.secondaryCostResource, info.secondaryCost ?? '0');
      costText = `${primaryCost} + ${secondaryCost}`;
    } else {
      costText = formatResource(info.costResource, info.cost);
    }

    // Determine cost color based on state
    let costFill: number;
    if (isAutomationToggle) {
      costFill = automationEnabled ? COLORS.TERMINAL_GREEN : COLORS.TERMINAL_RED;
    } else if (info.isMaxed) {
      costFill = COLORS.TERMINAL_DIM;
    } else if (info.canAfford) {
      costFill = COLORS.TERMINAL_YELLOW;
    } else {
      costFill = COLORS.TERMINAL_RED;
    }

    const costStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZES.NORMAL,
      fill: costFill,
    });

    const cost = new Text({
      text: costText,
      style: costStyle,
    });
    cost.label = 'cost';
    cost.anchor.set(0, 0);
    cost.x = width / 2 - 20;
    row.addChild(cost);

    // Effect
    const effect = new Text({
      text: info.effect,
      style: terminalDimStyle,
    });
    effect.label = 'effect';
    effect.anchor.set(1, 0);
    effect.x = width - LAYOUT.PADDING - 20;
    row.addChild(effect);

    return row;
  }

  /**
   * Create instructions at the bottom.
   */
  private createInstructions(): void {
    const { width, height } = this.game.config.canvas;

    const instructions = new Text({
      text: '[Up/Down] Select  [Enter] Purchase/Toggle  [Esc] Back',
      style: terminalDimStyle,
    });
    instructions.anchor.set(0.5, 0);
    instructions.x = width / 2;
    instructions.y = height - LAYOUT.INSTRUCTIONS_BOTTOM_OFFSET;
    this.container.addChild(instructions);
  }

  // ==========================================================================
  // Selection and Purchase
  // ==========================================================================

  /**
   * Update the visual selection state.
   */
  private updateSelection(): void {
    for (let i = 0; i < this.upgradeRows.length; i++) {
      const row = this.upgradeRows[i];
      if (!row) {
        continue;
      }
      const selector = row.getChildByLabel('selector') as Text | null;
      if (selector) {
        selector.text = i === this.selectedIndex ? '>' : ' ';
      }
    }
  }

  /**
   * Move selection up.
   */
  private selectUp(): void {
    if (this.hardwareUpgradeIds.length === 0) {return;}
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      this.updateSelection();
    }
  }

  /**
   * Move selection down.
   */
  private selectDown(): void {
    if (this.hardwareUpgradeIds.length === 0) {return;}
    if (this.selectedIndex < this.hardwareUpgradeIds.length - 1) {
      this.selectedIndex++;
      this.updateSelection();
    }
  }

  /**
   * Attempt to purchase or toggle the selected upgrade.
   * If the upgrade is already owned and is a hardware upgrade with an automation,
   * toggle the automation enabled/disabled instead of purchasing.
   */
  private purchaseSelected(): void {
    if (this.hardwareUpgradeIds.length === 0) {return;}

    const upgradeId = this.hardwareUpgradeIds[this.selectedIndex];
    if (!upgradeId) {
      return;
    }

    // Check if this is an owned hardware upgrade with a toggleable automation
    const upgrade = getUpgrade(upgradeId);
    if (upgrade?.category === 'hardware') {
      const hardwareUpgrade = upgrade as HardwareUpgrade;
      const state = this.game.store.getState();
      const isOwned = state.upgrades.apartment[upgradeId] === true;

      if (isOwned && hardwareUpgrade.automationId) {
        // Toggle the automation
        this.toggleAutomation(hardwareUpgrade.automationId);
        return;
      }
    }

    const success = purchaseUpgrade(this.game.store, upgradeId);

    if (success) {
      console.log(`[WorkbenchUpgradesScene] Purchased upgrade: ${upgradeId}`);
      // Refresh the entire upgrade list to reflect changes
      this.refreshUpgradeList();
    } else {
      console.log(`[WorkbenchUpgradesScene] Could not purchase upgrade: ${upgradeId}`);
    }
  }

  /**
   * Toggle an automation between enabled and disabled.
   */
  private toggleAutomation(automationId: string): void {
    const state = this.game.store.getState();
    const automationState = state.automations[automationId];

    if (!automationState) {
      // Initialize and enable the automation if it does not exist yet
      state.enableAutomation(automationId);
      console.log(`[WorkbenchUpgradesScene] Initialized and enabled automation: ${automationId}`);
    } else if (automationState.enabled) {
      state.disableAutomation(automationId);
      console.log(`[WorkbenchUpgradesScene] Disabled automation: ${automationId}`);
    } else {
      state.enableAutomation(automationId);
      console.log(`[WorkbenchUpgradesScene] Enabled automation: ${automationId}`);
    }

    // Refresh to reflect the new toggle state
    this.refreshUpgradeList();
  }

  /**
   * Refresh the upgrade list after a purchase.
   */
  private refreshUpgradeList(): void {
    // Remove existing rows
    for (const row of this.upgradeRows) {
      row.destroy({ children: true });
    }
    this.upgradeRows = [];

    // Recreate
    for (let i = 0; i < this.hardwareUpgradeIds.length; i++) {
      const upgradeId = this.hardwareUpgradeIds[i];
      if (!upgradeId) {
        continue;
      }

      const info = getUpgradeDisplayInfo(this.game.store, upgradeId);

      if (info) {
        const row = this.createUpgradeRow(info, i);
        row.y = LAYOUT.UPGRADE_LIST_Y + i * LAYOUT.UPGRADE_ROW_HEIGHT;
        this.container.addChild(row);
        this.upgradeRows.push(row);
      }
    }

    this.updateSelection();
  }

  // ==========================================================================
  // Store Subscription
  // ==========================================================================

  /**
   * Subscribe to store updates for resource balance changes.
   */
  private subscribeToStore(): void {
    this.unsubscribe = this.game.store.subscribe((state, prevState) => {
      // Update money display if changed
      if (state.resources.money !== prevState.resources.money && this.moneyText) {
        this.moneyText.text = formatResource('money', state.resources.money);
        // Also refresh upgrade list for affordability
        this.refreshUpgradeList();
      }

      // Update TP display if changed
      if (state.resources.technique !== prevState.resources.technique && this.tpText) {
        this.tpText.text = formatResource('technique', state.resources.technique);
        // Also refresh upgrade list for affordability
        this.refreshUpgradeList();
      }
    });
  }

  // ==========================================================================
  // Navigation
  // ==========================================================================

  /**
   * Go back to the apartment scene.
   */
  private goBack(): void {
    console.log('[WorkbenchUpgradesScene] Returning to apartment');
    void this.game.switchScene('apartment');
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Register the input context for this scene.
   */
  private registerInputContext(): void {
    const bindings = new Map<string, { onPress?: () => void; onRelease?: () => void }>();

    // Navigation
    bindings.set('ArrowUp', { onPress: () => this.selectUp() });
    bindings.set('ArrowDown', { onPress: () => this.selectDown() });
    bindings.set('KeyW', { onPress: () => this.selectUp() });
    bindings.set('KeyS', { onPress: () => this.selectDown() });

    // Purchase
    bindings.set('Enter', { onPress: () => this.purchaseSelected() });
    bindings.set('Space', { onPress: () => this.purchaseSelected() });

    // Back
    bindings.set('Escape', { onPress: () => this.goBack() });

    this.inputContext = {
      id: 'workbench-upgrades',
      priority: INPUT_PRIORITY.SCENE,
      enabled: true,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('workbench-upgrades');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new workbench upgrades scene.
 *
 * @param game - The game instance
 * @returns A new WorkbenchUpgradesScene
 */
export function createWorkbenchUpgradesScene(game: GameInstance): Scene {
  return new WorkbenchUpgradesScene(game as Game);
}
