/**
 * Minigame Upgrades Scene
 *
 * Displays upgrades available for a specific minigame, along with the
 * player's current TP (Technique Points) balance.
 *
 * Visual Layout:
 * +------------------------------------------+
 * |              UPGRADES                    |
 * |           Code Breaker                   |
 * +------------------------------------------+
 * |                                          |
 * |           TP Balance: 1.23K TP           |
 * |                                          |
 * |            Coming Soon...                |
 * |                                          |
 * +------------------------------------------+
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
  titleStyle,
} from '../../rendering/styles';
import { formatResource } from '../../core/resources/resource-manager';
import { createMinigameInterstitialScene } from '../minigame-interstitial';

// ============================================================================
// Configuration
// ============================================================================

/** Layout constants */
const LAYOUT = {
  /** Padding from edges */
  PADDING: 60,
  /** Title Y position */
  TITLE_Y: 100,
  /** Minigame name Y position */
  MINIGAME_NAME_Y: 150,
  /** TP Balance Y position */
  TP_BALANCE_Y: 240,
  /** Coming soon message Y position */
  COMING_SOON_Y: 320,
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

  /** Store unsubscribe function */
  private unsubscribe: (() => void) | null = null;

  constructor(game: Game, minigameId: string) {
    this.game = game;
    this.minigameId = minigameId;
    this.id = `minigame-upgrades-${minigameId}`;
    this.container = new Container();
    this.container.label = 'minigame-upgrades-scene';
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

    // Create coming soon placeholder
    this.createComingSoon();

    // Create instructions
    this.createInstructions();

    // Register input context
    this.registerInputContext();

    // Subscribe to store updates for TP balance
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
    bg.rect(LAYOUT.PADDING - 20, LAYOUT.TITLE_Y - 40, width - (LAYOUT.PADDING - 20) * 2, height - LAYOUT.TITLE_Y);
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
   * Create coming soon placeholder.
   */
  private createComingSoon(): void {
    const { width } = this.game.config.canvas;

    const comingSoon = new Text({
      text: 'Coming Soon...',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: FONT_SIZES.LARGE,
        fill: COLORS.TERMINAL_DIM,
        fontStyle: 'italic',
      }),
    });
    comingSoon.anchor.set(0.5, 0);
    comingSoon.x = width / 2;
    comingSoon.y = LAYOUT.COMING_SOON_Y;
    this.container.addChild(comingSoon);
  }

  /**
   * Create instructions at the bottom.
   */
  private createInstructions(): void {
    const { width, height } = this.game.config.canvas;

    const instructions = new Text({
      text: '[Esc] Back',
      style: terminalDimStyle,
    });
    instructions.anchor.set(0.5, 0);
    instructions.x = width / 2;
    instructions.y = height - LAYOUT.INSTRUCTIONS_BOTTOM_OFFSET;
    this.container.addChild(instructions);
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
