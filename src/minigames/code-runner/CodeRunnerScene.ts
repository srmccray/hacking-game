/**
 * Code Runner Scene
 *
 * PixiJS scene for the Code Runner minigame. Handles:
 * - Visual rendering of player and scrolling obstacles
 * - Distance/score display in HUD
 * - Input context registration for keyboard handling (A/D, arrows)
 * - Results overlay on game end
 *
 * Visual Layout:
 * +------------------------------------------+
 * |  CODE RUNNER                              |
 * +------------------------------------------+
 * |  DISTANCE: 1234                           |
 * |                                           |
 * |  [===    ===][====     ====][==      ==]  |  <- Scrolling obstacles
 * |                                           |
 * |              [ V ]                        |  <- Player (terminal cursor)
 * +------------------------------------------+
 * |  A/D or arrows to move | ESC to exit      |
 * +------------------------------------------+
 *
 * Usage:
 *   // Via MinigameRegistry
 *   registry.register({
 *     id: 'code-runner',
 *     name: 'Code Runner',
 *     createScene: (game) => createCodeRunnerScene(game),
 *   });
 *
 *   // Direct usage
 *   const scene = createCodeRunnerScene(game);
 *   sceneManager.register('code-runner', () => scene);
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Scene, GameInstance } from '../../core/types';
import type { Game } from '../../game/Game';
import type { InputContext } from '../../input/InputManager';
import { INPUT_PRIORITY } from '../../input/InputManager';
import { CodeRunnerGame, type Obstacle } from './CodeRunnerGame';
import { COLORS } from '../../rendering/Renderer';
import {
  terminalDimStyle,
  terminalBrightStyle,
  titleStyle,
  scoreStyle,
} from '../../rendering/styles';
import { GameEvents } from '../../events/game-events';

// ============================================================================
// Configuration
// ============================================================================

/** Layout constants */
const LAYOUT = {
  /** Padding from edges */
  PADDING: 40,
  /** Header height */
  HEADER_HEIGHT: 60,
  /** Y position of instructions from bottom */
  INSTRUCTIONS_BOTTOM_OFFSET: 40,
  /** Player visual size (display only, hitbox comes from game config) */
  PLAYER_VISUAL_WIDTH: 24,
  PLAYER_VISUAL_HEIGHT: 32,
} as const;

/** Player character (terminal cursor style) */
const PLAYER_CHAR = '\u25BC'; // Down-pointing triangle

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Code Runner scene implementation.
 */
class CodeRunnerScene implements Scene {
  readonly id = 'code-runner';

  /** The PixiJS container for this scene */
  private readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** The Code Runner game logic */
  private minigame: CodeRunnerGame | null = null;

  /** Input context for this scene */
  private inputContext: InputContext | null = null;

  /** Whether results overlay is showing */
  private showingResults: boolean = false;

  // UI Elements
  private playerGraphic: Graphics | null = null;
  private playerText: Text | null = null;
  private obstacleGraphics: Graphics[] = [];
  private distanceText: Text | null = null;
  private statusText: Text | null = null;
  private resultsOverlay: Container | null = null;
  private gameArea: Container | null = null;

  // Event unsubscribers
  private unsubscribers: Array<() => void> = [];

  constructor(game: Game) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'code-runner-scene';
  }

  // ==========================================================================
  // Scene Lifecycle
  // ==========================================================================

  getContainer(): Container {
    return this.container;
  }

  onEnter(): void {
    console.log('[CodeRunnerScene] Entering scene');

    // Create UI
    this.createUI();

    // Create minigame instance with canvas dimensions
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;
    this.minigame = new CodeRunnerGame(
      this.game.config.minigames.codeRunner,
      width,
      height
    );

    // Set up minigame event listeners
    this.setupMinigameListeners();

    // Register input context
    this.registerInputContext();

    // Emit scene entered event
    this.game.eventBus.emit(GameEvents.SCENE_ENTERED, {
      sceneId: this.id,
    });

    // Start the game
    this.minigame.start();

    // Emit minigame started event
    this.game.eventBus.emit(GameEvents.MINIGAME_STARTED, {
      minigameId: this.id,
      startTime: Date.now(),
    });

    // Initial render
    this.updateDisplay();
  }

  onExit(): void {
    console.log('[CodeRunnerScene] Exiting scene');

    // Disable input context
    if (this.inputContext) {
      this.game.inputManager.disableContext(this.inputContext.id);
    }

    // Clean up event listeners
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    // End game if still playing
    if (this.minigame?.isPlaying) {
      this.minigame.end();
    }

    // Emit scene exited event
    this.game.eventBus.emit(GameEvents.SCENE_EXITED, {
      sceneId: this.id,
      nextSceneId: 'apartment',
    });
  }

  onUpdate(deltaMs: number): void {
    if (!this.minigame || this.showingResults) {
      return;
    }

    // Update minigame logic
    this.minigame.update(deltaMs);

    // Update display
    this.updateDisplay();
  }

  onDestroy(): void {
    console.log('[CodeRunnerScene] Destroying scene');

    // Unregister input context
    if (this.inputContext) {
      this.game.inputManager.unregisterContext(this.inputContext.id);
    }

    // Destroy minigame
    if (this.minigame) {
      this.minigame.destroy();
      this.minigame = null;
    }

    // Clear UI references
    this.playerGraphic = null;
    this.playerText = null;
    this.obstacleGraphics = [];
    this.distanceText = null;
    this.statusText = null;
    this.resultsOverlay = null;
    this.gameArea = null;

    // Destroy container and children
    this.container.destroy({ children: true });
  }

  // ==========================================================================
  // UI Creation
  // ==========================================================================

  /**
   * Create all UI elements.
   */
  private createUI(): void {
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;
    const centerX = width / 2;

    // Background
    this.createBackground(width, height);

    // Header
    this.createHeader(centerX);

    // Game area (for player and obstacles)
    this.createGameArea(width, height);

    // HUD
    this.createHUD();

    // Instructions
    this.createInstructions(centerX, height - LAYOUT.INSTRUCTIONS_BOTTOM_OFFSET);
  }

  /**
   * Create background and border.
   */
  private createBackground(width: number, height: number): void {
    // Main background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: COLORS.BACKGROUND, alpha: 0.95 });
    this.container.addChild(bg);

    // Border
    const border = new Graphics();
    border.rect(LAYOUT.PADDING / 2, LAYOUT.PADDING / 2, width - LAYOUT.PADDING, height - LAYOUT.PADDING);
    border.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });
    this.container.addChild(border);
  }

  /**
   * Create header with title.
   */
  private createHeader(centerX: number): void {
    const title = new Text({
      text: 'CODE RUNNER',
      style: titleStyle,
    });
    title.anchor.set(0.5, 0);
    title.x = centerX;
    title.y = LAYOUT.PADDING;
    this.container.addChild(title);

    // Divider line
    const divider = new Graphics();
    divider.moveTo(LAYOUT.PADDING, LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING);
    divider.lineTo(this.game.config.canvas.width - LAYOUT.PADDING, LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING);
    divider.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    this.container.addChild(divider);
  }

  /**
   * Create the game area container with player and obstacles.
   */
  private createGameArea(width: number, height: number): void {
    this.gameArea = new Container();
    this.gameArea.label = 'game-area';
    this.container.addChild(this.gameArea);

    // Create player graphic (container for both shape and character)
    const playerContainer = new Container();
    playerContainer.label = 'player';

    // Player visual - terminal cursor style
    this.playerGraphic = new Graphics();
    this.playerGraphic.rect(
      -LAYOUT.PLAYER_VISUAL_WIDTH / 2,
      -LAYOUT.PLAYER_VISUAL_HEIGHT / 2,
      LAYOUT.PLAYER_VISUAL_WIDTH,
      LAYOUT.PLAYER_VISUAL_HEIGHT
    );
    this.playerGraphic.fill({ color: COLORS.TERMINAL_GREEN, alpha: 0.3 });
    this.playerGraphic.stroke({ color: COLORS.TERMINAL_BRIGHT, width: 2 });
    playerContainer.addChild(this.playerGraphic);

    // Player character text
    this.playerText = new Text({
      text: PLAYER_CHAR,
      style: terminalBrightStyle,
    });
    this.playerText.anchor.set(0.5);
    playerContainer.addChild(this.playerText);

    this.gameArea.addChild(playerContainer);

    // Initial position (will be updated in updateDisplay)
    playerContainer.x = width / 2;
    playerContainer.y = height - 80;
  }

  /**
   * Create the HUD (distance display).
   */
  private createHUD(): void {
    const hudContainer = new Container();
    hudContainer.label = 'hud';

    // Distance label
    const distanceLabel = new Text({
      text: 'DISTANCE:',
      style: terminalDimStyle,
    });
    distanceLabel.anchor.set(0, 0.5);
    distanceLabel.x = LAYOUT.PADDING + 20;
    distanceLabel.y = LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING + 30;
    hudContainer.addChild(distanceLabel);

    // Distance value
    this.distanceText = new Text({
      text: '0',
      style: scoreStyle,
    });
    this.distanceText.anchor.set(0, 0.5);
    this.distanceText.x = distanceLabel.x + 100;
    this.distanceText.y = LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING + 30;
    hudContainer.addChild(this.distanceText);

    this.container.addChild(hudContainer);
  }

  /**
   * Create instruction text.
   */
  private createInstructions(centerX: number, y: number): void {
    this.statusText = new Text({
      text: 'A/D or \u2190/\u2192 to move | [ESC] Exit',
      style: terminalDimStyle,
    });
    this.statusText.anchor.set(0.5, 0);
    this.statusText.x = centerX;
    this.statusText.y = y;
    this.container.addChild(this.statusText);
  }

  // ==========================================================================
  // Display Updates
  // ==========================================================================

  /**
   * Update all display elements based on game state.
   */
  private updateDisplay(): void {
    if (!this.minigame) {return;}

    const state = this.minigame.getState();

    this.updatePlayer(state.playerX, state.playerY);
    this.updateObstacles(state.obstacles);
    this.updateHUD(state.distance);
  }

  /**
   * Update the player position.
   */
  private updatePlayer(x: number, y: number): void {
    if (!this.gameArea) {return;}

    // Find the player container (first child should be it)
    const playerContainer = this.gameArea.children.find(c => c.label === 'player');
    if (playerContainer) {
      playerContainer.x = x;
      playerContainer.y = y;
    }
  }

  /**
   * Update obstacle graphics.
   */
  private updateObstacles(obstacles: readonly Obstacle[]): void {
    if (!this.gameArea) {return;}

    // Remove excess obstacle graphics
    while (this.obstacleGraphics.length > obstacles.length) {
      const graphic = this.obstacleGraphics.pop();
      if (graphic) {
        this.gameArea.removeChild(graphic);
        graphic.destroy();
      }
    }

    // Add or update obstacle graphics
    for (let i = 0; i < obstacles.length; i++) {
      const obstacle = obstacles[i];
      if (!obstacle) {continue;}

      let graphic = this.obstacleGraphics[i];

      if (!graphic) {
        // Create new graphic
        graphic = new Graphics();
        graphic.label = `obstacle-${i}`;
        this.obstacleGraphics.push(graphic);
        // Insert at index 0 so player renders on top
        this.gameArea.addChildAt(graphic, 0);
      }

      // Update graphic
      graphic.clear();

      // Left block
      if (obstacle.leftWidth > 0) {
        graphic.rect(obstacle.x, obstacle.y, obstacle.leftWidth, obstacle.height);
        graphic.fill({ color: COLORS.TERMINAL_DIM, alpha: 0.8 });
        graphic.stroke({ color: COLORS.TERMINAL_GREEN, width: 1 });
      }

      // Right block
      const rightX = this.game.config.canvas.width - obstacle.rightWidth;
      if (obstacle.rightWidth > 0) {
        graphic.rect(rightX, obstacle.y, obstacle.rightWidth, obstacle.height);
        graphic.fill({ color: COLORS.TERMINAL_DIM, alpha: 0.8 });
        graphic.stroke({ color: COLORS.TERMINAL_GREEN, width: 1 });
      }
    }
  }

  /**
   * Update the HUD display.
   */
  private updateHUD(distance: number): void {
    if (this.distanceText) {
      this.distanceText.text = Math.floor(distance).toString();
    }
  }

  // ==========================================================================
  // Minigame Event Handlers
  // ==========================================================================

  /**
   * Set up listeners for minigame events.
   */
  private setupMinigameListeners(): void {
    if (!this.minigame) {return;}

    // Handle game end
    const unsubEnd = this.minigame.on('end', () => {
      this.handleGameEnd();
    });
    this.unsubscribers.push(unsubEnd);
  }

  /**
   * Handle game completion.
   */
  private handleGameEnd(): void {
    if (!this.minigame) {return;}

    this.showingResults = true;

    // Get final stats
    const stats = this.minigame.getFinalStats();
    const distance = this.minigame.distance;
    const moneyReward = this.minigame.calculateMoneyReward();

    // Record score and award resources
    const state = this.game.store.getState();
    state.ensureMinigameState('code-runner');
    state.recordScore('code-runner', String(Math.floor(distance)));
    state.incrementPlayCount('code-runner');
    state.addResource('money', moneyReward);
    state.trackResourceEarned('money', moneyReward);

    // Emit completion event
    this.game.eventBus.emit(GameEvents.MINIGAME_COMPLETED, {
      minigameId: 'code-runner',
      score: Math.floor(distance),
      maxCombo: stats.maxCombo,
      durationMs: stats.durationMs,
      rewards: { money: moneyReward },
      isNewTopScore: this.isNewTopScore(Math.floor(distance)),
    });

    // Show results overlay
    this.showResultsOverlay(distance, moneyReward);
  }

  /**
   * Check if score qualifies as a new top score.
   */
  private isNewTopScore(score: number): boolean {
    const minigameState = this.game.store.getState().minigames['code-runner'];
    if (!minigameState) {return true;}

    const topScores = minigameState.topScores;
    if (topScores.length < 5) {return true;}

    const lowestTop = Number(topScores[topScores.length - 1] ?? 0);
    return score > lowestTop;
  }

  /**
   * Show the results overlay.
   */
  private showResultsOverlay(distance: number, moneyReward: string): void {
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;

    this.resultsOverlay = new Container();
    this.resultsOverlay.label = 'results-overlay';

    // Semi-transparent background
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: 0x000000, alpha: 0.85 });
    this.resultsOverlay.addChild(bg);

    // Results box
    const boxWidth = 400;
    const boxHeight = 280;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;

    // Box fill
    const boxFill = new Graphics();
    boxFill.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
    boxFill.fill({ color: COLORS.BACKGROUND });
    this.resultsOverlay.addChild(boxFill);

    // Box border
    const boxBorder = new Graphics();
    boxBorder.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
    boxBorder.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });
    this.resultsOverlay.addChild(boxBorder);

    // Title
    const title = new Text({
      text: 'CRASH!',
      style: titleStyle,
    });
    title.anchor.set(0.5, 0);
    title.x = width / 2;
    title.y = boxY + 20;
    this.resultsOverlay.addChild(title);

    // Distance label
    const distanceLabel = new Text({
      text: 'DISTANCE TRAVELED',
      style: terminalDimStyle,
    });
    distanceLabel.anchor.set(0.5, 0);
    distanceLabel.x = width / 2;
    distanceLabel.y = boxY + 70;
    this.resultsOverlay.addChild(distanceLabel);

    // Distance value
    const distanceValue = new Text({
      text: Math.floor(distance).toString(),
      style: scoreStyle,
    });
    distanceValue.anchor.set(0.5, 0);
    distanceValue.x = width / 2;
    distanceValue.y = boxY + 95;
    this.resultsOverlay.addChild(distanceValue);

    // Money earned
    const moneyText = new Text({
      text: `Money Earned: $${moneyReward}`,
      style: terminalBrightStyle,
    });
    moneyText.anchor.set(0.5, 0);
    moneyText.x = width / 2;
    moneyText.y = boxY + 150;
    this.resultsOverlay.addChild(moneyText);

    // Instructions
    const instructions = new Text({
      text: 'Press ENTER to play again or ESC to exit',
      style: terminalDimStyle,
    });
    instructions.anchor.set(0.5, 0);
    instructions.x = width / 2;
    instructions.y = boxY + boxHeight - 40;
    this.resultsOverlay.addChild(instructions);

    this.container.addChild(this.resultsOverlay);
  }

  /**
   * Hide the results overlay and optionally restart.
   */
  private hideResultsOverlay(restart: boolean): void {
    if (this.resultsOverlay) {
      this.container.removeChild(this.resultsOverlay);
      this.resultsOverlay.destroy({ children: true });
      this.resultsOverlay = null;
    }

    this.showingResults = false;

    // Clear obstacle graphics for fresh start
    for (const graphic of this.obstacleGraphics) {
      if (this.gameArea) {
        this.gameArea.removeChild(graphic);
      }
      graphic.destroy();
    }
    this.obstacleGraphics = [];

    if (restart && this.minigame) {
      this.minigame.start();

      // Emit minigame started event
      this.game.eventBus.emit(GameEvents.MINIGAME_STARTED, {
        minigameId: this.id,
        startTime: Date.now(),
      });

      this.updateDisplay();
    }
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Register the input context for this scene.
   */
  private registerInputContext(): void {
    // Build bindings map
    const bindings = new Map<string, { onPress?: () => void; onRelease?: () => void }>();

    // Left movement (A key, Arrow Left)
    bindings.set('KeyA', {
      onPress: () => this.handleMovement(true, false),
      onRelease: () => this.handleMovementRelease('left'),
    });
    bindings.set('ArrowLeft', {
      onPress: () => this.handleMovement(true, false),
      onRelease: () => this.handleMovementRelease('left'),
    });

    // Right movement (D key, Arrow Right)
    bindings.set('KeyD', {
      onPress: () => this.handleMovement(false, true),
      onRelease: () => this.handleMovementRelease('right'),
    });
    bindings.set('ArrowRight', {
      onPress: () => this.handleMovement(false, true),
      onRelease: () => this.handleMovementRelease('right'),
    });

    // Escape to exit
    bindings.set('Escape', {
      onPress: () => this.handleEscape(),
    });

    // Enter to restart after game over
    bindings.set('Enter', {
      onPress: () => this.handleEnter(),
    });

    this.inputContext = {
      id: 'code-runner',
      priority: INPUT_PRIORITY.SCENE,
      enabled: true,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('code-runner');
  }

  /**
   * Handle movement input.
   */
  private handleMovement(left: boolean, right: boolean): void {
    if (this.showingResults || !this.minigame?.isPlaying) {
      return;
    }

    // Check if opposite key is held for combined input
    const leftHeld = this.game.inputManager.isAnyKeyHeld(['KeyA', 'ArrowLeft']);
    const rightHeld = this.game.inputManager.isAnyKeyHeld(['KeyD', 'ArrowRight']);

    // Set input based on current press and what's already held
    const effectiveLeft = left || leftHeld;
    const effectiveRight = right || rightHeld;

    this.minigame.setInput(effectiveLeft, effectiveRight);
  }

  /**
   * Handle movement key release.
   */
  private handleMovementRelease(_direction: 'left' | 'right'): void {
    if (!this.minigame) {
      return;
    }

    // Check what's still held (direction param unused but kept for clarity of which key released)
    const leftHeld = this.game.inputManager.isAnyKeyHeld(['KeyA', 'ArrowLeft']);
    const rightHeld = this.game.inputManager.isAnyKeyHeld(['KeyD', 'ArrowRight']);

    this.minigame.setInput(leftHeld, rightHeld);
  }

  /**
   * Handle escape key.
   */
  private handleEscape(): void {
    if (this.showingResults) {
      // Exit to apartment
      void this.game.switchScene('apartment');
      return;
    }

    // End game early and exit
    if (this.minigame?.isPlaying) {
      this.minigame.end();
    }

    void this.game.switchScene('apartment');
  }

  /**
   * Handle enter key.
   */
  private handleEnter(): void {
    if (this.showingResults) {
      // Restart game
      this.hideResultsOverlay(true);
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Code Runner scene.
 *
 * @param game - The game instance
 * @returns A new CodeRunnerScene
 */
export function createCodeRunnerScene(game: GameInstance): Scene {
  return new CodeRunnerScene(game as Game);
}
