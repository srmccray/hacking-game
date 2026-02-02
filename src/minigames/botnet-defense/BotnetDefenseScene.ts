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
import type { BotnetDefenseState, Enemy, Projectile, XPGem, UpgradeChoice } from './types';
import { COLORS } from '../../rendering/Renderer';
import {
  terminalDimStyle,
  terminalBrightStyle,
  titleStyle,
  scoreStyle,
  FONT_FAMILY,
  FONT_SIZES,
  createTerminalStyle,
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

/** Projectile colors by weapon type */
const PROJECTILE_COLOR = 0x44ff44;
const FIREWALL_COLOR = 0xff8800;
const PORT_SCANNER_COLOR = 0x4488ff;
const EXPLOIT_COLOR = 0xff44ff;

/** XP gem color */
const XP_GEM_COLOR = 0x00ffff;

/** Player color */
const PLAYER_COLOR = 0x44ff44;

/** Player damage flash color */
const PLAYER_DAMAGE_FLASH_COLOR = 0xff4444;

/** Duration of death effect in ms */
const DEATH_EFFECT_DURATION_MS = 300;

/** Duration of player damage flash in ms */
const DAMAGE_FLASH_DURATION_MS = 200;

/** Duration of level-up screen flash in ms */
const LEVEL_UP_FLASH_DURATION_MS = 200;

/** Number of particles in a death burst */
const DEATH_PARTICLE_COUNT = 4;

/** Death particle max spread speed in pixels per second */
const DEATH_PARTICLE_SPEED = 120;

/** XP gem attraction line alpha */
const GEM_LINE_ALPHA = 0.15;

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

  /** Level-up overlay container */
  private levelUpOverlay: Container | null = null;

  /** Whether the level-up overlay is currently showing */
  private showingLevelUp: boolean = false;

  /** Currently highlighted card index (0, 1, or 2) for arrow key navigation */
  private levelUpSelectedIndex: number = 0;

  /** Graphics objects for the card highlight borders, used for selection feedback */
  private cardBorders: Graphics[] = [];

  /** Event unsubscribers */
  private unsubscribers: Array<() => void> = [];

  /** I-frame blink timer for toggling player visibility */
  private iframeBlinkTimer: number = 0;

  /** Offset for positioning the game area within the scene */
  private gameAreaOffsetX: number = 0;
  private gameAreaOffsetY: number = 0;

  // --------------------------------------------------------------------------
  // Visual Effect State
  // --------------------------------------------------------------------------

  /** Active death effect animations */
  private deathEffects: { container: Container; startTime: number; particles: { g: Graphics; vx: number; vy: number }[] }[] = [];

  /** Timestamp when the current game session started (for death effect timing) */
  private elapsedMs: number = 0;

  /** Remaining time for the player damage flash effect */
  private damageFlashRemaining: number = 0;

  /** Shared Graphics object for drawing XP gem attraction lines */
  private gemLineGraphics: Graphics | null = null;

  /** Remaining time for the level-up screen flash effect */
  private levelUpFlashRemaining: number = 0;

  /** Graphics overlay for the level-up screen flash */
  private levelUpFlashGraphic: Graphics | null = null;

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

    // Check if the game logic has triggered a level-up that we haven't shown yet
    const state = this.minigame.getState();
    if (state.isLevelingUp && !this.showingLevelUp) {
      this.showLevelUpOverlay(state.upgradeChoices, state.level);
      return;
    }

    // Don't process game updates while level-up overlay is active
    if (this.showingLevelUp) {
      return;
    }

    // Poll held keys for continuous movement input
    this.pollMovementInput();

    // Snapshot HP before game update so we can detect damage
    const hpBefore = this.minigame.getState().player.hp;

    // Update minigame logic
    this.minigame.update(deltaMs);

    // Update elapsed time for death effects
    this.elapsedMs += deltaMs;

    // Update i-frame blink timer
    this.iframeBlinkTimer += deltaMs;

    // Detect player damage (HP decreased this frame)
    const hpAfter = this.minigame.getState().player.hp;
    if (hpAfter < hpBefore) {
      this.damageFlashRemaining = DAMAGE_FLASH_DURATION_MS;
    }

    // Tick damage flash timer
    if (this.damageFlashRemaining > 0) {
      this.damageFlashRemaining = Math.max(0, this.damageFlashRemaining - deltaMs);
    }

    // Tick level-up screen flash
    if (this.levelUpFlashRemaining > 0) {
      this.levelUpFlashRemaining = Math.max(0, this.levelUpFlashRemaining - deltaMs);
      this.updateLevelUpFlash();
    }

    // Update display
    this.updateDisplay();

    // Update visual effects (death animations, gem lines)
    this.updateDeathEffects(deltaMs);
    this.updateGemAttractionLines();
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

    // Clear death effects
    for (const effect of this.deathEffects) {
      effect.container.destroy({ children: true });
    }
    this.deathEffects = [];

    // Clear UI references
    this.gemLineGraphics = null;
    this.levelUpFlashGraphic = null;
    this.playerGraphic = null;
    this.gameArea = null;
    this.hpGraphics = null;
    this.killsText = null;
    this.timerText = null;
    this.scoreText = null;
    this.xpBarGraphics = null;
    this.xpLevelText = null;
    this.resultsOverlay = null;
    this.levelUpOverlay = null;
    this.cardBorders = [];

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

    // Create shared graphics for XP gem attraction lines (below player)
    this.gemLineGraphics = new Graphics();
    this.gameArea.addChild(this.gemLineGraphics);

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

    const playerColor = this.damageFlashRemaining > 0 ? PLAYER_DAMAGE_FLASH_COLOR : PLAYER_COLOR;
    this.playerGraphic.fill({ color: playerColor, alpha: 0.7 });
    this.playerGraphic.stroke({ color: this.damageFlashRemaining > 0 ? 0xff8888 : COLORS.TERMINAL_BRIGHT, width: 2 });
  }

  /**
   * Draw the initial shape of a projectile based on its weapon type.
   * - Ping: small bright square
   * - Firewall: rectangular barrier (orange)
   * - Port Scanner: expanding ring (drawn per-frame in updateProjectiles)
   * - Exploit: diamond/arrow shape (magenta)
   */
  private drawProjectileShape(graphic: Graphics, proj: Projectile): void {
    switch (proj.weaponType) {
      case 'firewall': {
        // Rectangular barrier
        graphic.rect(-12, -4, 24, 8);
        graphic.fill({ color: FIREWALL_COLOR, alpha: 0.8 });
        graphic.stroke({ color: FIREWALL_COLOR, width: 1, alpha: 0.5 });
        break;
      }
      case 'port-scanner': {
        // Initial ring (will be redrawn each frame)
        graphic.circle(0, 0, proj.radius);
        graphic.stroke({ color: PORT_SCANNER_COLOR, width: 2 });
        break;
      }
      case 'exploit': {
        // Diamond/arrow shape
        const s = 6;
        graphic.moveTo(s, 0);   // right tip
        graphic.lineTo(0, -s);  // top
        graphic.lineTo(-s, 0);  // left
        graphic.lineTo(0, s);   // bottom
        graphic.closePath();
        graphic.fill({ color: EXPLOIT_COLOR, alpha: 0.9 });
        graphic.stroke({ color: EXPLOIT_COLOR, width: 1, alpha: 0.5 });
        break;
      }
      default: {
        // Ping: small bright rectangle
        graphic.rect(-2, -2, 4, 4);
        graphic.fill({ color: PROJECTILE_COLOR });
        break;
      }
    }
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

    // Remove Graphics for enemies that no longer exist - spawn death effects
    for (const [id, graphic] of this.enemyGraphicsById) {
      if (!currentIds.has(id)) {
        // Spawn death effect at the enemy's last position
        this.spawnDeathEffect(graphic.x, graphic.y);
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
        this.drawProjectileShape(graphic, proj);
        this.projectileGraphicsById.set(proj.id, graphic);
        this.gameArea.addChildAt(graphic, 2);
      }

      // Port Scanner rings need to be redrawn each frame as radius expands
      if (proj.weaponType === 'port-scanner') {
        graphic.clear();
        const alpha = Math.max(0.1, proj.lifetime > 0 ? Math.min(1, proj.lifetime / 1000) : 0);
        graphic.circle(0, 0, proj.radius);
        graphic.stroke({ color: PORT_SCANNER_COLOR, width: 2, alpha });
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
  // Visual Effects
  // ==========================================================================

  /**
   * Spawn a death effect at the given position within the game area.
   * Creates a container with a white flash circle and scattered particle rectangles.
   */
  private spawnDeathEffect(x: number, y: number): void {
    if (!this.gameArea) {
      return;
    }

    const effectContainer = new Container();
    effectContainer.x = x;
    effectContainer.y = y;

    // White flash circle (will fade out)
    const flash = new Graphics();
    flash.circle(0, 0, 12);
    flash.fill({ color: 0xffffff, alpha: 0.8 });
    effectContainer.addChild(flash);

    // Scatter particles
    const particles: { g: Graphics; vx: number; vy: number }[] = [];
    for (let i = 0; i < DEATH_PARTICLE_COUNT; i++) {
      const angle = (Math.PI * 2 * i) / DEATH_PARTICLE_COUNT + Math.random() * 0.5;
      const speed = DEATH_PARTICLE_SPEED * (0.5 + Math.random() * 0.5);
      const particle = new Graphics();
      particle.rect(-2, -2, 4, 4);
      particle.fill({ color: 0xffffff });
      effectContainer.addChild(particle);
      particles.push({
        g: particle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }

    this.gameArea.addChild(effectContainer);
    this.deathEffects.push({
      container: effectContainer,
      startTime: this.elapsedMs,
      particles,
    });
  }

  /**
   * Tick all active death effects, animating particles outward and fading.
   * Removes expired effects after DEATH_EFFECT_DURATION_MS.
   */
  private updateDeathEffects(deltaMs: number): void {
    const deltaSec = deltaMs / 1000;

    for (let i = this.deathEffects.length - 1; i >= 0; i--) {
      const effect = this.deathEffects[i]!;
      const age = this.elapsedMs - effect.startTime;
      const progress = Math.min(1, age / DEATH_EFFECT_DURATION_MS);

      // Fade the entire container
      effect.container.alpha = 1 - progress;

      // Move particles outward
      for (const p of effect.particles) {
        p.g.x += p.vx * deltaSec;
        p.g.y += p.vy * deltaSec;
      }

      // Remove expired effects
      if (age >= DEATH_EFFECT_DURATION_MS) {
        if (this.gameArea) {
          this.gameArea.removeChild(effect.container);
        }
        effect.container.destroy({ children: true });
        this.deathEffects.splice(i, 1);
      }
    }
  }

  /**
   * Draw faint green lines from XP gems within pickup radius to the player.
   * Uses a shared Graphics object, cleared and redrawn each frame.
   */
  private updateGemAttractionLines(): void {
    if (!this.gemLineGraphics || !this.minigame) {
      return;
    }

    this.gemLineGraphics.clear();

    const state = this.minigame.getState();
    const player = state.player;
    const pickupRadius = player.pickupRadius;

    for (const gem of state.xpGems) {
      const dx = gem.x - player.x;
      const dy = gem.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < pickupRadius && dist > 10) {
        this.gemLineGraphics.moveTo(gem.x, gem.y);
        this.gemLineGraphics.lineTo(player.x, player.y);
        this.gemLineGraphics.stroke({ color: COLORS.TERMINAL_GREEN, width: 1, alpha: GEM_LINE_ALPHA });
      }
    }
  }

  /**
   * Update the level-up screen flash overlay. Creates the overlay on first call,
   * then fades it from alpha 0.3 to 0. Removes the overlay when finished.
   */
  private updateLevelUpFlash(): void {
    if (this.levelUpFlashRemaining <= 0) {
      // Remove the flash graphic if it exists
      if (this.levelUpFlashGraphic) {
        this.container.removeChild(this.levelUpFlashGraphic);
        this.levelUpFlashGraphic.destroy();
        this.levelUpFlashGraphic = null;
      }
      return;
    }

    const canvasWidth = (this.game.config as { canvas: { width: number; height: number } }).canvas.width;
    const canvasHeight = (this.game.config as { canvas: { width: number; height: number } }).canvas.height;

    // Create the flash overlay if it doesn't exist
    if (!this.levelUpFlashGraphic) {
      this.levelUpFlashGraphic = new Graphics();
      this.levelUpFlashGraphic.rect(0, 0, canvasWidth, canvasHeight);
      this.levelUpFlashGraphic.fill({ color: 0xffffff });
      this.container.addChild(this.levelUpFlashGraphic);
    }

    // Fade from 0.3 to 0 over the duration
    const progress = 1 - this.levelUpFlashRemaining / LEVEL_UP_FLASH_DURATION_MS;
    this.levelUpFlashGraphic.alpha = 0.3 * (1 - progress);
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
  // Level-Up Overlay
  // ==========================================================================

  /**
   * Show the level-up upgrade selection overlay.
   * Pauses visual updates and presents upgrade choice cards.
   *
   * @param choices - The upgrade choices to display (typically 3)
   * @param level - The new level the player just reached
   */
  private showLevelUpOverlay(choices: UpgradeChoice[], level: number): void {
    if (this.showingLevelUp) {
      return;
    }

    this.showingLevelUp = true;
    this.levelUpSelectedIndex = 0;
    this.cardBorders = [];

    // Trigger screen flash effect
    this.levelUpFlashRemaining = LEVEL_UP_FLASH_DURATION_MS;

    const canvasWidth = (this.game.config as { canvas: { width: number; height: number } }).canvas.width;
    const canvasHeight = (this.game.config as { canvas: { width: number; height: number } }).canvas.height;

    this.levelUpOverlay = new Container();
    this.levelUpOverlay.label = 'level-up-overlay';

    // Semi-transparent dark background covering the full scene
    const bg = new Graphics();
    bg.rect(0, 0, canvasWidth, canvasHeight);
    bg.fill({ color: 0x000000, alpha: 0.80 });
    this.levelUpOverlay.addChild(bg);

    // "LEVEL UP!" title in cyan with glow
    const levelUpTitle = new Text({
      text: '[ LEVEL UP! ]',
      style: createTerminalStyle(COLORS.TERMINAL_CYAN, FONT_SIZES.TITLE, true),
    });
    levelUpTitle.anchor.set(0.5, 0);
    levelUpTitle.x = canvasWidth / 2;
    levelUpTitle.y = 60;
    this.levelUpOverlay.addChild(levelUpTitle);

    // Level number subtitle
    const levelSubtitle = new Text({
      text: `LEVEL ${level}`,
      style: createTerminalStyle(COLORS.TERMINAL_GREEN, FONT_SIZES.MEDIUM, true),
    });
    levelSubtitle.anchor.set(0.5, 0);
    levelSubtitle.x = canvasWidth / 2;
    levelSubtitle.y = 100;
    this.levelUpOverlay.addChild(levelSubtitle);

    // Card layout: 3 cards arranged horizontally
    const cardWidth = 180;
    const cardHeight = 200;
    const cardGap = 20;
    const totalWidth = choices.length * cardWidth + (choices.length - 1) * cardGap;
    const startX = (canvasWidth - totalWidth) / 2;
    const cardY = 145;

    for (let i = 0; i < choices.length; i++) {
      const choice = choices[i]!;
      const cardX = startX + i * (cardWidth + cardGap);

      // Card background fill
      const cardBg = new Graphics();
      cardBg.roundRect(cardX, cardY, cardWidth, cardHeight, 4);
      cardBg.fill({ color: 0x0d1a0d, alpha: 0.95 });
      this.levelUpOverlay.addChild(cardBg);

      // Card border (stored for selection highlight updates)
      const cardBorder = new Graphics();
      this.drawCardBorder(cardBorder, cardX, cardY, cardWidth, cardHeight, i === 0);
      this.levelUpOverlay.addChild(cardBorder);
      this.cardBorders.push(cardBorder);

      // Key number indicator at top
      const keyText = new Text({
        text: `[${i + 1}]`,
        style: createTerminalStyle(COLORS.TERMINAL_CYAN, FONT_SIZES.SMALL, false),
      });
      keyText.anchor.set(0.5, 0);
      keyText.x = cardX + cardWidth / 2;
      keyText.y = cardY + 10;
      this.levelUpOverlay.addChild(keyText);

      // Upgrade name
      const nameText = new Text({
        text: choice.label,
        style: new TextStyle({
          fontFamily: FONT_FAMILY,
          fontSize: FONT_SIZES.NORMAL,
          fill: COLORS.TERMINAL_BRIGHT,
          fontWeight: 'bold',
          wordWrap: true,
          wordWrapWidth: cardWidth - 20,
          align: 'center',
        }),
      });
      nameText.anchor.set(0.5, 0);
      nameText.x = cardX + cardWidth / 2;
      nameText.y = cardY + 35;
      this.levelUpOverlay.addChild(nameText);

      // Divider line inside card
      const divider = new Graphics();
      divider.moveTo(cardX + 15, cardY + 75);
      divider.lineTo(cardX + cardWidth - 15, cardY + 75);
      divider.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.5 });
      this.levelUpOverlay.addChild(divider);

      // Upgrade description
      const descText = new Text({
        text: choice.description,
        style: new TextStyle({
          fontFamily: FONT_FAMILY,
          fontSize: FONT_SIZES.SMALL,
          fill: COLORS.TERMINAL_DIM,
          wordWrap: true,
          wordWrapWidth: cardWidth - 24,
          align: 'center',
        }),
      });
      descText.anchor.set(0.5, 0);
      descText.x = cardX + cardWidth / 2;
      descText.y = cardY + 85;
      this.levelUpOverlay.addChild(descText);

      // Upgrade type tag at bottom of card
      const typeTag = this.getUpgradeTypeTag(choice);
      const tagText = new Text({
        text: typeTag,
        style: createTerminalStyle(COLORS.TERMINAL_DIM, FONT_SIZES.SMALL, false),
      });
      tagText.anchor.set(0.5, 1);
      tagText.x = cardX + cardWidth / 2;
      tagText.y = cardY + cardHeight - 10;
      this.levelUpOverlay.addChild(tagText);
    }

    // Instructions at the bottom
    const instructions = new Text({
      text: '[1/2/3] or [\u2190/\u2192] + ENTER to select',
      style: terminalDimStyle,
    });
    instructions.anchor.set(0.5, 0);
    instructions.x = canvasWidth / 2;
    instructions.y = cardY + cardHeight + 20;
    this.levelUpOverlay.addChild(instructions);

    this.container.addChild(this.levelUpOverlay);
  }

  /**
   * Draw (or redraw) a card border with selection highlight.
   */
  private drawCardBorder(
    border: Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    selected: boolean,
  ): void {
    border.clear();
    border.roundRect(x, y, w, h, 4);
    if (selected) {
      border.stroke({ color: COLORS.TERMINAL_CYAN, width: 2 });
    } else {
      border.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.6 });
    }
  }

  /**
   * Update which card border is highlighted based on the selected index.
   */
  private updateLevelUpSelection(): void {
    if (!this.levelUpOverlay || this.cardBorders.length === 0) {
      return;
    }

    const canvasWidth = (this.game.config as { canvas: { width: number; height: number } }).canvas.width;
    const cardWidth = 180;
    const cardHeight = 200;
    const cardGap = 20;
    const totalWidth = this.cardBorders.length * cardWidth + (this.cardBorders.length - 1) * cardGap;
    const startX = (canvasWidth - totalWidth) / 2;
    const cardY = 145;

    for (let i = 0; i < this.cardBorders.length; i++) {
      const cardX = startX + i * (cardWidth + cardGap);
      const border = this.cardBorders[i]!;
      this.drawCardBorder(border, cardX, cardY, cardWidth, cardHeight, i === this.levelUpSelectedIndex);
    }
  }

  /**
   * Hide the level-up overlay and resume gameplay.
   */
  private hideLevelUpOverlay(): void {
    if (this.levelUpOverlay) {
      this.container.removeChild(this.levelUpOverlay);
      this.levelUpOverlay.destroy({ children: true });
      this.levelUpOverlay = null;
    }

    this.cardBorders = [];
    this.showingLevelUp = false;
    this.levelUpSelectedIndex = 0;
  }

  /**
   * Confirm the currently selected upgrade choice.
   */
  private confirmLevelUpChoice(index: number): void {
    if (!this.minigame || !this.showingLevelUp) {
      return;
    }

    // Apply the upgrade (this also resumes the game)
    this.minigame.applyUpgrade(index);

    // Remove the overlay
    this.hideLevelUpOverlay();

    // Refresh display immediately
    this.updateDisplay();
  }

  /**
   * Get a display tag for the upgrade type.
   */
  private getUpgradeTypeTag(choice: UpgradeChoice): string {
    switch (choice.type) {
      case 'new-weapon':
        return 'NEW WEAPON';
      case 'upgrade-weapon':
        return 'WEAPON UPGRADE';
      case 'stat-boost':
        return 'STAT BOOST';
      default:
        return '';
    }
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
    // Arrow left/right also have onPress handlers for level-up card navigation.
    const movementKeysNoNav = ['KeyW', 'KeyS', 'ArrowUp', 'ArrowDown'];
    for (const key of movementKeysNoNav) {
      bindings.set(key, {});
    }

    bindings.set('KeyA', {
      onPress: () => this.handleLevelUpNav(-1),
    });
    bindings.set('ArrowLeft', {
      onPress: () => this.handleLevelUpNav(-1),
    });
    bindings.set('KeyD', {
      onPress: () => this.handleLevelUpNav(1),
    });
    bindings.set('ArrowRight', {
      onPress: () => this.handleLevelUpNav(1),
    });

    // Escape to exit
    bindings.set('Escape', {
      onPress: () => this.handleEscape(),
    });

    // Enter to continue from results, or confirm level-up selection
    bindings.set('Enter', {
      onPress: () => this.handleEnter(),
    });

    // Space also confirms level-up selection
    bindings.set('Space', {
      onPress: () => this.handleEnter(),
    });

    // Digit keys 1/2/3 for direct upgrade choice selection
    bindings.set('Digit1', {
      onPress: () => this.handleLevelUpDigit(0),
    });
    bindings.set('Digit2', {
      onPress: () => this.handleLevelUpDigit(1),
    });
    bindings.set('Digit3', {
      onPress: () => this.handleLevelUpDigit(2),
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
    if (this.showingLevelUp) {
      // During level-up, ESC does nothing - player must pick an upgrade
      return;
    }

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
    if (this.showingLevelUp) {
      // Confirm the currently highlighted upgrade card
      this.confirmLevelUpChoice(this.levelUpSelectedIndex);
      return;
    }

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

  /**
   * Handle digit key press for direct upgrade selection during level-up.
   *
   * @param index - The 0-based card index (0 for Digit1, 1 for Digit2, 2 for Digit3)
   */
  private handleLevelUpDigit(index: number): void {
    if (!this.showingLevelUp) {
      return;
    }

    const state = this.minigame?.getState();
    if (!state || index >= state.upgradeChoices.length) {
      return;
    }

    this.confirmLevelUpChoice(index);
  }

  /**
   * Handle arrow key / A/D navigation during level-up card selection.
   *
   * @param direction - -1 for left, +1 for right
   */
  private handleLevelUpNav(direction: number): void {
    if (!this.showingLevelUp) {
      return;
    }

    const choiceCount = this.cardBorders.length;
    if (choiceCount === 0) {
      return;
    }

    this.levelUpSelectedIndex = (this.levelUpSelectedIndex + direction + choiceCount) % choiceCount;
    this.updateLevelUpSelection();
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
