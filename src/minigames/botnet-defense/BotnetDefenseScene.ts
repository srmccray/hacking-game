/**
 * Botnet Defense Scene
 *
 * PixiJS scene for the Botnet Defense minigame. Handles:
 * - Visual rendering of player (green triangle), enemies (colored circles),
 *   projectiles (small shapes), and XP gems (cyan dots)
 * - HUD with HP bar, kill count, timer (MM:SS), score, and XP bar
 * - Input context registration for WASD + arrow keys with held-key polling
 * - Results overlay on game end
 *
 * Visual Layout:
 * +---------------------------------------------------+
 * | HP: #####  KILLS: 12  TIME: 02:45  SCORE: 340     |
 * | XP: [========          ] LVL 3                     |
 * +---------------------------------------------------+
 * |                                                     |
 * |   (enemies)        /\          (projectiles)        |
 * |                   player                            |
 * |          (xp gems)                                  |
 * |                                                     |
 * +---------------------------------------------------+
 * |  WASD or arrows to move | ESC to exit               |
 * +---------------------------------------------------+
 *
 * All entities are rendered as Graphics primitives (NOT Text) for performance
 * with 50+ entities on screen. Entity display objects are tracked by
 * Map<entityId, Graphics> for efficient add/update/remove.
 *
 * Usage:
 *   const scene = createBotnetDefenseScene(game);
 *   sceneManager.register('botnet-defense', () => scene);
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene, GameInstance } from '../../core/types';
import type { Game } from '../../game/Game';
import type { InputContext } from '../../input/InputManager';
import { INPUT_PRIORITY } from '../../input/InputManager';
import { BotnetDefenseGame } from './BotnetDefenseGame';
import type { BotnetDefenseState, Enemy, Projectile, XPGem } from './types';
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
import { formatTimeMMSS } from '../BaseMinigame';
import { createMinigameInterstitialScene } from '../../scenes/minigame-interstitial';

// ============================================================================
// Configuration
// ============================================================================

/** Layout constants */
const LAYOUT = {
  /** Padding from edges */
  PADDING: 20,
  /** Height reserved for the HUD above the game area */
  HUD_HEIGHT: 60,
  /** Height reserved for the instructions bar below game area */
  INSTRUCTIONS_HEIGHT: 30,
  /** Player triangle size (radius from center to vertex) */
  PLAYER_TRIANGLE_SIZE: 12,
  /** I-frame blink interval in milliseconds */
  IFRAME_BLINK_INTERVAL_MS: 100,
} as const;

/** Enemy type colors */
const ENEMY_COLORS: Record<string, number> = {
  virus: 0x44ff44,
  worm: 0xffff00,
  trojan: 0xff4444,
  ransomware: 0xff44ff,
};

/** Projectile color */
const PROJECTILE_COLOR = 0x44ff44;

/** XP gem color */
const XP_GEM_COLOR = 0x00ffff;

/** Player color */
const PLAYER_COLOR = 0x44ff44;

/** HP bar heart color */
const HP_FULL_COLOR = 0xff4444;
const HP_EMPTY_COLOR = 0x442222;

/** XP bar style */
const xpBarStyle = new TextStyle({
  fontFamily: FONT_FAMILY,
  fontSize: FONT_SIZES.SMALL,
  fill: COLORS.TERMINAL_CYAN,
});

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Botnet Defense scene implementation.
 */
class BotnetDefenseScene implements Scene {
  readonly id = 'botnet-defense';

  /** The PixiJS container for this scene */
  private readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** The Botnet Defense game logic */
  private minigame: BotnetDefenseGame | null = null;

  /** Input context for this scene */
  private inputContext: InputContext | null = null;

  /** Whether results overlay is showing */
  private showingResults: boolean = false;

  // --------------------------------------------------------------------------
  // UI Elements
  // --------------------------------------------------------------------------

  /** Game area container (masked to arena bounds) */
  private gameArea: Container | null = null;

  /** Player Graphics object */
  private playerGraphic: Graphics | null = null;

  /** Entity display object maps for efficient add/update/remove */
  private readonly enemyGraphicsById: Map<number, Graphics> = new Map();
  private readonly projectileGraphicsById: Map<number, Graphics> = new Map();
  private readonly xpGemGraphicsById: Map<number, Graphics> = new Map();

  // HUD Text objects
  private hpGraphics: Graphics | null = null;
  private killsText: Text | null = null;
  private timerText: Text | null = null;
  private scoreText: Text | null = null;
  private xpBarGraphics: Graphics | null = null;
  private xpLevelText: Text | null = null;

  /** Results overlay container */
  private resultsOverlay: Container | null = null;

  /** Event unsubscribers */
  private unsubscribers: Array<() => void> = [];

  /** I-frame blink timer for toggling player visibility */
  private iframeBlinkTimer: number = 0;

  /** Offset for positioning the game area within the scene */
  private gameAreaOffsetX: number = 0;
  private gameAreaOffsetY: number = 0;

  constructor(game: Game) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'botnet-defense-scene';
  }

  // ==========================================================================
  // Scene Lifecycle
  // ==========================================================================

  getContainer(): Container {
    return this.container;
  }

  onEnter(): void {
    console.log('[BotnetDefenseScene] Entering scene');

    // Create UI
    this.createUI();

    // Create minigame instance
    const config = (this.game.config as { minigames: { botnetDefense: unknown } }).minigames.botnetDefense;
    this.minigame = new BotnetDefenseGame(config as import('../../game/GameConfig').BotnetDefenseConfig);

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
    console.log('[BotnetDefenseScene] Exiting scene');

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

    // Poll held keys for continuous movement input
    this.pollMovementInput();

    // Update minigame logic
    this.minigame.update(deltaMs);

    // Update i-frame blink timer
    this.iframeBlinkTimer += deltaMs;

    // Update display
    this.updateDisplay();
  }

  onDestroy(): void {
    console.log('[BotnetDefenseScene] Destroying scene');

    // Unregister input context
    if (this.inputContext) {
      this.game.inputManager.unregisterContext(this.inputContext.id);
    }

    // Destroy minigame
    if (this.minigame) {
      this.minigame.destroy();
      this.minigame = null;
    }

    // Clear entity maps
    this.enemyGraphicsById.clear();
    this.projectileGraphicsById.clear();
    this.xpGemGraphicsById.clear();

    // Clear UI references
    this.playerGraphic = null;
    this.gameArea = null;
    this.hpGraphics = null;
    this.killsText = null;
    this.timerText = null;
    this.scoreText = null;
    this.xpBarGraphics = null;
    this.xpLevelText = null;
    this.resultsOverlay = null;

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
    const canvasWidth = (this.game.config as { canvas: { width: number; height: number } }).canvas.width;
    const canvasHeight = (this.game.config as { canvas: { width: number; height: number } }).canvas.height;
    const config = (this.game.config as { minigames: { botnetDefense: { arenaWidth: number; arenaHeight: number } } }).minigames.botnetDefense;
    const arenaWidth = config.arenaWidth;
    const arenaHeight = config.arenaHeight;

    // Center the game area horizontally
    this.gameAreaOffsetX = Math.floor((canvasWidth - arenaWidth) / 2);
    this.gameAreaOffsetY = LAYOUT.PADDING + LAYOUT.HUD_HEIGHT;

    // Background
    this.createBackground(canvasWidth, canvasHeight);

    // HUD (above game area)
    this.createHUD(canvasWidth);

    // Game area (with mask for clipping entities)
    this.createGameArea(arenaWidth, arenaHeight);

    // Instructions (below game area)
    this.createInstructions(
      canvasWidth / 2,
      this.gameAreaOffsetY + arenaHeight + 10
    );
  }

  /**
   * Create background and border.
   */
  private createBackground(width: number, height: number): void {
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: COLORS.BACKGROUND, alpha: 0.95 });
    this.container.addChild(bg);

    // Border around the entire scene
    const border = new Graphics();
    border.rect(
      LAYOUT.PADDING / 2,
      LAYOUT.PADDING / 2,
      width - LAYOUT.PADDING,
      height - LAYOUT.PADDING
    );
    border.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });
    this.container.addChild(border);
  }

  /**
   * Create the HUD above the game area.
   */
  private createHUD(canvasWidth: number): void {
    const hudContainer = new Container();
    hudContainer.label = 'hud';

    const hudY = LAYOUT.PADDING + 8;
    const leftX = LAYOUT.PADDING + 10;

    // HP label
    const hpLabel = new Text({
      text: 'HP:',
      style: terminalDimStyle,
    });
    hpLabel.anchor.set(0, 0.5);
    hpLabel.x = leftX;
    hpLabel.y = hudY;
    hudContainer.addChild(hpLabel);

    // HP bar (drawn as Graphics hearts/blocks)
    this.hpGraphics = new Graphics();
    this.hpGraphics.x = leftX + 40;
    this.hpGraphics.y = hudY;
    hudContainer.addChild(this.hpGraphics);

    // Kills label
    const killsLabel = new Text({
      text: 'KILLS:',
      style: terminalDimStyle,
    });
    killsLabel.anchor.set(0, 0.5);
    killsLabel.x = leftX + 180;
    killsLabel.y = hudY;
    hudContainer.addChild(killsLabel);

    // Kills value
    this.killsText = new Text({
      text: '0',
      style: scoreStyle,
    });
    this.killsText.anchor.set(0, 0.5);
    this.killsText.x = leftX + 250;
    this.killsText.y = hudY;
    hudContainer.addChild(this.killsText);

    // Timer label
    const timerLabel = new Text({
      text: 'TIME:',
      style: terminalDimStyle,
    });
    timerLabel.anchor.set(0, 0.5);
    timerLabel.x = leftX + 340;
    timerLabel.y = hudY;
    hudContainer.addChild(timerLabel);

    // Timer value
    this.timerText = new Text({
      text: '03:00',
      style: terminalBrightStyle,
    });
    this.timerText.anchor.set(0, 0.5);
    this.timerText.x = leftX + 400;
    this.timerText.y = hudY;
    hudContainer.addChild(this.timerText);

    // Score label
    const scoreLabel = new Text({
      text: 'SCORE:',
      style: terminalDimStyle,
    });
    scoreLabel.anchor.set(0, 0.5);
    scoreLabel.x = leftX + 520;
    scoreLabel.y = hudY;
    hudContainer.addChild(scoreLabel);

    // Score value
    this.scoreText = new Text({
      text: '0',
      style: scoreStyle,
    });
    this.scoreText.anchor.set(0, 0.5);
    this.scoreText.x = leftX + 600;
    this.scoreText.y = hudY;
    hudContainer.addChild(this.scoreText);

    // XP bar row (second row)
    const xpY = hudY + 26;

    const xpLabel = new Text({
      text: 'XP:',
      style: xpBarStyle,
    });
    xpLabel.anchor.set(0, 0.5);
    xpLabel.x = leftX;
    xpLabel.y = xpY;
    hudContainer.addChild(xpLabel);

    // XP bar (drawn as Graphics)
    this.xpBarGraphics = new Graphics();
    this.xpBarGraphics.x = leftX + 30;
    this.xpBarGraphics.y = xpY;
    hudContainer.addChild(this.xpBarGraphics);

    // XP level text
    this.xpLevelText = new Text({
      text: 'LVL 1',
      style: xpBarStyle,
    });
    this.xpLevelText.anchor.set(0, 0.5);
    this.xpLevelText.x = leftX + 250;
    this.xpLevelText.y = xpY;
    hudContainer.addChild(this.xpLevelText);

    // Divider line between HUD and game area
    const divider = new Graphics();
    divider.moveTo(LAYOUT.PADDING, this.gameAreaOffsetY - 4);
    divider.lineTo(canvasWidth - LAYOUT.PADDING, this.gameAreaOffsetY - 4);
    divider.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.5 });
    hudContainer.addChild(divider);

    this.container.addChild(hudContainer);
  }

  /**
   * Create the game area container with masking.
   */
  private createGameArea(arenaWidth: number, arenaHeight: number): void {
    this.gameArea = new Container();
    this.gameArea.label = 'game-area';
    this.gameArea.x = this.gameAreaOffsetX;
    this.gameArea.y = this.gameAreaOffsetY;

    // Arena background (slightly lighter than scene background)
    const arenaBg = new Graphics();
    arenaBg.rect(0, 0, arenaWidth, arenaHeight);
    arenaBg.fill({ color: 0x0d0d0d });
    this.gameArea.addChild(arenaBg);

    // Arena border
    const arenaBorder = new Graphics();
    arenaBorder.rect(0, 0, arenaWidth, arenaHeight);
    arenaBorder.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.5 });
    this.gameArea.addChild(arenaBorder);

    // Mask to clip entities at arena boundaries
    const maskGraphic = new Graphics();
    maskGraphic.rect(this.gameAreaOffsetX, this.gameAreaOffsetY, arenaWidth, arenaHeight);
    maskGraphic.fill({ color: 0xffffff });
    this.container.addChild(maskGraphic);
    this.gameArea.mask = maskGraphic;

    // Create player graphic
    this.playerGraphic = new Graphics();
    this.drawPlayerTriangle(1, 0); // Default facing right
    this.gameArea.addChild(this.playerGraphic);

    this.container.addChild(this.gameArea);
  }

  /**
   * Draw the player triangle pointing in the facing direction.
   */
  private drawPlayerTriangle(facingX: number, facingY: number): void {
    if (!this.playerGraphic) {
      return;
    }

    const size = LAYOUT.PLAYER_TRIANGLE_SIZE;
    this.playerGraphic.clear();

    // Calculate angle from facing direction
    let angle: number;
    if (facingX === 0 && facingY === 0) {
      angle = 0; // Default: facing right
    } else {
      angle = Math.atan2(facingY, facingX);
    }

    // Triangle vertices: tip points in facing direction
    // Tip vertex
    const tipX = Math.cos(angle) * size;
    const tipY = Math.sin(angle) * size;

    // Base vertices (perpendicular to facing, behind)
    const baseAngle = angle + Math.PI;
    const spreadAngle = Math.PI * 0.35;
    const baseX1 = Math.cos(baseAngle + spreadAngle) * size * 0.7;
    const baseY1 = Math.sin(baseAngle + spreadAngle) * size * 0.7;
    const baseX2 = Math.cos(baseAngle - spreadAngle) * size * 0.7;
    const baseY2 = Math.sin(baseAngle - spreadAngle) * size * 0.7;

    this.playerGraphic.moveTo(tipX, tipY);
    this.playerGraphic.lineTo(baseX1, baseY1);
    this.playerGraphic.lineTo(baseX2, baseY2);
    this.playerGraphic.closePath();

    this.playerGraphic.fill({ color: PLAYER_COLOR, alpha: 0.7 });
    this.playerGraphic.stroke({ color: COLORS.TERMINAL_BRIGHT, width: 2 });
  }

  /**
   * Create instruction text below the game area.
   */
  private createInstructions(centerX: number, y: number): void {
    const statusText = new Text({
      text: 'WASD or \u2190\u2191\u2192\u2193 to move | [ESC] Exit',
      style: terminalDimStyle,
    });
    statusText.anchor.set(0.5, 0);
    statusText.x = centerX;
    statusText.y = y;
    this.container.addChild(statusText);
  }

  // ==========================================================================
  // Display Updates
  // ==========================================================================

  /**
   * Update all display elements based on game state.
   */
  private updateDisplay(): void {
    if (!this.minigame) {
      return;
    }

    const state = this.minigame.getState();

    this.updatePlayer(state);
    this.updateEnemies(state.enemies);
    this.updateProjectiles(state.projectiles);
    this.updateXPGems(state.xpGems);
    this.updateHUD(state);
  }

  /**
   * Update the player position and i-frame blinking.
   */
  private updatePlayer(state: BotnetDefenseState): void {
    if (!this.playerGraphic) {
      return;
    }

    const player = state.player;

    // Update position
    this.playerGraphic.x = player.x;
    this.playerGraphic.y = player.y;

    // Redraw triangle pointing in facing direction
    this.drawPlayerTriangle(player.facingX, player.facingY);
    // Re-apply position after clear+redraw
    this.playerGraphic.x = player.x;
    this.playerGraphic.y = player.y;

    // I-frame blink: toggle visibility every IFRAME_BLINK_INTERVAL_MS
    if (player.iFramesRemaining > 0) {
      const blinkCycle = Math.floor(this.iframeBlinkTimer / LAYOUT.IFRAME_BLINK_INTERVAL_MS);
      this.playerGraphic.visible = blinkCycle % 2 === 0;
    } else {
      this.playerGraphic.visible = true;
    }
  }

  /**
   * Update enemy Graphics objects. Creates new Graphics for new enemies,
   * updates positions for existing ones, and removes inactive ones.
   */
  private updateEnemies(enemies: Enemy[]): void {
    if (!this.gameArea) {
      return;
    }

    // Build set of current enemy IDs
    const currentIds = new Set(enemies.map((e) => e.id));

    // Remove Graphics for enemies that no longer exist
    for (const [id, graphic] of this.enemyGraphicsById) {
      if (!currentIds.has(id)) {
        this.gameArea.removeChild(graphic);
        graphic.destroy();
        this.enemyGraphicsById.delete(id);
      }
    }

    // Add or update enemy Graphics
    for (const enemy of enemies) {
      let graphic = this.enemyGraphicsById.get(enemy.id);

      if (!graphic) {
        // Create new Graphics for this enemy
        graphic = new Graphics();
        const color = ENEMY_COLORS[enemy.type] ?? 0x44ff44;
        graphic.circle(0, 0, enemy.radius);
        graphic.fill({ color, alpha: 0.8 });
        graphic.stroke({ color, width: 1, alpha: 0.4 });
        this.enemyGraphicsById.set(enemy.id, graphic);
        // Insert below player (player added last, so index 2 = after bg + border)
        this.gameArea.addChildAt(graphic, 2);
      }

      // Update position
      graphic.x = enemy.x;
      graphic.y = enemy.y;
    }
  }

  /**
   * Update projectile Graphics objects.
   */
  private updateProjectiles(projectiles: Projectile[]): void {
    if (!this.gameArea) {
      return;
    }

    const currentIds = new Set(projectiles.map((p) => p.id));

    // Remove Graphics for projectiles that no longer exist
    for (const [id, graphic] of this.projectileGraphicsById) {
      if (!currentIds.has(id)) {
        this.gameArea.removeChild(graphic);
        graphic.destroy();
        this.projectileGraphicsById.delete(id);
      }
    }

    // Add or update projectile Graphics
    for (const proj of projectiles) {
      let graphic = this.projectileGraphicsById.get(proj.id);

      if (!graphic) {
        graphic = new Graphics();
        // Small bright rectangle for projectiles
        graphic.rect(-2, -2, 4, 4);
        graphic.fill({ color: PROJECTILE_COLOR });
        this.projectileGraphicsById.set(proj.id, graphic);
        this.gameArea.addChildAt(graphic, 2);
      }

      graphic.x = proj.x;
      graphic.y = proj.y;
    }
  }

  /**
   * Update XP gem Graphics objects.
   */
  private updateXPGems(xpGems: XPGem[]): void {
    if (!this.gameArea) {
      return;
    }

    const currentIds = new Set(xpGems.map((g) => g.id));

    // Remove Graphics for gems that no longer exist
    for (const [id, graphic] of this.xpGemGraphicsById) {
      if (!currentIds.has(id)) {
        this.gameArea.removeChild(graphic);
        graphic.destroy();
        this.xpGemGraphicsById.delete(id);
      }
    }

    // Add or update XP gem Graphics
    for (const gem of xpGems) {
      let graphic = this.xpGemGraphicsById.get(gem.id);

      if (!graphic) {
        graphic = new Graphics();
        graphic.circle(0, 0, gem.radius);
        graphic.fill({ color: XP_GEM_COLOR, alpha: 0.9 });
        this.xpGemGraphicsById.set(gem.id, graphic);
        this.gameArea.addChildAt(graphic, 2);
      }

      graphic.x = gem.x;
      graphic.y = gem.y;
    }
  }

  /**
   * Update the HUD display with current game state.
   */
  private updateHUD(state: BotnetDefenseState): void {
    // Update HP bar
    if (this.hpGraphics) {
      this.hpGraphics.clear();
      const blockSize = 14;
      const spacing = 3;
      for (let i = 0; i < state.player.maxHp; i++) {
        const color = i < state.player.hp ? HP_FULL_COLOR : HP_EMPTY_COLOR;
        this.hpGraphics.rect(
          i * (blockSize + spacing) - blockSize / 2,
          -blockSize / 2,
          blockSize,
          blockSize
        );
        this.hpGraphics.fill({ color });
      }
    }

    // Update kills
    if (this.killsText) {
      this.killsText.text = state.kills.toString();
    }

    // Update timer
    if (this.timerText && this.minigame) {
      this.timerText.text = formatTimeMMSS(this.minigame.timeRemainingMs);

      // Flash red when low on time
      if (this.minigame.timeRemainingMs <= 10000) {
        this.timerText.style.fill = COLORS.TERMINAL_RED;
      } else {
        this.timerText.style.fill = COLORS.TERMINAL_BRIGHT;
      }
    }

    // Update score
    if (this.scoreText && this.minigame) {
      this.scoreText.text = this.minigame.score.toString();
    }

    // Update XP bar
    if (this.xpBarGraphics) {
      this.xpBarGraphics.clear();
      const barWidth = 200;
      const barHeight = 10;

      // Background
      this.xpBarGraphics.rect(0, -barHeight / 2, barWidth, barHeight);
      this.xpBarGraphics.fill({ color: 0x003333 });

      // Fill based on XP progress
      const xpProgress = state.xpToNextLevel > 0
        ? Math.min(1, state.currentXP / state.xpToNextLevel)
        : 0;
      if (xpProgress > 0) {
        this.xpBarGraphics.rect(0, -barHeight / 2, barWidth * xpProgress, barHeight);
        this.xpBarGraphics.fill({ color: XP_GEM_COLOR });
      }

      // Border
      this.xpBarGraphics.rect(0, -barHeight / 2, barWidth, barHeight);
      this.xpBarGraphics.stroke({ color: COLORS.TERMINAL_CYAN, width: 1, alpha: 0.5 });
    }

    // Update XP level text
    if (this.xpLevelText) {
      this.xpLevelText.text = `LVL ${state.level}`;
    }
  }

  // ==========================================================================
  // Minigame Event Handlers
  // ==========================================================================

  /**
   * Set up listeners for minigame events.
   */
  private setupMinigameListeners(): void {
    if (!this.minigame) {
      return;
    }

    // Handle game end
    const unsubEnd = this.minigame.on('end', () => {
      this.handleGameEnd();
    });
    this.unsubscribers.push(unsubEnd);
  }

  /**
   * Handle game completion (time up or player death).
   */
  private handleGameEnd(): void {
    if (!this.minigame) {
      return;
    }

    this.showingResults = true;

    // Get final stats
    const stats = this.minigame.getFinalStats();
    const gameState = this.minigame.getState();
    const moneyReward = this.minigame.calculateMoneyReward();
    const score = this.minigame.score;

    // Record score and award resources
    const storeState = this.game.store.getState();
    storeState.ensureMinigameState('botnet-defense');
    storeState.recordScore('botnet-defense', String(score));
    storeState.incrementPlayCount('botnet-defense');
    storeState.addResource('money', moneyReward);
    storeState.trackResourceEarned('money', moneyReward);

    // Emit completion event
    this.game.eventBus.emit(GameEvents.MINIGAME_COMPLETED, {
      minigameId: 'botnet-defense',
      score: score,
      maxCombo: stats.maxCombo,
      durationMs: stats.durationMs,
      rewards: { money: moneyReward },
      isNewTopScore: this.isNewTopScore(score),
    });

    // Show results overlay
    this.showResultsOverlay(gameState, stats, moneyReward);
  }

  /**
   * Check if score qualifies as a new top score.
   */
  private isNewTopScore(score: number): boolean {
    const minigameState = this.game.store.getState().minigames['botnet-defense'];
    if (!minigameState) {
      return true;
    }

    const topScores = minigameState.topScores;
    if (topScores.length < 5) {
      return true;
    }

    const lowestTop = Number(topScores[topScores.length - 1] ?? 0);
    return score > lowestTop;
  }

  /**
   * Show the results overlay with game stats.
   */
  private showResultsOverlay(
    gameState: BotnetDefenseState,
    stats: { score: number; durationMs: number; successCount: number; failCount: number },
    moneyReward: string,
  ): void {
    const canvasWidth = (this.game.config as { canvas: { width: number; height: number } }).canvas.width;
    const canvasHeight = (this.game.config as { canvas: { width: number; height: number } }).canvas.height;

    this.resultsOverlay = new Container();
    this.resultsOverlay.label = 'results-overlay';

    // Semi-transparent dark background
    const bg = new Graphics();
    bg.rect(0, 0, canvasWidth, canvasHeight);
    bg.fill({ color: 0x000000, alpha: 0.85 });
    this.resultsOverlay.addChild(bg);

    // Results box
    const boxWidth = 440;
    const boxHeight = 340;
    const boxX = (canvasWidth - boxWidth) / 2;
    const boxY = (canvasHeight - boxHeight) / 2;

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

    // Title - player death vs time up
    const isDead = gameState.player.hp <= 0;
    const titleText = isDead ? 'SYSTEM COMPROMISED' : "TIME'S UP";
    const title = new Text({
      text: titleText,
      style: titleStyle,
    });
    title.anchor.set(0.5, 0);
    title.x = canvasWidth / 2;
    title.y = boxY + 20;
    this.resultsOverlay.addChild(title);

    // Stats
    const statsStartY = boxY + 75;
    const statsLineHeight = 30;
    const statsX = canvasWidth / 2;

    const statLines = [
      `KILLS: ${gameState.kills}`,
      `SURVIVAL TIME: ${formatTimeMMSS(stats.durationMs)}`,
      `LEVEL REACHED: ${gameState.level}`,
      `SCORE: ${stats.score}`,
      `MONEY EARNED: $${moneyReward}`,
    ];

    for (let i = 0; i < statLines.length; i++) {
      const isMoneyLine = i === statLines.length - 1;
      const stat = new Text({
        text: statLines[i]!,
        style: isMoneyLine ? terminalBrightStyle : terminalDimStyle,
      });
      stat.anchor.set(0.5, 0);
      stat.x = statsX;
      stat.y = statsStartY + i * statsLineHeight;
      this.resultsOverlay.addChild(stat);
    }

    // Instructions
    const instructions = new Text({
      text: 'Press ENTER for menu or ESC to exit',
      style: terminalDimStyle,
    });
    instructions.anchor.set(0.5, 0);
    instructions.x = canvasWidth / 2;
    instructions.y = boxY + boxHeight - 40;
    this.resultsOverlay.addChild(instructions);

    this.container.addChild(this.resultsOverlay);
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Register the input context for this scene.
   * Uses WASD + arrow keys for 8-directional movement.
   * Actual movement is polled via isKeyHeld in onUpdate, but we still
   * register bindings so the InputManager knows which keys we care about.
   */
  private registerInputContext(): void {
    const bindings = new Map<string, { onPress?: () => void; onRelease?: () => void }>();

    // Movement keys - we register them but rely on held-key polling
    // in onUpdate for continuous movement. The bindings ensure
    // the InputManager tracks these keys and blocks propagation.
    const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    for (const key of movementKeys) {
      bindings.set(key, {});
    }

    // Escape to exit
    bindings.set('Escape', {
      onPress: () => this.handleEscape(),
    });

    // Enter to continue from results
    bindings.set('Enter', {
      onPress: () => this.handleEnter(),
    });

    this.inputContext = {
      id: 'botnet-defense',
      priority: INPUT_PRIORITY.SCENE,
      enabled: true,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('botnet-defense');
  }

  /**
   * Poll held keys each frame and feed input to the game.
   * This provides smooth continuous movement instead of discrete press/release.
   */
  private pollMovementInput(): void {
    if (!this.minigame?.isPlaying) {
      return;
    }

    const im = this.game.inputManager;

    const left = im.isAnyKeyHeld(['KeyA', 'ArrowLeft']);
    const right = im.isAnyKeyHeld(['KeyD', 'ArrowRight']);
    const up = im.isAnyKeyHeld(['KeyW', 'ArrowUp']);
    const down = im.isAnyKeyHeld(['KeyS', 'ArrowDown']);

    this.minigame.setInput({ left, right, up, down });
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
 * Create a new Botnet Defense scene.
 *
 * @param game - The game instance
 * @returns A new BotnetDefenseScene
 */
export function createBotnetDefenseScene(game: GameInstance): Scene {
  return new BotnetDefenseScene(game as Game);
}
