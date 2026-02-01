/**
 * Minigame Interstitial Scene
 *
 * Displays a menu before entering a minigame with options to start the game
 * or view upgrades for that minigame.
 *
 * Visual Layout:
 * +------------------------------------------+
 * |              CODE BREAKER                |
 * +------------------------------------------+
 * |                                          |
 * |          > [Start Game]                  |
 * |            [Upgrades]                    |
 * |                                          |
 * +------------------------------------------+
 * |  [Enter] Select   [Esc] Back             |
 * +------------------------------------------+
 *
 * Usage:
 *   sceneManager.register('minigame-interstitial', () => createMinigameInterstitialScene(game, minigameId));
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Scene, GameInstance } from '../../core/types';
import type { Game } from '../../game/Game';
import type { InputContext } from '../../input/InputManager';
import { INPUT_PRIORITY } from '../../input/InputManager';
import { COLORS } from '../../rendering/Renderer';
import {
  terminalDimStyle,
  terminalBrightStyle,
  terminalSmallStyle,
  titleStyle,
} from '../../rendering/styles';
import { formatDecimal } from '../../core/resources/resource-manager';
import { createMinigameUpgradesScene } from '../minigame-upgrades';

// ============================================================================
// Configuration
// ============================================================================

/** Layout constants */
const LAYOUT = {
  /** Padding from edges */
  PADDING: 60,
  /** Header Y position */
  HEADER_Y: 120,
  /** Y position where high scores section starts */
  HIGH_SCORES_Y: 200,
  /** Y position where menu items start */
  MENU_START_Y: 310,
  /** Height of each menu item */
  ITEM_HEIGHT: 50,
  /** Instructions Y offset from bottom */
  INSTRUCTIONS_BOTTOM_OFFSET: 50,
} as const;

/** Menu options */
const MENU_OPTIONS = ['Start Game', 'Upgrades'] as const;

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Minigame Interstitial Scene implementation.
 */
class MinigameInterstitialScene implements Scene {
  readonly id = 'minigame-interstitial';

  /** The PixiJS container for this scene */
  private readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** The minigame ID this interstitial is for */
  private readonly minigameId: string;

  /** Input context for this scene */
  private inputContext: InputContext | null = null;

  /** Menu item text objects */
  private menuItems: Text[] = [];

  /** Currently selected index */
  private selectedIndex = 0;

  /** Selection indicator graphic */
  private selectionIndicator: Graphics | null = null;

  constructor(game: Game, minigameId: string) {
    this.game = game;
    this.minigameId = minigameId;
    this.container = new Container();
    this.container.label = 'minigame-interstitial-scene';
  }

  // ==========================================================================
  // Scene Lifecycle
  // ==========================================================================

  getContainer(): Container {
    return this.container;
  }

  onEnter(): void {
    console.log('[MinigameInterstitialScene] Entering scene for minigame:', this.minigameId);

    // Create background
    this.createBackground();

    // Create header with minigame name
    this.createHeader();

    // Create high scores display
    this.createHighScores();

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
    console.log('[MinigameInterstitialScene] Exiting scene');

    // Disable input context
    if (this.inputContext) {
      this.game.inputManager.disableContext(this.inputContext.id);
    }
  }

  onUpdate(_deltaMs: number): void {
    // No continuous updates needed for this static menu
  }

  onDestroy(): void {
    console.log('[MinigameInterstitialScene] Destroying scene');

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
    bg.rect(LAYOUT.PADDING - 20, LAYOUT.HEADER_Y - 50, width - (LAYOUT.PADDING - 20) * 2, height - LAYOUT.HEADER_Y);
    bg.stroke();

    this.container.addChild(bg);
  }

  /**
   * Create the header with minigame name.
   */
  private createHeader(): void {
    const { width } = this.game.config.canvas;

    // Get minigame name from registry
    const minigameDef = this.game.minigameRegistry.get(this.minigameId);
    const minigameName = minigameDef?.name ?? this.minigameId;

    const header = new Text({
      text: minigameName.toUpperCase(),
      style: titleStyle,
    });
    header.anchor.set(0.5, 0);
    header.x = width / 2;
    header.y = LAYOUT.HEADER_Y;
    this.container.addChild(header);

    // Divider line
    const divider = new Graphics();
    divider.stroke({ color: COLORS.TERMINAL_GREEN, width: 1, alpha: 0.5 });
    divider.moveTo(LAYOUT.PADDING, LAYOUT.HEADER_Y + 60);
    divider.lineTo(width - LAYOUT.PADDING, LAYOUT.HEADER_Y + 60);
    divider.stroke();
    this.container.addChild(divider);
  }

  /**
   * Create the high scores display section.
   */
  private createHighScores(): void {
    const { width } = this.game.config.canvas;
    const centerX = width / 2;

    const minigameState = this.game.store.getState().minigames[this.minigameId];
    const topScores = minigameState?.topScores ?? [];
    const displayCount = 3;

    // "HIGH SCORES" label
    const label = new Text({
      text: 'HIGH SCORES',
      style: terminalDimStyle,
    });
    label.anchor.set(0.5, 0);
    label.x = centerX;
    label.y = LAYOUT.HIGH_SCORES_Y;
    this.container.addChild(label);

    if (topScores.length === 0) {
      const placeholder = new Text({
        text: 'No scores yet',
        style: terminalSmallStyle,
      });
      placeholder.anchor.set(0.5, 0);
      placeholder.x = centerX;
      placeholder.y = LAYOUT.HIGH_SCORES_Y + 24;
      this.container.addChild(placeholder);
    } else {
      const scoresToShow = topScores.slice(0, displayCount);
      const scoreLines = scoresToShow
        .map((score, i) => `${i + 1}. ${formatDecimal(score)}`)
        .join('   ');

      const scoresText = new Text({
        text: scoreLines,
        style: terminalSmallStyle,
      });
      scoresText.anchor.set(0.5, 0);
      scoresText.x = centerX;
      scoresText.y = LAYOUT.HIGH_SCORES_Y + 24;
      this.container.addChild(scoresText);
    }
  }

  /**
   * Create menu items.
   */
  private createMenuItems(): void {
    const { width } = this.game.config.canvas;

    for (const [i, option] of MENU_OPTIONS.entries()) {
      const yPos = LAYOUT.MENU_START_Y + i * LAYOUT.ITEM_HEIGHT;

      const text = new Text({
        text: option,
        style: terminalBrightStyle,
      });
      text.anchor.set(0.5, 0);
      text.x = width / 2;
      text.y = yPos;
      this.container.addChild(text);

      this.menuItems.push(text);
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
      text: '[Up/Down] Navigate   [Enter] Select   [Esc] Back',
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

    const { width } = this.game.config.canvas;

    // Clear and redraw indicator
    this.selectionIndicator.clear();

    const selectedItem = this.menuItems[this.selectedIndex];
    if (!selectedItem) {
      return;
    }

    const yPos = selectedItem.y;

    // Draw selection brackets
    const textWidth = selectedItem.width;
    const bracketOffset = textWidth / 2 + 20;

    // Left bracket: >
    this.selectionIndicator.fill({ color: COLORS.TERMINAL_GREEN });
    this.selectionIndicator.moveTo(width / 2 - bracketOffset - 10, yPos + 8);
    this.selectionIndicator.lineTo(width / 2 - bracketOffset, yPos + 12);
    this.selectionIndicator.lineTo(width / 2 - bracketOffset - 10, yPos + 16);
    this.selectionIndicator.closePath();
    this.selectionIndicator.fill();

    // Right bracket: <
    this.selectionIndicator.fill({ color: COLORS.TERMINAL_GREEN });
    this.selectionIndicator.moveTo(width / 2 + bracketOffset + 10, yPos + 8);
    this.selectionIndicator.lineTo(width / 2 + bracketOffset, yPos + 12);
    this.selectionIndicator.lineTo(width / 2 + bracketOffset + 10, yPos + 16);
    this.selectionIndicator.closePath();
    this.selectionIndicator.fill();

    // Update item highlighting
    for (let i = 0; i < this.menuItems.length; i++) {
      const item = this.menuItems[i];
      if (!item) {continue;}
      const isSelected = i === this.selectedIndex;

      // Adjust alpha based on selection
      item.alpha = isSelected ? 1.0 : 0.5;
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
   * Confirm selection.
   */
  private confirmSelection(): void {
    const selectedOption = MENU_OPTIONS[this.selectedIndex];

    if (selectedOption === 'Start Game') {
      console.log('[MinigameInterstitialScene] Starting minigame:', this.minigameId);
      void this.game.switchScene(this.minigameId);
    } else if (selectedOption === 'Upgrades') {
      console.log('[MinigameInterstitialScene] Opening upgrades for:', this.minigameId);
      // Register and switch to minigame upgrades scene
      const upgradesSceneId = `minigame-upgrades-${this.minigameId}`;
      this.game.sceneManager.register(
        upgradesSceneId,
        () => createMinigameUpgradesScene(this.game, this.minigameId)
      );
      void this.game.switchScene(upgradesSceneId);
    }
  }

  /**
   * Go back to the minigame selection.
   */
  private goBack(): void {
    console.log('[MinigameInterstitialScene] Returning to minigame selection');
    void this.game.switchScene('minigame-selection');
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
      id: 'minigame-interstitial',
      priority: INPUT_PRIORITY.SCENE,
      enabled: true,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('minigame-interstitial');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new minigame interstitial scene.
 *
 * @param game - The game instance
 * @param minigameId - The ID of the minigame this interstitial is for
 * @returns A new MinigameInterstitialScene
 */
export function createMinigameInterstitialScene(game: GameInstance, minigameId: string): Scene {
  return new MinigameInterstitialScene(game as Game, minigameId);
}
