/**
 * Code Runner Scene
 *
 * PixiJS scene for the Code Runner minigame. Handles:
 * - Visual rendering of player (spinning triangle) and scrolling obstacles (code walls)
 * - Distance/score display in HUD
 * - Input context registration for keyboard handling (A/D, arrows)
 * - Results overlay on game end
 *
 * Visual Layout:
 * +------------------------------------------+
 * |  DISTANCE: 1234                           |
 * |                                           |
 * |  [code...][gap][...code][code...][gap]    |  <- Code text walls
 * |                                           |
 * |              /\                           |  <- Player (spinning triangle)
 * +------------------------------------------+
 * |  A/D or arrows to move | ESC to exit      |
 * +------------------------------------------+
 *
 * Visual Features:
 * - Player is an upward-pointing triangle that spins based on movement
 * - Walls are displayed as lines of code text instead of solid rectangles
 * - Title removed for cleaner gameplay view
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

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene, GameInstance } from '../../core/types';
import type { Game } from '../../game/Game';
import type { InputContext } from '../../input/InputManager';
import { INPUT_PRIORITY } from '../../input/InputManager';
import { CodeRunnerGame, type Obstacle, type DifficultyType } from './CodeRunnerGame';
import { COLORS } from '../../rendering/Renderer';
import {
  terminalDimStyle,
  terminalBrightStyle,
  titleStyle,
  scoreStyle,
  FONT_FAMILY,
  FONT_SIZES,
} from '../../rendering/styles';
import { GameEvents } from '../../events/game-events';
import { getGapWidthBonus, getWallSpacingBonus, getMoveSpeedBonus } from '../../upgrades/upgrade-definitions';
import { createMinigameInterstitialScene } from '../../scenes/minigame-interstitial';

// ============================================================================
// Configuration
// ============================================================================

/** Layout constants */
const LAYOUT = {
  /** Padding from edges */
  PADDING: 40,
  /** Header height - reduced since we removed the title */
  HEADER_HEIGHT: 20,
  /** Y position of instructions from bottom */
  INSTRUCTIONS_BOTTOM_OFFSET: 40,
  /** Player triangle size (radius from center to vertex) */
  PLAYER_TRIANGLE_SIZE: 16,
  /** Player rotation speed (radians per pixel of movement) */
  PLAYER_ROTATION_SPEED: 0.08,
} as const;

/** Code snippets used for wall obstacles */
const CODE_SNIPPETS = [
  'const x = 0;',
  'if (true) {',
  'return data;',
  'let i = 0;',
  'for (;;) {',
  'while (1)',
  'break;',
  'continue;',
  '} else {',
  'import *',
  'export fn',
  'async () =>',
  'await fetch',
  'try { }',
  'catch (e)',
  'throw err;',
  'new Map()',
  'null;',
  'undefined',
  '// TODO:',
  '/* ... */',
  'fn(a, b)',
  'return;',
  'class C {}',
  'extends B',
  'super();',
  'this.x =',
  'arr.push()',
  'arr.pop()',
  'str.split',
  'Object.keys',
  'JSON.parse',
  'console.log',
  'process.env',
  'module.exports',
  'require("")',
  'useState()',
  'useEffect',
  'onClick={',
  '<div />',
  '</span>',
];

/** Style for code wall text */
const codeWallStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.SMALL,
  fill: COLORS.TERMINAL_GREEN,
});

/** Messages displayed when difficulty increases, keyed by difficulty type */
const DIFFICULTY_MESSAGES: Record<DifficultyType, string[]> = {
  spawn_rate: [
    'FIREWALL DENSITY INCREASING',
    'PACKET FLOOD DETECTED',
    'INTRUSION RATE RISING',
  ],
  gap_width: [
    'SECURITY PATCH APPLIED',
    'ACCESS PORT NARROWING',
    'ENCRYPTION LAYER ADDED',
  ],
  player_speed: [
    'BANDWIDTH THROTTLED',
    'LATENCY SPIKE',
    'CONNECTION DEGRADING',
  ],
};

/** Duration of the difficulty popup fade in milliseconds */
const DIFFICULTY_POPUP_FADE_MS = 1000;

/** Style for the difficulty popup text */
const difficultyPopupStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.MEDIUM,
  fill: '#FF4444',
  fontWeight: 'bold',
});

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
  private playerContainer: Container | null = null;
  private playerGraphic: Graphics | null = null;
  private readonly obstacleContainersById: Map<number, Container> = new Map();
  private distanceText: Text | null = null;
  private difficultyStatsText: Text | null = null;
  private statusText: Text | null = null;
  private resultsOverlay: Container | null = null;
  private gameArea: Container | null = null;

  // Difficulty popup
  private difficultyPopupText: Text | null = null;
  private difficultyPopupFadeTimer: number = 0;
  private difficultyPopupFading: boolean = false;

  // Player Y-axis spin state (uses scaleX for flip effect)
  private playerSpinPhase: number = 0;
  private lastPlayerX: number = 0;

  // Cache for obstacle code text by obstacle ID (to prevent flickering)
  private readonly obstacleTextCache: Map<number, { leftText: string; rightText: string }> = new Map();

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

    // Create minigame instance with canvas dimensions and upgrade bonuses
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;
    const gapBonus = getGapWidthBonus(this.game.store);
    const spacingBonus = getWallSpacingBonus(this.game.store);
    const speedBonus = getMoveSpeedBonus(this.game.store);
    this.minigame = new CodeRunnerGame(
      this.game.config.minigames.codeRunner,
      width,
      height,
      gapBonus,
      spacingBonus,
      speedBonus
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

    // Update difficulty popup fade
    this.updateDifficultyPopupFade(deltaMs);

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
    this.playerContainer = null;
    this.playerGraphic = null;
    this.obstacleContainersById.clear();
    this.distanceText = null;
    this.difficultyStatsText = null;
    this.statusText = null;
    this.resultsOverlay = null;
    this.gameArea = null;
    this.difficultyPopupText = null;

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

    // Difficulty popup (centered, near top of game area)
    this.createDifficultyPopup(centerX);

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
   * Create header (title removed as per requirements).
   */
  private createHeader(_centerX: number): void {
    // Title removed - just add a subtle divider line for visual structure
    const divider = new Graphics();
    divider.moveTo(LAYOUT.PADDING, LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING);
    divider.lineTo(this.game.config.canvas.width - LAYOUT.PADDING, LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING);
    divider.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.3 });
    this.container.addChild(divider);
  }

  /**
   * Create the game area container with player and obstacles.
   */
  private createGameArea(width: number, height: number): void {
    this.gameArea = new Container();
    this.gameArea.label = 'game-area';

    // Add a mask to clip obstacles that extend beyond the game border
    const maskGraphic = new Graphics();
    const maskPad = LAYOUT.PADDING / 2;
    maskGraphic.rect(maskPad, maskPad, width - LAYOUT.PADDING, height - LAYOUT.PADDING);
    maskGraphic.fill({ color: 0xffffff });
    this.container.addChild(maskGraphic);
    this.gameArea.mask = maskGraphic;

    this.container.addChild(this.gameArea);

    // Create player container
    this.playerContainer = new Container();
    this.playerContainer.label = 'player';

    // Player visual - upward-pointing triangle (terminal cursor style)
    this.playerGraphic = new Graphics();
    this.drawPlayerTriangle();
    this.playerContainer.addChild(this.playerGraphic);

    this.gameArea.addChild(this.playerContainer);

    // Initial position (will be updated in updateDisplay)
    this.playerContainer.x = width / 2;
    this.playerContainer.y = height - 80;
    this.lastPlayerX = width / 2;
  }

  /**
   * Draw the player triangle shape.
   * Upward-pointing triangle centered at origin.
   */
  private drawPlayerTriangle(): void {
    if (!this.playerGraphic) {
      return;
    }

    const size = LAYOUT.PLAYER_TRIANGLE_SIZE;

    this.playerGraphic.clear();

    // Draw upward-pointing triangle
    // Vertices: top center, bottom left, bottom right
    this.playerGraphic.moveTo(0, -size);                          // Top vertex
    this.playerGraphic.lineTo(-size * 0.866, size * 0.5);         // Bottom left (60 degrees)
    this.playerGraphic.lineTo(size * 0.866, size * 0.5);          // Bottom right
    this.playerGraphic.closePath();

    this.playerGraphic.fill({ color: COLORS.TERMINAL_GREEN, alpha: 0.6 });
    this.playerGraphic.stroke({ color: COLORS.TERMINAL_BRIGHT, width: 2 });
  }

  /**
   * Create the HUD (distance display).
   */
  private createHUD(): void {
    const hudContainer = new Container();
    hudContainer.label = 'hud';

    // Walls label
    const wallsLabel = new Text({
      text: 'WALLS:',
      style: terminalDimStyle,
    });
    wallsLabel.anchor.set(0, 0.5);
    wallsLabel.x = LAYOUT.PADDING + 20;
    wallsLabel.y = LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING + 30;
    hudContainer.addChild(wallsLabel);

    // Walls value
    this.distanceText = new Text({
      text: '0',
      style: scoreStyle,
    });
    this.distanceText.anchor.set(0, 0.5);
    this.distanceText.x = wallsLabel.x + 80;
    this.distanceText.y = LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING + 30;
    hudContainer.addChild(this.distanceText);

    // Difficulty stats (compact row below walls count)
    const difficultyStatsStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZES.SMALL,
      fill: COLORS.TERMINAL_DIM,
    });
    this.difficultyStatsText = new Text({
      text: 'FIREWALL: 0 | GAP: 0 | SPEED: 0',
      style: difficultyStatsStyle,
    });
    this.difficultyStatsText.anchor.set(0, 0.5);
    this.difficultyStatsText.x = LAYOUT.PADDING + 20;
    this.difficultyStatsText.y = LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING + 50;
    hudContainer.addChild(this.difficultyStatsText);

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

  /**
   * Create the difficulty popup text element (initially hidden).
   */
  private createDifficultyPopup(centerX: number): void {
    this.difficultyPopupText = new Text({
      text: '',
      style: difficultyPopupStyle,
    });
    this.difficultyPopupText.anchor.set(0.5, 0.5);
    this.difficultyPopupText.x = centerX;
    this.difficultyPopupText.y = LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING + 80;
    this.difficultyPopupText.alpha = 0;
    this.container.addChild(this.difficultyPopupText);
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
    this.updateHUD(this.minigame!.wallsPassed);
  }

  /**
   * Update the player position and Y-axis spin.
   * Uses scaleX to create the illusion of spinning on the Y-axis (like a 3D flip).
   */
  private updatePlayer(x: number, y: number): void {
    if (!this.playerContainer || !this.playerGraphic) {return;}

    // Update position
    this.playerContainer.x = x;
    this.playerContainer.y = y;

    // Calculate movement delta for Y-axis spin
    const deltaX = x - this.lastPlayerX;
    this.lastPlayerX = x;

    // Spin the triangle on Y-axis (flip effect using scaleX)
    // When moving right, advance the phase; when moving left, reverse it
    if (Math.abs(deltaX) > 0.1) {
      // Advance spin phase based on movement (adjust speed with multiplier)
      this.playerSpinPhase += deltaX * LAYOUT.PLAYER_ROTATION_SPEED;

      // Use cosine to create smooth flip effect: cos(phase) gives -1 to 1
      // This makes the triangle appear to flip on its Y-axis
      this.playerGraphic.scale.x = Math.cos(this.playerSpinPhase);
    }
  }

  /**
   * Update obstacle visuals (code text walls).
   * Uses obstacle IDs to track containers and ensure stable text.
   */
  private updateObstacles(obstacles: readonly Obstacle[]): void {
    if (!this.gameArea) {return;}

    // Build a set of current obstacle IDs for cleanup
    const currentObstacleIds = new Set(obstacles.map((o) => o.id));

    // Remove containers for obstacles that no longer exist
    for (const [obstacleId, container] of this.obstacleContainersById) {
      if (!currentObstacleIds.has(obstacleId)) {
        this.gameArea.removeChild(container);
        container.destroy({ children: true });
        this.obstacleContainersById.delete(obstacleId);
        // Also clean up the text cache for this obstacle
        this.obstacleTextCache.delete(obstacleId);
      }
    }

    // Add or update obstacle containers
    for (const obstacle of obstacles) {
      let obstacleContainer = this.obstacleContainersById.get(obstacle.id);

      if (!obstacleContainer) {
        // Create new container with code text walls
        obstacleContainer = this.createCodeWallObstacle(obstacle);
        this.obstacleContainersById.set(obstacle.id, obstacleContainer);
        // Insert at index 0 so player renders on top
        this.gameArea.addChildAt(obstacleContainer, 0);
      }

      // Update Y position (walls scroll down)
      obstacleContainer.y = obstacle.y;
    }
  }

  /**
   * Create a code wall obstacle container.
   * Walls are displayed as lines of code text instead of solid rectangles.
   * Text is cached per obstacle ID to ensure stable text for the obstacle's lifetime.
   */
  private createCodeWallObstacle(obstacle: Obstacle): Container {
    const container = new Container();
    container.label = `obstacle-${obstacle.id}`;

    const charWidth = 7; // Approximate character width for monospace font at SMALL size

    // Get or create cached text strings for this specific obstacle instance
    let cachedTexts = this.obstacleTextCache.get(obstacle.id);
    if (!cachedTexts) {
      cachedTexts = {
        leftText: this.generateCodeString(obstacle.leftWidth, charWidth, true),
        rightText: this.generateCodeString(obstacle.rightWidth, charWidth, false),
      };
      this.obstacleTextCache.set(obstacle.id, cachedTexts);
    }

    // Create left wall code text
    if (obstacle.leftWidth > 0) {
      const leftText = new Text({
        text: cachedTexts.leftText,
        style: codeWallStyle,
      });
      leftText.anchor.set(0, 0.5);
      leftText.x = obstacle.x;
      leftText.y = 0;
      container.addChild(leftText);
    }

    // Create right wall code text
    if (obstacle.rightWidth > 0) {
      const rightX = this.game.config.canvas.width - obstacle.rightWidth;
      const rightText = new Text({
        text: cachedTexts.rightText,
        style: codeWallStyle,
      });
      rightText.anchor.set(0, 0.5);
      rightText.x = rightX;
      rightText.y = 0;
      container.addChild(rightText);
    }

    return container;
  }

  /**
   * Generate a code string filled with code snippets to span the given width.
   * This is a pure function that returns a string, used for caching.
   */
  private generateCodeString(width: number, charWidth: number, alignLeft: boolean): string {
    const targetChars = Math.floor(width / charWidth);
    let codeText = '';

    // Build up text with random code snippets until we reach target width
    while (codeText.length < targetChars) {
      const snippet = CODE_SNIPPETS[Math.floor(Math.random() * CODE_SNIPPETS.length)];
      if (!snippet) {
        continue;
      }

      if (codeText.length + snippet.length + 1 <= targetChars) {
        codeText += (codeText.length > 0 ? ' ' : '') + snippet;
      } else {
        // Fill remaining space with partial snippet or padding
        const remaining = targetChars - codeText.length;
        if (remaining > 1) {
          codeText += ' ' + snippet.substring(0, remaining - 1);
        }
        break;
      }
    }

    // Pad to exact width if needed
    while (codeText.length < targetChars) {
      codeText += '.';
    }

    return alignLeft ? codeText : codeText.split('').reverse().join('');
  }

  /**
   * Update the HUD display.
   */
  private updateHUD(wallsPassed: number): void {
    if (this.distanceText) {
      this.distanceText.text = wallsPassed.toString();
    }

    if (this.difficultyStatsText && this.minigame) {
      const penalties = this.minigame.penaltyCounts;
      // Convert raw penalty values to logical penalty counts:
      // spawnRate: 50ms per penalty, gapWidth: 3px per penalty, playerSpeed: 5px/s per penalty
      const firewallCount = Math.round(penalties.spawnRate / 50);
      const gapCount = Math.round(penalties.gapWidth / 3);
      const speedCount = Math.round(penalties.playerSpeed / 5);
      this.difficultyStatsText.text = `FIREWALL: ${firewallCount} | GAP: ${gapCount} | SPEED: ${speedCount}`;
    }
  }

  /**
   * Update the difficulty popup fade animation.
   */
  private updateDifficultyPopupFade(deltaMs: number): void {
    if (!this.difficultyPopupFading || !this.difficultyPopupText) {
      return;
    }

    this.difficultyPopupFadeTimer += deltaMs;
    const progress = Math.min(1, this.difficultyPopupFadeTimer / DIFFICULTY_POPUP_FADE_MS);
    this.difficultyPopupText.alpha = 1 - progress;

    if (progress >= 1) {
      this.difficultyPopupFading = false;
      this.difficultyPopupText.alpha = 0;
    }
  }

  /**
   * Show a difficulty popup message based on the difficulty type.
   */
  private showDifficultyPopup(difficultyType: DifficultyType): void {
    if (!this.difficultyPopupText) {
      return;
    }

    const messages = DIFFICULTY_MESSAGES[difficultyType];
    const message = messages[Math.floor(Math.random() * messages.length)]!;

    this.difficultyPopupText.text = message;
    this.difficultyPopupText.alpha = 1;
    this.difficultyPopupFadeTimer = 0;
    this.difficultyPopupFading = true;
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

    // Handle obstacle passed - show difficulty popup
    const unsubObstaclePassed = this.minigame.on('obstacle-passed' as 'end', (payload) => {
      const data = payload.data as { wallsPassed: number; difficultyType: DifficultyType };
      this.showDifficultyPopup(data.difficultyType);
    });
    this.unsubscribers.push(unsubObstaclePassed);
  }

  /**
   * Handle game completion.
   */
  private handleGameEnd(): void {
    if (!this.minigame) {return;}

    this.showingResults = true;

    // Get final stats
    const stats = this.minigame.getFinalStats();
    const wallsPassed = this.minigame.wallsPassed;
    const moneyReward = this.minigame.calculateMoneyReward();

    // Record score and award resources
    const state = this.game.store.getState();
    state.ensureMinigameState('code-runner');
    state.recordScore('code-runner', String(wallsPassed));
    state.incrementPlayCount('code-runner');
    state.addResource('money', moneyReward);
    state.trackResourceEarned('money', moneyReward);

    // Emit completion event
    this.game.eventBus.emit(GameEvents.MINIGAME_COMPLETED, {
      minigameId: 'code-runner',
      score: wallsPassed,
      maxCombo: stats.maxCombo,
      durationMs: stats.durationMs,
      rewards: { money: moneyReward },
      isNewTopScore: this.isNewTopScore(wallsPassed),
    });

    // Show results overlay
    this.showResultsOverlay(wallsPassed, moneyReward);
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
  private showResultsOverlay(wallsPassed: number, moneyReward: string): void {
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

    // Walls passed label
    const wallsLabel = new Text({
      text: 'WALLS PASSED',
      style: terminalDimStyle,
    });
    wallsLabel.anchor.set(0.5, 0);
    wallsLabel.x = width / 2;
    wallsLabel.y = boxY + 70;
    this.resultsOverlay.addChild(wallsLabel);

    // Walls passed value
    const wallsValue = new Text({
      text: wallsPassed.toString(),
      style: scoreStyle,
    });
    wallsValue.anchor.set(0.5, 0);
    wallsValue.x = width / 2;
    wallsValue.y = boxY + 95;
    this.resultsOverlay.addChild(wallsValue);

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
      text: 'Press ENTER for menu or ESC to exit',
      style: terminalDimStyle,
    });
    instructions.anchor.set(0.5, 0);
    instructions.x = width / 2;
    instructions.y = boxY + boxHeight - 40;
    this.resultsOverlay.addChild(instructions);

    this.container.addChild(this.resultsOverlay);
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
      // Return to interstitial menu
      const interstitialSceneId = `minigame-interstitial-${this.id}`;
      this.game.sceneManager.register(
        interstitialSceneId,
        () => createMinigameInterstitialScene(this.game, this.id)
      );
      void this.game.switchScene(interstitialSceneId);
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
