/**
 * Minigame Upgrades Scene
 *
 * Displays purchasable upgrades for a specific minigame, along with the
 * player's current TP (Technique Points) balance.
 *
 * Visual Layout:
 * +------------------------------------------+
 * |              UPGRADES                    |
 * |           Code Runner                    |
 * +------------------------------------------+
 * |           TP Balance: 1.23K TP           |
 * +------------------------------------------+
 * |                                          |
 * |   > Gap Expander (Lv 2)  15 TP  +2 gap  |
 * |                                          |
 * +------------------------------------------+
 * |  [Up/Down] Select  [Enter] Purchase      |
 * |  [Esc] Back                              |
 * +------------------------------------------+
 *
 * Usage:
 *   sceneManager.register('minigame-upgrades', () => createMinigameUpgradesScene(game, minigameId));
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
  terminalSmallStyle,
  titleStyle,
} from '../../rendering/styles';
import { formatResource } from '../../core/resources/resource-manager';
import { createMinigameInterstitialScene } from '../minigame-interstitial';
import {
  getMinigameUpgrades,
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
  /** Minigame name Y position */
  MINIGAME_NAME_Y: 130,
  /** TP Balance Y position */
  TP_BALANCE_Y: 200,
  /** Upgrade list start Y position */
  UPGRADE_LIST_Y: 270,
  /** Height of each upgrade row (name + description) */
  UPGRADE_ROW_HEIGHT: 58,
  /** No upgrades message Y position */
  NO_UPGRADES_Y: 320,
  /** Instructions Y offset from bottom */
  INSTRUCTIONS_BOTTOM_OFFSET: 80,
} as const;

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Minigame Upgrades Scene implementation.
 */
class MinigameUpgradesScene implements Scene {
  readonly id: string;

  /** The PixiJS container for this scene */
  private readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** The minigame ID this upgrades scene is for */
  private readonly minigameId: string;

  /** Input context for this scene */
  private inputContext: InputContext | null = null;

  /** TP balance text element for updates */
  private tpBalanceText: Text | null = null;

  /** Upgrade row containers for visual updates */
  private upgradeRows: Container[] = [];

  /** Currently selected upgrade index */
  private selectedIndex = 0;

  /** Upgrade IDs available for this minigame */
  private upgradeIds: string[] = [];

  /** Store unsubscribe function */
  private unsubscribe: (() => void) | null = null;

  constructor(game: Game, minigameId: string) {
    this.game = game;
    this.minigameId = minigameId;
    this.id = `minigame-upgrades-${minigameId}`;
    this.container = new Container();
    this.container.label = 'minigame-upgrades-scene';

    // Collect upgrade IDs for this minigame
    this.upgradeIds = getMinigameUpgrades(minigameId).map(u => u.id);
  }

  // ==========================================================================
  // Scene Lifecycle
  // ==========================================================================

  getContainer(): Container {
    return this.container;
  }

  onEnter(): void {
    console.log('[MinigameUpgradesScene] Entering scene for minigame:', this.minigameId);

    // Create background
    this.createBackground();

    // Create header
    this.createHeader();

    // Create TP balance display
    this.createTPBalance();

    // Create upgrade list or empty message
    if (this.upgradeIds.length > 0) {
      this.createUpgradeList();
    } else {
      this.createNoUpgrades();
    }

    // Create instructions
    this.createInstructions();

    // Register input context
    this.registerInputContext();

    // Subscribe to store updates
    this.subscribeToStore();
  }

  onExit(): void {
    console.log('[MinigameUpgradesScene] Exiting scene');

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
    // No continuous updates needed for this static scene
  }

  onDestroy(): void {
    console.log('[MinigameUpgradesScene] Destroying scene');

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
    this.tpBalanceText = null;
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
   * Create the header with title and minigame name.
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

    // Get minigame name from registry
    const minigameDef = this.game.minigameRegistry.get(this.minigameId);
    const minigameName = minigameDef?.name ?? this.minigameId;

    // Minigame name subtitle
    const subtitle = new Text({
      text: minigameName,
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZES.MEDIUM,
        fill: COLORS.TERMINAL_DIM,
      }),
    });
    subtitle.anchor.set(0.5, 0);
    subtitle.x = width / 2;
    subtitle.y = LAYOUT.MINIGAME_NAME_Y;
    this.container.addChild(subtitle);

    // Divider line
    const divider = new Graphics();
    divider.stroke({ color: COLORS.TERMINAL_GREEN, width: 1, alpha: 0.5 });
    divider.moveTo(LAYOUT.PADDING, LAYOUT.MINIGAME_NAME_Y + 50);
    divider.lineTo(width - LAYOUT.PADDING, LAYOUT.MINIGAME_NAME_Y + 50);
    divider.stroke();
    this.container.addChild(divider);
  }

  /**
   * Create TP balance display.
   */
  private createTPBalance(): void {
    const { width } = this.game.config.canvas;

    // Get current TP balance
    const gameState = this.game.store.getState();
    const tpBalance = gameState.resources.technique;

    this.tpBalanceText = new Text({
      text: `TP Balance: ${formatResource('technique', tpBalance)}`,
      style: terminalBrightStyle,
    });
    this.tpBalanceText.anchor.set(0.5, 0);
    this.tpBalanceText.x = width / 2;
    this.tpBalanceText.y = LAYOUT.TP_BALANCE_Y;
    this.container.addChild(this.tpBalanceText);
  }

  /**
   * Create the upgrade list.
   */
  private createUpgradeList(): void {
    this.upgradeRows = [];

    for (let i = 0; i < this.upgradeIds.length; i++) {
      const upgradeId = this.upgradeIds[i];
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

    // Description (dimmer, smaller text below the name)
    if (info.description) {
      const description = new Text({
        text: info.description,
        style: terminalSmallStyle,
      });
      description.label = 'description';
      description.x = LAYOUT.PADDING + 30;
      description.y = 22;
      row.addChild(description);
    }

    return row;
  }

  /**
   * Create "No upgrades available" message.
   */
  private createNoUpgrades(): void {
    const { width } = this.game.config.canvas;

    const noUpgrades = new Text({
      text: 'No upgrades available yet.',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZES.LARGE,
        fill: COLORS.TERMINAL_DIM,
        fontStyle: 'italic',
      }),
    });
    noUpgrades.anchor.set(0.5, 0);
    noUpgrades.x = width / 2;
    noUpgrades.y = LAYOUT.NO_UPGRADES_Y;
    this.container.addChild(noUpgrades);
  }

  /**
   * Create instructions at the bottom.
   */
  private createInstructions(): void {
    const { width, height } = this.game.config.canvas;

    const hasUpgrades = this.upgradeIds.length > 0;
    const instructionText = hasUpgrades
      ? '[Up/Down] Select  [Enter] Purchase  [Esc] Back'
      : '[Esc] Back';

    const instructions = new Text({
      text: instructionText,
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
    if (this.selectedIndex < this.upgradeIds.length - 1) {
      this.selectedIndex++;
      this.updateSelection();
    }
  }

  /**
   * Attempt to purchase the selected upgrade.
   */
  private purchaseSelected(): void {
    const upgradeId = this.upgradeIds[this.selectedIndex];
    if (!upgradeId) {
      return;
    }

    const success = purchaseUpgrade(this.game.store, upgradeId);

    if (success) {
      console.log(`[MinigameUpgradesScene] Purchased upgrade: ${upgradeId}`);
      // Refresh the entire upgrade list to reflect changes
      this.refreshUpgradeList();
    } else {
      console.log(`[MinigameUpgradesScene] Could not purchase upgrade: ${upgradeId}`);
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
    for (let i = 0; i < this.upgradeIds.length; i++) {
      const upgradeId = this.upgradeIds[i];
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
   * Subscribe to store updates for TP balance.
   */
  private subscribeToStore(): void {
    this.unsubscribe = this.game.store.subscribe((state, prevState) => {
      // Update TP balance display if changed
      if (state.resources.technique !== prevState.resources.technique && this.tpBalanceText) {
        this.tpBalanceText.text = `TP Balance: ${formatResource('technique', state.resources.technique)}`;
        // Also refresh upgrade list for affordability
        this.refreshUpgradeList();
      }
    });
  }

  // ==========================================================================
  // Navigation
  // ==========================================================================

  /**
   * Go back to the interstitial scene.
   */
  private goBack(): void {
    console.log('[MinigameUpgradesScene] Returning to interstitial');
    // Register and switch to the interstitial for this minigame
    const interstitialSceneId = `minigame-interstitial-${this.minigameId}`;
    this.game.sceneManager.register(
      interstitialSceneId,
      () => createMinigameInterstitialScene(this.game, this.minigameId)
    );
    void this.game.switchScene(interstitialSceneId);
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Register the input context for this scene.
   */
  private registerInputContext(): void {
    const bindings = new Map<string, { onPress?: () => void; onRelease?: () => void }>();

    // Navigation (only if upgrades exist)
    if (this.upgradeIds.length > 0) {
      bindings.set('ArrowUp', { onPress: () => this.selectUp() });
      bindings.set('ArrowDown', { onPress: () => this.selectDown() });
      bindings.set('KeyW', { onPress: () => this.selectUp() });
      bindings.set('KeyS', { onPress: () => this.selectDown() });

      // Purchase
      bindings.set('Enter', { onPress: () => this.purchaseSelected() });
      bindings.set('Space', { onPress: () => this.purchaseSelected() });
    }

    // Back
    bindings.set('Escape', { onPress: () => this.goBack() });

    this.inputContext = {
      id: `minigame-upgrades-${this.minigameId}`,
      priority: INPUT_PRIORITY.SCENE,
      enabled: true,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext(`minigame-upgrades-${this.minigameId}`);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new minigame upgrades scene.
 *
 * @param game - The game instance
 * @param minigameId - The ID of the minigame this upgrades scene is for
 * @returns A new MinigameUpgradesScene
 */
export function createMinigameUpgradesScene(game: GameInstance, minigameId: string): Scene {
  return new MinigameUpgradesScene(game as Game, minigameId);
}
