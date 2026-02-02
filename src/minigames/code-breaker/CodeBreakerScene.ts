/**
 * Code Breaker Scene
 *
 * PixiJS scene for the redesigned Code Breaker minigame. Handles:
 * - Visual rendering of the target sequence and player input (dynamic length)
 * - Per-code countdown bar with color transitions
 * - Raw keydown listener for 26-character input (A-Z letters only)
 * - Stats bar: codes cracked, code length, money
 * - Results overlay with failure reason, codes cracked, longest code, money
 * - Upgrade bonus application (getMinigameTimeBonus + getPerCodeTimeBonus)
 *
 * Visual Layout:
 * +------------------------------------------+
 * |  CODE BREAKER                            |
 * +------------------------------------------+
 * |  [=======countdown bar========]          |
 * |                                          |
 * |  TARGET: [ A ] [ 3 ] [ # ] [ Z ] [ 7 ]  |
 * |  INPUT:  [ A ] [ 3 ] [ _ ] [ _ ] [ _ ]  |
 * +------------------------------------------+
 * |  CODES: 5   LENGTH: 9   MONEY: $450      |
 * +------------------------------------------+
 * |  Type the code! Wrong input = game over  |
 * +------------------------------------------+
 *
 * Usage:
 *   const scene = createCodeBreakerScene(game);
 *   sceneManager.register('code-breaker', () => scene);
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Scene, GameInstance } from '../../core/types';
import type { Game } from '../../game/Game';
import type { InputContext } from '../../input/InputManager';
import { INPUT_PRIORITY } from '../../input/InputManager';
import { CodeBreakerGame } from './CodeBreakerGame';
import type { FailReason } from './CodeBreakerGame';
import type { MinigameEventType } from '../BaseMinigame';
import { COLORS } from '../../rendering/Renderer';
import {
  terminalStyle,
  terminalDimStyle,
  terminalBrightStyle,
  titleStyle,
  scoreStyle,
  hudStyle,
  createTerminalStyle,
} from '../../rendering/styles';
import { GameEvents } from '../../events/game-events';
import { createMinigameInterstitialScene } from '../../scenes/minigame-interstitial';
import {
  getMinigameTimeBonus,
  getPerCodeTimeBonus,
} from '../../upgrades/upgrade-definitions';

// ============================================================================
// Configuration
// ============================================================================

/** Layout constants */
const LAYOUT = {
  /** Padding from edges */
  PADDING: 40,
  /** Header height */
  HEADER_HEIGHT: 60,
  /** Maximum size of character boxes */
  MAX_BOX_SIZE: 50,
  /** Minimum size of character boxes */
  MIN_BOX_SIZE: 24,
  /** Spacing ratio between boxes (relative to box size) */
  BOX_SPACING_RATIO: 1.2,
  /** Gap between target and input rows */
  ROW_GAP: 20,
  /** Y position of countdown bar (from top) */
  COUNTDOWN_BAR_Y: 110,
  /** Height of countdown bar */
  COUNTDOWN_BAR_HEIGHT: 16,
  /** Y position of code display area (from top) */
  CODE_DISPLAY_Y: 160,
  /** Y position of stats bar (from bottom) */
  STATS_Y_FROM_BOTTOM: 80,
  /** Y position of instructions (from bottom) */
  INSTRUCTIONS_Y_FROM_BOTTOM: 40,
} as const;

/** Colors for countdown bar */
const BAR_COLORS = {
  GREEN: 0x00ff00,
  YELLOW: 0xffff00,
  RED: 0xff4444,
  PREVIEW: 0x00bbff,
} as const;

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Code Breaker scene implementation.
 */
class CodeBreakerScene implements Scene {
  readonly id = 'code-breaker';

  /** The PixiJS container for this scene */
  private readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** The Code Breaker game logic */
  private minigame: CodeBreakerGame | null = null;

  /** Input context for this scene (Escape/Enter only) */
  private inputContext: InputContext | null = null;

  /** Whether results overlay is showing */
  private showingResults: boolean = false;

  /** Raw keydown event handler reference (for cleanup) */
  private rawKeydownHandler: ((e: KeyboardEvent) => void) | null = null;

  /** Running total of money accumulated (for display) */
  private accumulatedMoney: number = 0;

  /** Longest code length reached this session */
  private longestCodeLength: number = 0;

  // UI Elements - Static
  private countdownBarBg: Graphics | null = null;
  private countdownBarFill: Graphics | null = null;
  private countdownTimeText: Text | null = null;

  // UI Elements - Dynamic (rebuilt per code)
  private codeDisplayContainer: Container | null = null;
  private targetBoxes: Graphics[] = [];
  private targetTexts: Text[] = [];
  private inputBoxes: Graphics[] = [];
  private inputTexts: Text[] = [];

  // UI Elements - Stats
  private codesText: Text | null = null;
  private lengthText: Text | null = null;
  private moneyText: Text | null = null;
  private statusText: Text | null = null;

  // Results overlay
  private resultsOverlay: Container | null = null;

  // Event unsubscribers
  private unsubscribers: Array<() => void> = [];

  constructor(game: Game) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'code-breaker-scene';
  }

  // ==========================================================================
  // Scene Lifecycle
  // ==========================================================================

  getContainer(): Container {
    return this.container;
  }

  onEnter(): void {
    console.log('[CodeBreakerScene] Entering scene');

    // Create static UI elements
    this.createUI();

    // Create minigame instance
    this.minigame = new CodeBreakerGame(this.game.config.minigames.codeBreaker);

    // Apply upgrade bonuses
    this.applyUpgradeBonuses();

    // Set up minigame event listeners
    this.setupMinigameListeners();

    // Register input context (Escape/Enter only)
    this.registerInputContext();

    // Register raw keydown listener for character input
    this.registerRawKeyListener();

    // Reset session tracking
    this.accumulatedMoney = 0;
    this.longestCodeLength = this.game.config.minigames.codeBreaker.startingCodeLength;

    // Emit scene entered event
    this.game.eventBus.emit(GameEvents.SCENE_ENTERED, {
      sceneId: this.id,
    });

    // Start the game
    this.minigame.start();

    // Build initial code display
    this.rebuildCodeDisplay(this.minigame.currentCodeLength);

    // Emit minigame started event
    this.game.eventBus.emit(GameEvents.MINIGAME_STARTED, {
      minigameId: this.id,
      startTime: Date.now(),
    });

    // Initial render
    this.updateDisplay();
  }

  onExit(): void {
    console.log('[CodeBreakerScene] Exiting scene');

    // Remove raw keydown listener
    this.removeRawKeyListener();

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
    console.log('[CodeBreakerScene] Destroying scene');

    // Remove raw keydown listener
    this.removeRawKeyListener();

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
    this.targetBoxes = [];
    this.targetTexts = [];
    this.inputBoxes = [];
    this.inputTexts = [];
    this.countdownBarBg = null;
    this.countdownBarFill = null;
    this.countdownTimeText = null;
    this.codesText = null;
    this.lengthText = null;
    this.moneyText = null;
    this.statusText = null;
    this.codeDisplayContainer = null;
    this.resultsOverlay = null;

    // Destroy container and children
    this.container.destroy({ children: true });
  }

  // ==========================================================================
  // Upgrade Bonuses
  // ==========================================================================

  /**
   * Read upgrade bonuses from the store and apply to the minigame.
   */
  private applyUpgradeBonuses(): void {
    if (!this.minigame) { return; }

    const store = this.game.store;
    const minigameTimeBonusSec = getMinigameTimeBonus(store);
    const perCodeTimeBonusSec = getPerCodeTimeBonus(store);

    // Both are in seconds, convert to ms and combine
    const totalBonusMs = (minigameTimeBonusSec + perCodeTimeBonusSec) * 1000;

    if (totalBonusMs > 0) {
      console.log(`[CodeBreakerScene] Applying upgrade bonus: ${totalBonusMs}ms`);
      this.minigame.setUpgradeBonusMs(totalBonusMs);
    }
  }

  // ==========================================================================
  // UI Creation
  // ==========================================================================

  /**
   * Create all static UI elements (header, countdown bar, stats bar, instructions).
   * The code display (target/input boxes) is created dynamically via rebuildCodeDisplay().
   */
  private createUI(): void {
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;
    const centerX = width / 2;

    // Background
    this.createBackground(width, height);

    // Header
    this.createHeader(centerX);

    // Countdown bar
    this.createCountdownBar(width);

    // Code display container (filled by rebuildCodeDisplay)
    this.codeDisplayContainer = new Container();
    this.codeDisplayContainer.label = 'code-display';
    this.container.addChild(this.codeDisplayContainer);

    // Stats bar
    this.createStatsBar(width, height - LAYOUT.STATS_Y_FROM_BOTTOM);

    // Instructions
    this.createInstructions(centerX, height - LAYOUT.INSTRUCTIONS_Y_FROM_BOTTOM);
  }

  /**
   * Create background and border.
   */
  private createBackground(width: number, height: number): void {
    const bg = new Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: COLORS.BACKGROUND, alpha: 0.95 });
    this.container.addChild(bg);

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
      text: 'CODE BREAKER',
      style: titleStyle,
    });
    title.anchor.set(0.5, 0);
    title.x = centerX;
    title.y = LAYOUT.PADDING;
    this.container.addChild(title);

    const divider = new Graphics();
    divider.moveTo(LAYOUT.PADDING, LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING);
    divider.lineTo(this.game.config.canvas.width - LAYOUT.PADDING, LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING);
    divider.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    this.container.addChild(divider);
  }

  /**
   * Create the countdown bar (background + fill + time text).
   */
  private createCountdownBar(width: number): void {
    const barX = LAYOUT.PADDING + 10;
    const barWidth = width - (LAYOUT.PADDING + 10) * 2;
    const barY = LAYOUT.COUNTDOWN_BAR_Y;
    const barHeight = LAYOUT.COUNTDOWN_BAR_HEIGHT;

    // Background (dark outline)
    this.countdownBarBg = new Graphics();
    this.countdownBarBg.rect(barX, barY, barWidth, barHeight);
    this.countdownBarBg.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    this.container.addChild(this.countdownBarBg);

    // Fill (will be redrawn each frame)
    this.countdownBarFill = new Graphics();
    this.container.addChild(this.countdownBarFill);

    // Time text (above bar, right-aligned)
    this.countdownTimeText = new Text({
      text: '',
      style: createTerminalStyle(COLORS.TERMINAL_GREEN, 12),
    });
    this.countdownTimeText.anchor.set(1, 1);
    this.countdownTimeText.x = barX + barWidth;
    this.countdownTimeText.y = barY - 2;
    this.container.addChild(this.countdownTimeText);
  }

  /**
   * Create the stats bar (codes cracked, code length, money).
   */
  private createStatsBar(width: number, y: number): void {
    const statsContainer = new Container();
    statsContainer.label = 'stats-bar';

    const thirdWidth = width / 3;

    // Codes cracked (left)
    const codesLabel = new Text({
      text: 'CODES:',
      style: terminalDimStyle,
    });
    codesLabel.anchor.set(0, 0.5);
    codesLabel.x = LAYOUT.PADDING + 20;
    codesLabel.y = y;
    statsContainer.addChild(codesLabel);

    this.codesText = new Text({
      text: '0',
      style: hudStyle,
    });
    this.codesText.anchor.set(0, 0.5);
    this.codesText.x = codesLabel.x + 70;
    this.codesText.y = y;
    statsContainer.addChild(this.codesText);

    // Code length (center)
    const lengthLabel = new Text({
      text: 'LENGTH:',
      style: terminalDimStyle,
    });
    lengthLabel.anchor.set(0.5, 0.5);
    lengthLabel.x = thirdWidth + 20;
    lengthLabel.y = y;
    statsContainer.addChild(lengthLabel);

    this.lengthText = new Text({
      text: '5',
      style: hudStyle,
    });
    this.lengthText.anchor.set(0, 0.5);
    this.lengthText.x = lengthLabel.x + 55;
    this.lengthText.y = y;
    statsContainer.addChild(this.lengthText);

    // Money (right)
    const moneyLabel = new Text({
      text: 'MONEY:',
      style: terminalDimStyle,
    });
    moneyLabel.anchor.set(0, 0.5);
    moneyLabel.x = 2 * thirdWidth + 20;
    moneyLabel.y = y;
    statsContainer.addChild(moneyLabel);

    this.moneyText = new Text({
      text: '$0',
      style: scoreStyle,
    });
    this.moneyText.anchor.set(0, 0.5);
    this.moneyText.x = moneyLabel.x + 75;
    this.moneyText.y = y;
    statsContainer.addChild(this.moneyText);

    this.container.addChild(statsContainer);
  }

  /**
   * Create instruction text.
   */
  private createInstructions(centerX: number, y: number): void {
    this.statusText = new Text({
      text: 'Type the code before time runs out! Wrong input = game over | [ESC] Exit',
      style: terminalDimStyle,
    });
    this.statusText.anchor.set(0.5, 0);
    this.statusText.x = centerX;
    this.statusText.y = y;
    this.container.addChild(this.statusText);
  }

  // ==========================================================================
  // Dynamic Code Display
  // ==========================================================================

  /**
   * Rebuild the target and input box displays for a given code length.
   * Destroys existing boxes and creates new ones scaled to fit.
   */
  private rebuildCodeDisplay(length: number): void {
    if (!this.codeDisplayContainer) { return; }

    // Destroy existing children
    this.codeDisplayContainer.removeChildren();
    this.targetBoxes = [];
    this.targetTexts = [];
    this.inputBoxes = [];
    this.inputTexts = [];

    const width = this.game.config.canvas.width;
    const centerX = width / 2;
    const availableWidth = width - LAYOUT.PADDING * 2 - 40; // extra margin

    // Calculate box size to fit within available width
    const idealSpacing = LAYOUT.MAX_BOX_SIZE * LAYOUT.BOX_SPACING_RATIO;
    const neededWidth = length * idealSpacing;
    let boxSize: number = LAYOUT.MAX_BOX_SIZE;
    let spacing: number = idealSpacing;

    if (neededWidth > availableWidth) {
      // Scale down to fit
      spacing = availableWidth / length;
      boxSize = Math.max(LAYOUT.MIN_BOX_SIZE, Math.floor(spacing / LAYOUT.BOX_SPACING_RATIO));
      spacing = boxSize * LAYOUT.BOX_SPACING_RATIO;
    }

    const fontSize = Math.max(10, Math.floor(boxSize * 0.5));
    const startX = centerX - ((length - 1) * spacing) / 2;
    const targetY = LAYOUT.CODE_DISPLAY_Y;
    const inputY = targetY + boxSize + LAYOUT.ROW_GAP;

    // Target label
    const targetLabel = new Text({
      text: 'TARGET:',
      style: terminalDimStyle,
    });
    targetLabel.anchor.set(1, 0.5);
    targetLabel.x = startX - spacing * 0.4;
    targetLabel.y = targetY + boxSize / 2;
    // Only show label if there is room
    if (startX - spacing * 0.4 > LAYOUT.PADDING + 80) {
      this.codeDisplayContainer.addChild(targetLabel);
    }

    // Input label
    const inputLabel = new Text({
      text: 'INPUT:',
      style: terminalDimStyle,
    });
    inputLabel.anchor.set(1, 0.5);
    inputLabel.x = startX - spacing * 0.4;
    inputLabel.y = inputY + boxSize / 2;
    if (startX - spacing * 0.4 > LAYOUT.PADDING + 80) {
      this.codeDisplayContainer.addChild(inputLabel);
    }

    // Create boxes for target and input rows
    for (let i = 0; i < length; i++) {
      const x = startX + i * spacing;

      // Target box
      const tBox = new Graphics();
      tBox.x = x;
      tBox.y = targetY;
      tBox.rect(-boxSize / 2, 0, boxSize, boxSize);
      tBox.stroke({ color: COLORS.TERMINAL_DIM, width: 2 });
      this.codeDisplayContainer.addChild(tBox);
      this.targetBoxes.push(tBox);

      // Target text
      const tText = new Text({
        text: '-',
        style: createTerminalStyle(COLORS.TERMINAL_BRIGHT, fontSize),
      });
      tText.anchor.set(0.5);
      tText.x = x;
      tText.y = targetY + boxSize / 2;
      this.codeDisplayContainer.addChild(tText);
      this.targetTexts.push(tText);

      // Input box
      const iBox = new Graphics();
      iBox.x = x;
      iBox.y = inputY;
      iBox.rect(-boxSize / 2, 0, boxSize, boxSize);
      iBox.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
      this.codeDisplayContainer.addChild(iBox);
      this.inputBoxes.push(iBox);

      // Input text
      const iText = new Text({
        text: '_',
        style: createTerminalStyle(COLORS.TERMINAL_GREEN, fontSize),
      });
      iText.anchor.set(0.5);
      iText.x = x;
      iText.y = inputY + boxSize / 2;
      this.codeDisplayContainer.addChild(iText);
      this.inputTexts.push(iText);
    }
  }

  // ==========================================================================
  // Display Updates
  // ==========================================================================

  /**
   * Update all display elements based on game state.
   */
  private updateDisplay(): void {
    if (!this.minigame) { return; }

    this.updateTargetDisplay();
    this.updateInputDisplay();
    this.updateCountdownBar();
    this.updateStats();
  }

  /**
   * Update the target sequence display.
   */
  private updateTargetDisplay(): void {
    if (!this.minigame) { return; }

    const target = this.minigame.targetSequence;
    for (let i = 0; i < target.length && i < this.targetTexts.length; i++) {
      const text = this.targetTexts[i];
      if (text) {
        text.text = String(target[i] ?? '-');
      }
    }
  }

  /**
   * Update the input sequence display.
   */
  private updateInputDisplay(): void {
    if (!this.minigame) { return; }

    const input = this.minigame.inputSequence;
    const currentPos = this.minigame.currentPosition;
    const length = this.minigame.currentCodeLength;

    // Calculate current box size for redraw
    const width = this.game.config.canvas.width;
    const availableWidth = width - LAYOUT.PADDING * 2 - 40;
    const idealSpacing = LAYOUT.MAX_BOX_SIZE * LAYOUT.BOX_SPACING_RATIO;
    const neededWidth = length * idealSpacing;
    let boxSize: number = LAYOUT.MAX_BOX_SIZE;
    if (neededWidth > availableWidth) {
      const spacing = availableWidth / length;
      boxSize = Math.max(LAYOUT.MIN_BOX_SIZE, Math.floor(spacing / LAYOUT.BOX_SPACING_RATIO));
    }

    for (let i = 0; i < length && i < this.inputTexts.length; i++) {
      const text = this.inputTexts[i];
      const box = this.inputBoxes[i];

      if (!text || !box) { continue; }

      if (i < input.length) {
        // Completed position - show entered character
        text.text = String(input[i]);
        text.style = createTerminalStyle(COLORS.TERMINAL_BRIGHT, Math.max(10, Math.floor(boxSize * 0.5)));
        this.updateBoxStyle(box, 'correct', boxSize);
      } else if (i === currentPos) {
        // Current position - show cursor
        text.text = '_';
        text.style = createTerminalStyle(COLORS.TERMINAL_GREEN, Math.max(10, Math.floor(boxSize * 0.5)));
        this.updateBoxStyle(box, 'active', boxSize);
      } else {
        // Future position
        text.text = '_';
        text.style = createTerminalStyle(COLORS.TERMINAL_DIM, Math.max(10, Math.floor(boxSize * 0.5)));
        this.updateBoxStyle(box, 'inactive', boxSize);
      }
    }
  }

  /**
   * Update a character box's visual style.
   */
  private updateBoxStyle(box: Graphics, state: 'inactive' | 'active' | 'correct' | 'wrong', boxSize: number): void {
    box.clear();

    let color: number;
    let strokeWidth: number;

    switch (state) {
      case 'correct':
        color = COLORS.TERMINAL_BRIGHT;
        strokeWidth = 2;
        break;
      case 'active':
        color = COLORS.TERMINAL_GREEN;
        strokeWidth = 2;
        break;
      case 'wrong':
        color = COLORS.TERMINAL_RED;
        strokeWidth = 2;
        break;
      default:
        color = COLORS.TERMINAL_DIM;
        strokeWidth = 1;
    }

    box.rect(-boxSize / 2, 0, boxSize, boxSize);
    box.stroke({ color, width: strokeWidth });
  }

  /**
   * Update the countdown bar based on per-code timer state.
   */
  private updateCountdownBar(): void {
    if (!this.minigame || !this.countdownBarFill || !this.countdownTimeText) { return; }

    const width = this.game.config.canvas.width;
    const barX = LAYOUT.PADDING + 10;
    const barWidth = width - (LAYOUT.PADDING + 10) * 2;
    const barY = LAYOUT.COUNTDOWN_BAR_Y;
    const barHeight = LAYOUT.COUNTDOWN_BAR_HEIGHT;

    const isPreview = this.minigame.isInPreview;
    const effectiveTimeLimit = this.minigame.effectiveTimeLimitMs;
    const timeRemaining = this.minigame.perCodeTimeRemainingMs;

    // During preview, show full bar in preview color
    let fraction: number;
    let barColor: number;

    if (isPreview) {
      fraction = 1.0;
      barColor = BAR_COLORS.PREVIEW;
      const previewSec = (this.minigame.previewRemainingMs / 1000).toFixed(1);
      this.countdownTimeText.text = `PREVIEW ${previewSec}s`;
      this.countdownTimeText.style = createTerminalStyle(BAR_COLORS.PREVIEW, 12);
    } else {
      fraction = effectiveTimeLimit > 0 ? timeRemaining / effectiveTimeLimit : 0;
      fraction = Math.max(0, Math.min(1, fraction));

      // Color transitions: green (>50%) -> yellow (25-50%) -> red (<25%)
      if (fraction > 0.5) {
        barColor = BAR_COLORS.GREEN;
      } else if (fraction > 0.25) {
        barColor = BAR_COLORS.YELLOW;
      } else {
        barColor = BAR_COLORS.RED;
      }

      const timeSec = (timeRemaining / 1000).toFixed(1);
      this.countdownTimeText.text = `${timeSec}s`;
      this.countdownTimeText.style = createTerminalStyle(barColor, 12);
    }

    // Redraw fill bar
    this.countdownBarFill.clear();
    const fillWidth = barWidth * fraction;
    if (fillWidth > 0) {
      this.countdownBarFill.rect(barX, barY, fillWidth, barHeight);
      this.countdownBarFill.fill({ color: barColor, alpha: 0.8 });
    }
  }

  /**
   * Update the stats display.
   */
  private updateStats(): void {
    if (!this.minigame) { return; }

    if (this.codesText) {
      this.codesText.text = String(this.minigame.codesCracked);
    }

    if (this.lengthText) {
      this.lengthText.text = String(this.minigame.currentCodeLength);
    }

    if (this.moneyText) {
      this.moneyText.text = `$${this.accumulatedMoney}`;
    }
  }

  // ==========================================================================
  // Minigame Event Handlers
  // ==========================================================================

  /**
   * Set up listeners for minigame events.
   */
  private setupMinigameListeners(): void {
    if (!this.minigame) { return; }

    // Handle game end
    const unsubEnd = this.minigame.on('end', () => {
      this.handleGameEnd();
    });
    this.unsubscribers.push(unsubEnd);

    // Handle sequence complete (rebuild display for new code length)
    // Cast to MinigameEventType to match how CodeBreakerGame emits the event
    const unsubSequence = this.minigame.on('sequence-complete' as MinigameEventType, (payload) => {
      if (!this.minigame) { return; }

      // Update accumulated money from event data
      const data = payload.data as { moneyEarned?: number } | undefined;
      if (data?.moneyEarned !== undefined) {
        this.accumulatedMoney = data.moneyEarned;
      }

      // Track longest code
      if (this.minigame.currentCodeLength > this.longestCodeLength) {
        this.longestCodeLength = this.minigame.currentCodeLength;
      }

      // Rebuild display for new code length
      this.rebuildCodeDisplay(this.minigame.currentCodeLength);
      this.updateDisplay();
    });
    this.unsubscribers.push(unsubSequence);
  }

  /**
   * Handle game completion.
   */
  private handleGameEnd(): void {
    if (!this.minigame) { return; }

    this.showingResults = true;

    // Get final stats
    const stats = this.minigame.getFinalStats();
    const moneyReward = this.minigame.calculateMoneyReward();
    const failReason = this.minigame.failReason;

    // Record score and award resources
    const state = this.game.store.getState();
    state.recordScore('code-breaker', String(stats.score));
    state.incrementPlayCount('code-breaker');
    state.addResource('money', moneyReward);
    state.trackResourceEarned('money', moneyReward);

    // Emit completion event
    this.game.eventBus.emit(GameEvents.MINIGAME_COMPLETED, {
      minigameId: 'code-breaker',
      score: stats.score,
      maxCombo: stats.maxCombo,
      durationMs: stats.durationMs,
      rewards: { money: moneyReward },
      isNewTopScore: this.isNewTopScore(stats.score),
    });

    // Show results overlay
    this.showResultsOverlay(failReason, moneyReward);
  }

  /**
   * Check if score qualifies as a new top score.
   */
  private isNewTopScore(score: number): boolean {
    const minigameState = this.game.store.getState().minigames['code-breaker'];
    if (!minigameState) { return true; }

    const topScores = minigameState.topScores;
    if (topScores.length < 5) { return true; }

    const lowestTop = Number(topScores[topScores.length - 1] ?? 0);
    return score > lowestTop;
  }

  /**
   * Show the results overlay.
   */
  private showResultsOverlay(failReason: FailReason, moneyReward: string): void {
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
    const boxWidth = 420;
    const boxHeight = 360;
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

    // Failure reason title
    let failText = 'GAME OVER';
    let failColor: number = COLORS.TERMINAL_GREEN;
    if (failReason === 'wrong-input') {
      failText = 'WRONG INPUT';
      failColor = COLORS.TERMINAL_RED;
    } else if (failReason === 'timeout') {
      failText = "TIME'S UP";
      failColor = COLORS.TERMINAL_YELLOW;
    }

    const title = new Text({
      text: failText,
      style: createTerminalStyle(failColor, 32, true),
    });
    title.anchor.set(0.5, 0);
    title.x = width / 2;
    title.y = boxY + 25;
    this.resultsOverlay.addChild(title);

    // Divider
    const divider = new Graphics();
    divider.moveTo(boxX + 20, boxY + 70);
    divider.lineTo(boxX + boxWidth - 20, boxY + 70);
    divider.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    this.resultsOverlay.addChild(divider);

    // Stats
    const statsStartY = boxY + 90;
    const lineHeight = 35;

    // Codes cracked
    const codesCrackedText = new Text({
      text: `CODES CRACKED: ${this.minigame?.codesCracked ?? 0}`,
      style: terminalBrightStyle,
    });
    codesCrackedText.anchor.set(0.5, 0);
    codesCrackedText.x = width / 2;
    codesCrackedText.y = statsStartY;
    this.resultsOverlay.addChild(codesCrackedText);

    // Longest code
    const longestText = new Text({
      text: `LONGEST CODE: ${this.longestCodeLength} characters`,
      style: terminalStyle,
    });
    longestText.anchor.set(0.5, 0);
    longestText.x = width / 2;
    longestText.y = statsStartY + lineHeight;
    this.resultsOverlay.addChild(longestText);

    // Money earned
    const moneyEarnedText = new Text({
      text: `MONEY EARNED: $${moneyReward}`,
      style: scoreStyle,
    });
    moneyEarnedText.anchor.set(0.5, 0);
    moneyEarnedText.x = width / 2;
    moneyEarnedText.y = statsStartY + lineHeight * 2;
    this.resultsOverlay.addChild(moneyEarnedText);

    // Instructions
    const instructions = new Text({
      text: 'Press ENTER for menu or ESC to exit',
      style: terminalDimStyle,
    });
    instructions.anchor.set(0.5, 0);
    instructions.x = width / 2;
    instructions.y = boxY + boxHeight - 45;
    this.resultsOverlay.addChild(instructions);

    this.container.addChild(this.resultsOverlay);
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Register a raw keydown event listener for character input.
   * Only accepts letter keys (KeyA-KeyZ) to match the 26-letter character set.
   */
  private registerRawKeyListener(): void {
    this.rawKeydownHandler = (event: KeyboardEvent): void => {
      // Do not process if showing results
      if (this.showingResults) { return; }
      if (!this.minigame?.isPlaying) { return; }

      // Only accept letter keys (KeyA through KeyZ)
      if (!event.code.startsWith('Key')) { return; }

      // Extract the letter from the code (e.g., 'KeyA' -> 'A')
      const key = event.code.slice(3);

      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        event.preventDefault();
        event.stopPropagation();

        const result = this.minigame.handleCharInput(key);

        // Update display immediately on input
        if (result !== null) {
          this.updateDisplay();
        }
      }
    };

    window.addEventListener('keydown', this.rawKeydownHandler);
  }

  /**
   * Remove the raw keydown event listener.
   */
  private removeRawKeyListener(): void {
    if (this.rawKeydownHandler) {
      window.removeEventListener('keydown', this.rawKeydownHandler);
      this.rawKeydownHandler = null;
    }
  }

  /**
   * Register the input context for Escape and Enter keys only.
   * Character input is handled by the raw keydown listener.
   */
  private registerInputContext(): void {
    const bindings = new Map<string, { onPress?: () => void; onRelease?: () => void }>();

    // Escape to exit
    bindings.set('Escape', {
      onPress: () => this.handleEscape(),
    });

    // Enter to restart after game over
    bindings.set('Enter', {
      onPress: () => this.handleEnter(),
    });

    this.inputContext = {
      id: 'code-breaker',
      priority: INPUT_PRIORITY.SCENE,
      enabled: true,
      blocksPropagation: true,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('code-breaker');
  }

  /**
   * Handle escape key.
   */
  private handleEscape(): void {
    if (this.showingResults) {
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
 * Create a new Code Breaker scene.
 *
 * @param game - The game instance
 * @returns A new CodeBreakerScene
 */
export function createCodeBreakerScene(game: GameInstance): Scene {
  return new CodeBreakerScene(game as Game);
}
