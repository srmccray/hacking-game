/**
 * Minigame Selection Scene
 *
 * Displays a menu of available minigames for the player to choose from.
 * Shows minigame names, descriptions, primary resources, and unlock status.
 *
 * Visual Layout:
 * +------------------------------------------+
 * |           SELECT MINIGAME                |
 * +------------------------------------------+
 * |                                          |
 * |  > [Code Breaker]              [$$$]     |
 * |    Break codes to earn money             |
 * |                                          |
 * |    [???]                      [Locked]   |
 * |    Complete upgrades to unlock           |
 * |                                          |
 * +------------------------------------------+
 * |  [Enter] Play   [Esc] Back               |
 * +------------------------------------------+
 *
 * Usage:
 *   sceneManager.register('minigame-selection', () => createMinigameSelectionScene(game));
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene, GameInstance } from '../../core/types';
import type { Game } from '../../game/Game';
import type { InputContext } from '../../input/InputManager';
import { INPUT_PRIORITY } from '../../input/InputManager';
import { COLORS } from '../../rendering/Renderer';
import {
  FONT_FAMILY,
  terminalDimStyle,
  terminalBrightStyle,
  titleStyle,
} from '../../rendering/styles';
import type { MinigameSummary } from '../../minigames/MinigameRegistry';

// ============================================================================
// Configuration
// ============================================================================

/** Layout constants */
const LAYOUT = {
  /** Padding from edges */
  PADDING: 60,
  /** Header Y position */
  HEADER_Y: 80,
  /** Y position where menu items start */
  MENU_START_Y: 160,
  /** Minimum height of each menu item */
  ITEM_MIN_HEIGHT: 60,
  /** Spacing between menu items */
  ITEM_SPACING: 20,
  /** Instructions Y offset from bottom */
  INSTRUCTIONS_BOTTOM_OFFSET: 50,
  /** Maximum lines for description text */
  MAX_DESC_LINES: 2,
  /** Description font size */
  DESC_FONT_SIZE: 14,
} as const;

/** Resource type display info */
const RESOURCE_DISPLAY: Record<string, { symbol: string; color: number }> = {
  money: { symbol: '$$$', color: COLORS.TERMINAL_GREEN },
  technique: { symbol: '***', color: 0x00ffff },
  renown: { symbol: '^^^', color: 0xffff00 },
};

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Menu item data structure for rendering.
 */
interface MenuItem {
  summary: MinigameSummary;
  unlocked: boolean;
  container: Container;
}

/**
 * Minigame Selection Scene implementation.
 */
class MinigameSelectionScene implements Scene {
  readonly id = 'minigame-selection';

  /** The PixiJS container for this scene */
  private readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** Input context for this scene */
  private inputContext: InputContext | null = null;

  /** Menu items */
  private menuItems: MenuItem[] = [];

  /** Currently selected index */
  private selectedIndex = 0;

  /** Selection indicator graphic */
  private selectionIndicator: Graphics | null = null;

  constructor(game: Game) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'minigame-selection-scene';
  }

  // ==========================================================================
  // Scene Lifecycle
  // ==========================================================================

  getContainer(): Container {
    return this.container;
  }

  onEnter(): void {
    console.log('[MinigameSelectionScene] Entering scene');

    // Create background
    this.createBackground();

    // Create header
    this.createHeader();

    // Create menu items
    this.createMenuItems();

    // Create selection indicator
    this.createSelectionIndicator();

    // Create instructions
    this.createInstructions();

    // Register input context
    this.registerInputContext();

    // Update selection display
    this.updateSelection();
  }

  onExit(): void {
    console.log('[MinigameSelectionScene] Exiting scene');

    // Disable input context
    if (this.inputContext) {
      this.game.inputManager.disableContext(this.inputContext.id);
    }
  }

  onUpdate(_deltaMs: number): void {
    // No continuous updates needed for this static menu
  }

  onDestroy(): void {
    console.log('[MinigameSelectionScene] Destroying scene');

    // Unregister input context
    if (this.inputContext) {
      this.game.inputManager.unregisterContext(this.inputContext.id);
    }

    // Clear menu items
    this.menuItems = [];
    this.selectionIndicator = null;

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
    bg.rect(LAYOUT.PADDING - 20, LAYOUT.HEADER_Y - 30, width - (LAYOUT.PADDING - 20) * 2, height - LAYOUT.HEADER_Y);
    bg.stroke();

    this.container.addChild(bg);
  }

  /**
   * Create the header.
   */
  private createHeader(): void {
    const { width } = this.game.config.canvas;

    const header = new Text({
      text: 'SELECT MINIGAME',
      style: titleStyle,
    });
    header.anchor.set(0.5, 0);
    header.x = width / 2;
    header.y = LAYOUT.HEADER_Y;
    this.container.addChild(header);

    // Divider line
    const divider = new Graphics();
    divider.stroke({ color: COLORS.TERMINAL_GREEN, width: 1, alpha: 0.5 });
    divider.moveTo(LAYOUT.PADDING, LAYOUT.HEADER_Y + 50);
    divider.lineTo(width - LAYOUT.PADDING, LAYOUT.HEADER_Y + 50);
    divider.stroke();
    this.container.addChild(divider);
  }

  /**
   * Create menu items from registered minigames.
   */
  private createMenuItems(): void {
    const { width } = this.game.config.canvas;
    const summaries = this.game.minigameRegistry.getSummaries();
    const gameState = this.game.store.getState();

    let yPos = LAYOUT.MENU_START_Y;

    for (const summary of summaries) {
      // Check unlock status from game state
      // Default to unlocked if minigame state doesn't exist (new minigames in old saves)
      const minigameState = gameState.minigames[summary.id];
      const unlocked = minigameState?.unlocked ?? true;

      const itemContainer = new Container();
      itemContainer.y = yPos;

      // Calculate available width for name text (leave room for resource indicator)
      // Resource indicator is approximately 80px wide including brackets
      const resourceIndicatorWidth = 80;
      const nameStartX = LAYOUT.PADDING + 40; // Leave room for selection indicator
      const nameMaxWidth = width - nameStartX - LAYOUT.PADDING - resourceIndicatorWidth;

      // Name (or ??? if locked) - with word wrap to prevent overflow
      const nameText = new Text({
        text: unlocked ? summary.name : '???',
        style: new TextStyle({
          ...(unlocked ? terminalBrightStyle : terminalDimStyle),
          wordWrap: true,
          wordWrapWidth: nameMaxWidth,
        }),
      });
      nameText.x = nameStartX;
      nameText.y = 0;
      itemContainer.addChild(nameText);

      // Resource indicator (right side)
      const resourceInfo = RESOURCE_DISPLAY[summary.primaryResource] || { symbol: '???', color: COLORS.TERMINAL_DIM };
      const resourceText = new Text({
        text: unlocked ? `[${resourceInfo.symbol}]` : '[Locked]',
        style: new TextStyle({
          fontFamily: FONT_FAMILY,
          fontSize: 16,
          fill: unlocked ? resourceInfo.color : COLORS.TERMINAL_DIM,
        }),
      });
      resourceText.anchor.set(1, 0);
      resourceText.x = width - LAYOUT.PADDING;
      resourceText.y = 0;
      itemContainer.addChild(resourceText);

      // Description - use word wrap to allow multi-line text
      const descStartX = LAYOUT.PADDING + 40;
      const borderRightEdge = width - (LAYOUT.PADDING - 20);
      const descMaxWidth = borderRightEdge - descStartX - 20; // 20px safety margin

      const descriptionText = unlocked ? summary.description : 'Complete upgrades to unlock';

      const descText = new Text({
        text: descriptionText,
        style: new TextStyle({
          fontFamily: FONT_FAMILY,
          fontSize: LAYOUT.DESC_FONT_SIZE,
          fill: COLORS.TERMINAL_DIM,
          wordWrap: true,
          wordWrapWidth: descMaxWidth,
        }),
      });
      descText.x = descStartX;
      descText.y = 25;
      itemContainer.addChild(descText);

      // Calculate actual item height based on wrapped text
      const descHeight = descText.height;
      const itemHeight = Math.max(LAYOUT.ITEM_MIN_HEIGHT, 25 + descHeight + 10); // 25 is desc Y offset, 10 is bottom padding

      this.container.addChild(itemContainer);

      this.menuItems.push({
        summary,
        unlocked,
        container: itemContainer,
      });

      yPos += itemHeight + LAYOUT.ITEM_SPACING;
    }

    // If no minigames registered, show a message
    if (this.menuItems.length === 0) {
      const noGamesText = new Text({
        text: 'No minigames available',
        style: terminalDimStyle,
      });
      noGamesText.anchor.set(0.5, 0);
      noGamesText.x = width / 2;
      noGamesText.y = LAYOUT.MENU_START_Y;
      this.container.addChild(noGamesText);
    }
  }

  /**
   * Create the selection indicator.
   */
  private createSelectionIndicator(): void {
    this.selectionIndicator = new Graphics();
    this.container.addChild(this.selectionIndicator);
  }

  /**
   * Create instructions at the bottom.
   */
  private createInstructions(): void {
    const { width, height } = this.game.config.canvas;

    const instructions = new Text({
      text: '[↑/↓] Navigate   [Enter] Play   [Esc] Back',
      style: terminalDimStyle,
    });
    instructions.anchor.set(0.5, 0);
    instructions.x = width / 2;
    instructions.y = height - LAYOUT.INSTRUCTIONS_BOTTOM_OFFSET;
    this.container.addChild(instructions);
  }

  // ==========================================================================
  // Selection Management
  // ==========================================================================

  /**
   * Update the selection indicator and item highlighting.
   */
  private updateSelection(): void {
    if (!this.selectionIndicator || this.menuItems.length === 0) {
      return;
    }

    // Clear and redraw indicator
    this.selectionIndicator.clear();

    const selectedItem = this.menuItems[this.selectedIndex];
    if (!selectedItem) {
      return;
    }

    const yPos = selectedItem.container.y;

    // Draw selection arrow
    this.selectionIndicator.fill({ color: COLORS.TERMINAL_GREEN });
    this.selectionIndicator.moveTo(LAYOUT.PADDING + 10, yPos + 8);
    this.selectionIndicator.lineTo(LAYOUT.PADDING + 25, yPos + 16);
    this.selectionIndicator.lineTo(LAYOUT.PADDING + 10, yPos + 24);
    this.selectionIndicator.closePath();
    this.selectionIndicator.fill();

    // Update item highlighting
    for (let i = 0; i < this.menuItems.length; i++) {
      const item = this.menuItems[i];
      if (!item) {continue;}
      const isSelected = i === this.selectedIndex;

      // Adjust alpha based on selection
      item.container.alpha = isSelected ? 1.0 : 0.7;
    }
  }

  /**
   * Move selection up.
   */
  private moveUp(): void {
    if (this.menuItems.length === 0) {
      return;
    }

    this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
    this.updateSelection();
  }

  /**
   * Move selection down.
   */
  private moveDown(): void {
    if (this.menuItems.length === 0) {
      return;
    }

    this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
    this.updateSelection();
  }

  /**
   * Confirm selection and launch the minigame.
   */
  private confirmSelection(): void {
    if (this.menuItems.length === 0) {
      return;
    }

    const selectedItem = this.menuItems[this.selectedIndex];
    if (!selectedItem) {
      return;
    }

    // Check if unlocked
    if (!selectedItem.unlocked) {
      console.log('[MinigameSelectionScene] Minigame is locked:', selectedItem.summary.id);
      // Could add visual/audio feedback here
      return;
    }

    console.log('[MinigameSelectionScene] Launching minigame:', selectedItem.summary.id);
    void this.game.switchScene(selectedItem.summary.id);
  }

  /**
   * Go back to the apartment.
   */
  private goBack(): void {
    console.log('[MinigameSelectionScene] Returning to apartment');
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
    bindings.set('ArrowUp', { onPress: () => this.moveUp() });
    bindings.set('ArrowDown', { onPress: () => this.moveDown() });
    bindings.set('KeyW', { onPress: () => this.moveUp() });
    bindings.set('KeyS', { onPress: () => this.moveDown() });

    // Selection
    bindings.set('Enter', { onPress: () => this.confirmSelection() });
    bindings.set('Space', { onPress: () => this.confirmSelection() });

    // Back
    bindings.set('Escape', { onPress: () => this.goBack() });

    this.inputContext = {
      id: 'minigame-selection',
      priority: INPUT_PRIORITY.SCENE,
      enabled: true,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('minigame-selection');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new minigame selection scene.
 *
 * @param game - The game instance
 * @returns A new MinigameSelectionScene
 */
export function createMinigameSelectionScene(game: GameInstance): Scene {
  return new MinigameSelectionScene(game as Game);
}
