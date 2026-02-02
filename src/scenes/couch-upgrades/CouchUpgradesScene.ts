/**
 * Couch Upgrades Scene
 *
 * Displays purchasable upgrades from the couch station, using Money (primary)
 * and Reputation points (secondary) as currencies.
 *
 * Visual Layout:
 * +------------------------------------------+
 * |              UPGRADES                    |
 * +------------------------------------------+
 * |   Money: $1.23K          Renown: 0 RP    |
 * +------------------------------------------+
 * |                                          |
 * |   > Training Manual     $10      +1 TP   |
 * |     ...                                  |
 * |                                          |
 * +------------------------------------------+
 * |  [Up/Down] Select  [Enter] Purchase      |
 * |  [Esc] Back                              |
 * +------------------------------------------+
 *
 * Usage:
 *   sceneManager.register('couch-upgrades', () => createCouchUpgradesScene(game));
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
  type UpgradeDisplayInfo,
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

/** Upgrades available from the couch */
const COUCH_UPGRADE_IDS = [
  'training-manual',  // Training Manual - grants TP
];

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Couch Upgrades Scene implementation.
 */
class CouchUpgradesScene implements Scene {
  readonly id = 'couch-upgrades';

  /** The PixiJS container for this scene */
  private readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** Input context for this scene */
  private inputContext: InputContext | null = null;

  /** Money balance text element */
  private moneyText: Text | null = null;

  /** Renown balance text element */
  private renownText: Text | null = null;

  /** Upgrade row containers for visual updates */
  private upgradeRows: Container[] = [];

  /** Currently selected upgrade index */
  private selectedIndex = 0;

  /** Store unsubscribe function */
  private unsubscribe: (() => void) | null = null;

  constructor(game: Game) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'couch-upgrades-scene';
  }

  // ==========================================================================
  // Scene Lifecycle
  // ==========================================================================

  getContainer(): Container {
    return this.container;
  }

  onEnter(): void {
    console.log('[CouchUpgradesScene] Entering scene');

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
    console.log('[CouchUpgradesScene] Exiting scene');

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
    console.log('[CouchUpgradesScene] Destroying scene');

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
    this.renownText = null;
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
      text: 'UPGRADES',
      style: titleStyle,
    });
    title.anchor.set(0.5, 0);
    title.x = width / 2;
    title.y = LAYOUT.TITLE_Y;
    this.container.addChild(title);
  }

  /**
   * Create the resource display showing Money (primary) and Renown (secondary).
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

    // Renown display (right side)
    this.renownText = new Text({
      text: formatResource('renown', state.resources.renown),
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZES.NORMAL,
        fill: COLORS.TERMINAL_DIM,
      }),
    });
    this.renownText.anchor.set(1, 0);
    this.renownText.x = width - LAYOUT.PADDING - 20;
    this.renownText.y = LAYOUT.RESOURCE_Y;
    this.container.addChild(this.renownText);

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

    for (let i = 0; i < COUCH_UPGRADE_IDS.length; i++) {
      const upgradeId = COUCH_UPGRADE_IDS[i];
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
   * Create a single upgrade row.
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

    // Upgrade name with level (if applicable)
    const nameText = info.maxLevel === 0
      ? `${info.name} (Lv ${info.level})`
      : info.name;

    const name = new Text({
      text: nameText,
      style: info.canAfford ? terminalBrightStyle : terminalDimStyle,
    });
    name.label = 'name';
    name.x = LAYOUT.PADDING + 30;
    row.addChild(name);

    // Cost
    const costStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZES.NORMAL,
      fill: info.isMaxed
        ? COLORS.TERMINAL_DIM
        : info.canAfford
          ? COLORS.TERMINAL_YELLOW
          : COLORS.TERMINAL_RED,
    });

    const costText = info.isMaxed
      ? 'MAXED'
      : formatResource(info.costResource, info.cost);

    const cost = new Text({
      text: costText,
      style: costStyle,
    });
    cost.label = 'cost';
    cost.anchor.set(0, 0);
    cost.x = width / 2 + 20;
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
      text: '[Up/Down] Select  [Enter] Purchase  [Esc] Back',
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
    if (this.selectedIndex > 0) {
      this.selectedIndex--;
      this.updateSelection();
    }
  }

  /**
   * Move selection down.
   */
  private selectDown(): void {
    if (this.selectedIndex < COUCH_UPGRADE_IDS.length - 1) {
      this.selectedIndex++;
      this.updateSelection();
    }
  }

  /**
   * Attempt to purchase the selected upgrade.
   */
  private purchaseSelected(): void {
    const upgradeId = COUCH_UPGRADE_IDS[this.selectedIndex];
    if (!upgradeId) {
      return;
    }

    const success = purchaseUpgrade(this.game.store, upgradeId);

    if (success) {
      console.log(`[CouchUpgradesScene] Purchased upgrade: ${upgradeId}`);
      // Refresh the entire upgrade list to reflect changes
      this.refreshUpgradeList();
    } else {
      console.log(`[CouchUpgradesScene] Could not purchase upgrade: ${upgradeId}`);
    }
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
    for (let i = 0; i < COUCH_UPGRADE_IDS.length; i++) {
      const upgradeId = COUCH_UPGRADE_IDS[i];
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

      // Update renown display if changed
      if (state.resources.renown !== prevState.resources.renown && this.renownText) {
        this.renownText.text = formatResource('renown', state.resources.renown);
      }

      // Update technique display could trigger refreshes too if needed
      if (state.resources.technique !== prevState.resources.technique) {
        // Technique changed - could be from Training Manual purchase
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
    console.log('[CouchUpgradesScene] Returning to apartment');
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
      id: 'couch-upgrades',
      priority: INPUT_PRIORITY.SCENE,
      enabled: true,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('couch-upgrades');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new couch upgrades scene.
 *
 * @param game - The game instance
 * @returns A new CouchUpgradesScene
 */
export function createCouchUpgradesScene(game: GameInstance): Scene {
  return new CouchUpgradesScene(game as Game);
}
