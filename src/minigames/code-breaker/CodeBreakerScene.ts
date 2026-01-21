/**
 * Code Breaker Scene
 *
 * PixiJS scene for the Code Breaker minigame. Handles:
 * - Visual rendering of the target sequence and player input
 * - Timer, score, and combo display
 * - Input context registration for keyboard handling
 * - Visual feedback for correct/wrong inputs
 * - Results overlay on completion
 *
 * Visual Layout:
 * +------------------------------------------+
 * |  CODE BREAKER                            |
 * +------------------------------------------+
 * |  TARGET: [ 7 ] [ 3 ] [ 9 ] [ 2 ] [ 4 ]   |
 * |  INPUT:  [ 7 ] [ 3 ] [ _ ] [ _ ] [ _ ]   |
 * +------------------------------------------+
 * |  TIME: 00:45   COMBO: x3   SCORE: 1250   |
 * +------------------------------------------+
 * |  [ESC] Exit                              |
 * +------------------------------------------+
 *
 * Usage:
 *   // Via MinigameRegistry
 *   registry.register({
 *     id: 'code-breaker',
 *     name: 'Code Breaker',
 *     createScene: (game) => createCodeBreakerScene(game),
 *   });
 *
 *   // Direct usage
 *   const scene = createCodeBreakerScene(game);
 *   sceneManager.register('code-breaker', () => scene);
 */

import { Container, Graphics, Text } from 'pixi.js';
import type { Scene, GameInstance } from '../../core/types';
import type { Game } from '../../game/Game';
import type { InputContext } from '../../input/InputManager';
import { INPUT_PRIORITY } from '../../input/InputManager';
import { CodeBreakerGame } from './CodeBreakerGame';
import { formatTimeMMSS, formatCombo } from '../BaseMinigame';
import { COLORS } from '../../rendering/Renderer';
import {
  terminalStyle,
  terminalDimStyle,
  terminalBrightStyle,
  titleStyle,
  scoreStyle,
  comboStyle,
  hudStyle,
  createTerminalStyle,
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
  /** Spacing between digit boxes */
  DIGIT_SPACING: 60,
  /** Size of digit boxes */
  DIGIT_BOX_SIZE: 50,
  /** Gap between target and input rows */
  ROW_GAP: 30,
  /** Y position of target row (from center) */
  TARGET_Y_OFFSET: -80,
  /** Y position of stats bar */
  STATS_Y_OFFSET: 100,
  /** Y position of instructions */
  INSTRUCTIONS_Y_OFFSET: 160,
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

  /** Input context for this scene */
  private inputContext: InputContext | null = null;

  /** Whether results overlay is showing */
  private showingResults: boolean = false;

  // UI Elements
  private targetDigitTexts: Text[] = [];
  private targetDigitBoxes: Graphics[] = [];
  private inputDigitTexts: Text[] = [];
  private inputDigitBoxes: Graphics[] = [];
  private timerText: Text | null = null;
  private comboText: Text | null = null;
  private scoreText: Text | null = null;
  private statusText: Text | null = null;
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

    // Create UI
    this.createUI();

    // Create minigame instance
    this.minigame = new CodeBreakerGame(this.game.config.minigames.codeBreaker);

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
    console.log('[CodeBreakerScene] Exiting scene');

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
      nextSceneId: 'apartment', // Will be updated by caller
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
    this.targetDigitTexts = [];
    this.targetDigitBoxes = [];
    this.inputDigitTexts = [];
    this.inputDigitBoxes = [];
    this.timerText = null;
    this.comboText = null;
    this.scoreText = null;
    this.statusText = null;
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
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Background
    this.createBackground(width, height);

    // Header
    this.createHeader(centerX);

    // Sequence displays
    const sequenceLength = this.game.config.minigames.codeBreaker.sequenceLength;
    this.createTargetDisplay(centerX, centerY + LAYOUT.TARGET_Y_OFFSET, sequenceLength);
    this.createInputDisplay(centerX, centerY + LAYOUT.TARGET_Y_OFFSET + LAYOUT.DIGIT_BOX_SIZE + LAYOUT.ROW_GAP, sequenceLength);

    // Stats bar
    this.createStatsBar(width, centerY + LAYOUT.STATS_Y_OFFSET);

    // Instructions
    this.createInstructions(centerX, centerY + LAYOUT.INSTRUCTIONS_Y_OFFSET);
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

    // Border (separate Graphics object)
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

    // Divider line
    const divider = new Graphics();
    divider.moveTo(LAYOUT.PADDING, LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING);
    divider.lineTo(this.game.config.canvas.width - LAYOUT.PADDING, LAYOUT.HEADER_HEIGHT + LAYOUT.PADDING);
    divider.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    this.container.addChild(divider);
  }

  /**
   * Create the target sequence display.
   */
  private createTargetDisplay(centerX: number, y: number, length: number): void {
    const targetContainer = new Container();
    targetContainer.label = 'target-display';

    // Label
    const label = new Text({
      text: 'TARGET:',
      style: terminalDimStyle,
    });
    label.anchor.set(1, 0.5);
    label.x = centerX - (length * LAYOUT.DIGIT_SPACING) / 2 - 20;
    label.y = y + LAYOUT.DIGIT_BOX_SIZE / 2;
    targetContainer.addChild(label);

    // Create digit boxes and texts
    const startX = centerX - ((length - 1) * LAYOUT.DIGIT_SPACING) / 2;

    for (let i = 0; i < length; i++) {
      const x = startX + i * LAYOUT.DIGIT_SPACING;

      // Box - position the Graphics object, draw at local origin
      const box = new Graphics();
      box.x = x;
      box.y = y;
      box.rect(-LAYOUT.DIGIT_BOX_SIZE / 2, 0, LAYOUT.DIGIT_BOX_SIZE, LAYOUT.DIGIT_BOX_SIZE);
      box.stroke({ color: COLORS.TERMINAL_DIM, width: 2 });
      targetContainer.addChild(box);
      this.targetDigitBoxes.push(box);

      // Text
      const text = new Text({
        text: '-',
        style: terminalBrightStyle,
      });
      text.anchor.set(0.5);
      text.x = x;
      text.y = y + LAYOUT.DIGIT_BOX_SIZE / 2;
      targetContainer.addChild(text);
      this.targetDigitTexts.push(text);
    }

    this.container.addChild(targetContainer);
  }

  /**
   * Create the input sequence display.
   */
  private createInputDisplay(centerX: number, y: number, length: number): void {
    const inputContainer = new Container();
    inputContainer.label = 'input-display';

    // Label
    const label = new Text({
      text: 'INPUT:',
      style: terminalDimStyle,
    });
    label.anchor.set(1, 0.5);
    label.x = centerX - (length * LAYOUT.DIGIT_SPACING) / 2 - 20;
    label.y = y + LAYOUT.DIGIT_BOX_SIZE / 2;
    inputContainer.addChild(label);

    // Create digit boxes and texts
    const startX = centerX - ((length - 1) * LAYOUT.DIGIT_SPACING) / 2;

    for (let i = 0; i < length; i++) {
      const x = startX + i * LAYOUT.DIGIT_SPACING;

      // Box (will be styled dynamically) - position the Graphics object, draw at local origin
      const box = new Graphics();
      box.x = x;
      box.y = y;
      box.rect(-LAYOUT.DIGIT_BOX_SIZE / 2, 0, LAYOUT.DIGIT_BOX_SIZE, LAYOUT.DIGIT_BOX_SIZE);
      box.stroke({ color: COLORS.TERMINAL_DIM, width: 2 });
      inputContainer.addChild(box);
      this.inputDigitBoxes.push(box);

      // Text
      const text = new Text({
        text: '_',
        style: terminalStyle,
      });
      text.anchor.set(0.5);
      text.x = x;
      text.y = y + LAYOUT.DIGIT_BOX_SIZE / 2;
      inputContainer.addChild(text);
      this.inputDigitTexts.push(text);
    }

    this.container.addChild(inputContainer);
  }

  /**
   * Create the stats bar (timer, combo, score).
   */
  private createStatsBar(width: number, y: number): void {
    const statsContainer = new Container();
    statsContainer.label = 'stats-bar';

    const thirdWidth = width / 3;

    // Timer (left)
    const timerLabel = new Text({
      text: 'TIME:',
      style: terminalDimStyle,
    });
    timerLabel.anchor.set(0, 0.5);
    timerLabel.x = LAYOUT.PADDING + 20;
    timerLabel.y = y;
    statsContainer.addChild(timerLabel);

    this.timerText = new Text({
      text: '01:00',
      style: hudStyle,
    });
    this.timerText.anchor.set(0, 0.5);
    this.timerText.x = timerLabel.x + 60;
    this.timerText.y = y;
    statsContainer.addChild(this.timerText);

    // Combo (center)
    const comboLabel = new Text({
      text: 'COMBO:',
      style: terminalDimStyle,
    });
    comboLabel.anchor.set(0.5, 0.5);
    comboLabel.x = thirdWidth + 20;
    comboLabel.y = y;
    statsContainer.addChild(comboLabel);

    this.comboText = new Text({
      text: 'x1',
      style: comboStyle,
    });
    this.comboText.anchor.set(0, 0.5);
    this.comboText.x = comboLabel.x + 50;
    this.comboText.y = y;
    statsContainer.addChild(this.comboText);

    // Score (right)
    const scoreLabel = new Text({
      text: 'SCORE:',
      style: terminalDimStyle,
    });
    scoreLabel.anchor.set(0, 0.5);
    scoreLabel.x = 2 * thirdWidth + 20;
    scoreLabel.y = y;
    statsContainer.addChild(scoreLabel);

    this.scoreText = new Text({
      text: '0',
      style: scoreStyle,
    });
    this.scoreText.anchor.set(0, 0.5);
    this.scoreText.x = scoreLabel.x + 70;
    this.scoreText.y = y;
    statsContainer.addChild(this.scoreText);

    this.container.addChild(statsContainer);
  }

  /**
   * Create instruction text.
   */
  private createInstructions(centerX: number, y: number): void {
    this.statusText = new Text({
      text: 'Type digits 0-9 to match the sequence | [ESC] Exit',
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

    this.updateTargetDisplay();
    this.updateInputDisplay();
    this.updateStats();
  }

  /**
   * Update the target sequence display.
   */
  private updateTargetDisplay(): void {
    if (!this.minigame) {return;}

    const target = this.minigame.targetSequence;
    for (let i = 0; i < target.length; i++) {
      const text = this.targetDigitTexts[i];
      if (text) {
        text.text = String(target[i] ?? '-');
      }
    }
  }

  /**
   * Update the input sequence display.
   */
  private updateInputDisplay(): void {
    if (!this.minigame) {return;}

    const input = this.minigame.inputSequence;
    const currentPos = this.minigame.currentPosition;
    const length = this.minigame.sequenceLength;

    for (let i = 0; i < length; i++) {
      const text = this.inputDigitTexts[i];
      const box = this.inputDigitBoxes[i];

      if (!text || !box) {continue;}

      if (i < input.length) {
        // Completed position - show entered digit
        text.text = String(input[i]);
        text.style = terminalBrightStyle;
        this.updateBoxStyle(box, 'correct');
      } else if (i === currentPos) {
        // Current position - show cursor
        text.text = '_';
        text.style = terminalStyle;
        this.updateBoxStyle(box, 'active');
      } else {
        // Future position
        text.text = '_';
        text.style = terminalDimStyle;
        this.updateBoxStyle(box, 'inactive');
      }
    }
  }

  /**
   * Update a digit box's visual style.
   */
  private updateBoxStyle(box: Graphics, state: 'inactive' | 'active' | 'correct' | 'wrong'): void {
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

    box.rect(-LAYOUT.DIGIT_BOX_SIZE / 2, 0, LAYOUT.DIGIT_BOX_SIZE, LAYOUT.DIGIT_BOX_SIZE);
    box.stroke({ color, width: strokeWidth });
  }

  /**
   * Update the stats display.
   */
  private updateStats(): void {
    if (!this.minigame) {return;}

    // Timer
    if (this.timerText) {
      this.timerText.text = formatTimeMMSS(this.minigame.timeRemainingMs);

      // Flash red when low on time
      if (this.minigame.timeRemainingMs <= 10000) {
        this.timerText.style = createTerminalStyle(COLORS.TERMINAL_RED, 20);
      } else {
        this.timerText.style = hudStyle;
      }
    }

    // Combo
    if (this.comboText) {
      this.comboText.text = formatCombo(this.minigame.combo);

      // Highlight high combos
      if (this.minigame.combo >= 5) {
        this.comboText.style = createTerminalStyle(COLORS.TERMINAL_YELLOW, 20, true);
      } else {
        this.comboText.style = comboStyle;
      }
    }

    // Score
    if (this.scoreText) {
      this.scoreText.text = String(this.minigame.score);
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

    // Handle sequence complete (for visual feedback)
    const unsubSequence = this.minigame.on('sequence-complete' as 'end', () => {
      // Flash effect could go here
      this.updateDisplay();
    });
    this.unsubscribers.push(unsubSequence);
  }

  /**
   * Handle game completion.
   */
  private handleGameEnd(): void {
    if (!this.minigame) {return;}

    this.showingResults = true;

    // Get final stats
    const stats = this.minigame.getFinalStats();
    const moneyReward = this.minigame.calculateMoneyReward();

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
    this.showResultsOverlay(stats, moneyReward);
  }

  /**
   * Check if score qualifies as a new top score.
   */
  private isNewTopScore(score: number): boolean {
    const minigameState = this.game.store.getState().minigames['code-breaker'];
    if (!minigameState) {return true;}

    const topScores = minigameState.topScores;
    if (topScores.length < 5) {return true;}

    const lowestTop = Number(topScores[topScores.length - 1] ?? 0);
    return score > lowestTop;
  }

  /**
   * Show the results overlay.
   */
  private showResultsOverlay(
    stats: { score: number; maxCombo: number; durationMs: number; successCount: number; failCount: number },
    moneyReward: string
  ): void {
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
    const boxHeight = 320;
    const boxX = (width - boxWidth) / 2;
    const boxY = (height - boxHeight) / 2;

    // Box fill
    const boxFill = new Graphics();
    boxFill.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
    boxFill.fill({ color: COLORS.BACKGROUND });
    this.resultsOverlay.addChild(boxFill);

    // Box border (separate Graphics to avoid artifacts)
    const boxBorder = new Graphics();
    boxBorder.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
    boxBorder.stroke({ color: COLORS.TERMINAL_GREEN, width: 2 });
    this.resultsOverlay.addChild(boxBorder);

    // Title
    const title = new Text({
      text: 'GAME OVER',
      style: titleStyle,
    });
    title.anchor.set(0.5, 0);
    title.x = width / 2;
    title.y = boxY + 20;
    this.resultsOverlay.addChild(title);

    // Final Score
    const scoreLabel = new Text({
      text: 'FINAL SCORE',
      style: terminalDimStyle,
    });
    scoreLabel.anchor.set(0.5, 0);
    scoreLabel.x = width / 2;
    scoreLabel.y = boxY + 70;
    this.resultsOverlay.addChild(scoreLabel);

    const finalScore = new Text({
      text: String(stats.score),
      style: scoreStyle,
    });
    finalScore.anchor.set(0.5, 0);
    finalScore.x = width / 2;
    finalScore.y = boxY + 95;
    this.resultsOverlay.addChild(finalScore);

    // Stats
    const statsY = boxY + 150;

    const maxComboText = new Text({
      text: `Max Combo: ${formatCombo(stats.maxCombo)}`,
      style: terminalStyle,
    });
    maxComboText.anchor.set(0.5, 0);
    maxComboText.x = width / 2;
    maxComboText.y = statsY;
    this.resultsOverlay.addChild(maxComboText);

    const sequencesText = new Text({
      text: `Sequences: ${stats.successCount}`,
      style: terminalStyle,
    });
    sequencesText.anchor.set(0.5, 0);
    sequencesText.x = width / 2;
    sequencesText.y = statsY + 25;
    this.resultsOverlay.addChild(sequencesText);

    // Money earned
    const moneyText = new Text({
      text: `Money Earned: $${moneyReward}`,
      style: terminalBrightStyle,
    });
    moneyText.anchor.set(0.5, 0);
    moneyText.x = width / 2;
    moneyText.y = statsY + 60;
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

    // Digit keys (0-9)
    for (let i = 0; i <= 9; i++) {
      const digit = i;
      bindings.set(`Digit${digit}`, {
        onPress: () => this.handleDigitPress(digit),
      });
      bindings.set(`Numpad${digit}`, {
        onPress: () => this.handleDigitPress(digit),
      });
    }

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
   * Handle digit key press.
   */
  private handleDigitPress(digit: number): void {
    if (this.showingResults) {
      return;
    }

    if (!this.minigame?.isPlaying) {
      return;
    }

    const feedback = this.minigame.handleDigitInput(digit);

    // Visual feedback based on result
    if (feedback === 'correct') {
      // Flash success (could add animation here)
    } else if (feedback === 'wrong' || feedback === 'wrong-position') {
      // Flash error (could add animation here)
    }

    this.updateDisplay();
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
 * Create a new Code Breaker scene.
 *
 * @param game - The game instance
 * @returns A new CodeBreakerScene
 */
export function createCodeBreakerScene(game: GameInstance): Scene {
  return new CodeBreakerScene(game as Game);
}
