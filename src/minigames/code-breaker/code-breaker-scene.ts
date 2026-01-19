/**
 * Code Breaker PixiJS Scene
 *
 * This module handles the visual rendering and input handling for the
 * Code Breaker minigame. It creates the terminal-styled UI with the
 * target sequence, input display, timer, combo, and score.
 *
 * Visual Layout:
 * +------------------------------------------+
 * |  TARGET: 7 3 9 2 4                       |
 * |  INPUT:  _ _ _ _ _                       |
 * |                                          |
 * |  [1] [2] [3] [4] [5] [6] [7] [8] [9] [0] |
 * |                                          |
 * |  TIME: 00:45    COMBO: x3    SCORE: 1250 |
 * +------------------------------------------+
 *
 * Usage:
 *   import { createCodeBreakerScene } from './code-breaker-scene';
 *
 *   const scene = createCodeBreakerScene({
 *     onComplete: (result) => { ... },
 *     onExit: () => { ... }
 *   });
 *
 *   sceneManager.register('code-breaker', scene);
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { type Scene } from '../../ui/scenes/scene-manager';
import { CodeBreaker, createCodeBreaker } from './code-breaker';
import { formatTime, formatCombo, type MinigameResult } from '../base-minigame';
import { useGameStore } from '../../core/game-state';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  TERMINAL_GREEN,
  TERMINAL_DIM,
  TERMINAL_BRIGHT,
  TERMINAL_RED,
  colorToHex,
} from '../../ui/renderer';
import {
  MONOSPACE_FONT,
  createTerminalText,
  STYLES,
} from '../../ui/styles';

// ============================================================================
// Configuration
// ============================================================================

/** Spacing between digit boxes */
const DIGIT_SPACING = 50;

/** Size of digit boxes */
const DIGIT_BOX_SIZE = 40;

/** Y position for the target sequence */
const TARGET_Y = 150;

/** Y position for the input sequence */
const INPUT_Y = 220;

/** Y position for the keyboard hint */
const KEYBOARD_Y = 320;

/** Y position for the stats bar */
const STATS_Y = 420;

// ============================================================================
// Scene Callbacks
// ============================================================================

/**
 * Options for creating the Code Breaker scene.
 */
export interface CodeBreakerSceneOptions {
  /**
   * Called when the minigame is completed.
   * @param result - The final result of the minigame session
   */
  onComplete?: (result: MinigameResult) => void;

  /**
   * Called when the player exits the minigame (via Escape).
   */
  onExit?: () => void;
}

// ============================================================================
// Style Helpers
// ============================================================================

/**
 * Create a glow-effect TextStyle.
 */
function createGlowStyle(
  fontSize: number,
  fillColor: number,
  glowColor: number,
  bold = false
): TextStyle {
  return new TextStyle({
    fontFamily: MONOSPACE_FONT,
    fontSize,
    fill: colorToHex(fillColor),
    fontWeight: bold ? 'bold' : 'normal',
    dropShadow: {
      color: colorToHex(glowColor),
      blur: 4,
      alpha: 0.8,
      distance: 0,
    },
  });
}

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Create the Code Breaker scene with all UI elements.
 */
export function createCodeBreakerScene(options: CodeBreakerSceneOptions = {}): Scene {
  // Container for all scene elements
  const container = new Container();
  container.label = 'code-breaker-scene';

  // Game instance
  let game: CodeBreaker | null = null;

  // UI Element references
  let targetTexts: Text[] = [];
  let inputTexts: Text[] = [];
  let timerText: Text | null = null;
  let comboText: Text | null = null;
  let scoreText: Text | null = null;
  let statusText: Text | null = null;
  let keyboardHints: Container | null = null;

  // Input handler reference for cleanup
  let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  // Flash effect state (for future visual feedback implementation)
  let flashTimer = 0;

  // ========================================================================
  // UI Creation
  // ========================================================================

  /**
   * Create the scene background and border.
   */
  function createBackground(): Graphics {
    const graphics = new Graphics();

    // Main background
    graphics.fill({ color: 0x0a0a0a, alpha: 0.95 });
    graphics.roundRect(50, 50, CANVAS_WIDTH - 100, CANVAS_HEIGHT - 100, 8);
    graphics.fill();

    // Border
    graphics.stroke({ color: TERMINAL_GREEN, width: 2 });
    graphics.roundRect(50, 50, CANVAS_WIDTH - 100, CANVAS_HEIGHT - 100, 8);
    graphics.stroke();

    // Header line
    graphics.stroke({ color: TERMINAL_DIM, width: 1 });
    graphics.moveTo(50, 110);
    graphics.lineTo(CANVAS_WIDTH - 50, 110);
    graphics.stroke();

    return graphics;
  }

  /**
   * Create the header with title.
   */
  function createHeader(): Container {
    const headerContainer = new Container();

    const title = createTerminalText('CODE BREAKER', STYLES.header);
    title.x = CANVAS_WIDTH / 2;
    title.y = 75;
    title.anchor.set(0.5);
    headerContainer.addChild(title);

    return headerContainer;
  }

  /**
   * Create the target sequence display.
   */
  function createTargetDisplay(): Container {
    const targetContainer = new Container();
    targetContainer.label = 'target-display';

    // Label
    const label = createTerminalText('TARGET:', STYLES.dim);
    label.x = 100;
    label.y = TARGET_Y;
    targetContainer.addChild(label);

    // Calculate starting X for centered digits
    const startX = (CANVAS_WIDTH - (5 * DIGIT_SPACING)) / 2;

    // Digit boxes and texts
    targetTexts = [];
    for (let i = 0; i < 5; i++) {
      // Box
      const box = new Graphics();
      box.stroke({ color: TERMINAL_DIM, width: 1 });
      box.rect(startX + i * DIGIT_SPACING, TARGET_Y - 5, DIGIT_BOX_SIZE, DIGIT_BOX_SIZE);
      box.stroke();
      targetContainer.addChild(box);

      // Text
      const digitStyle = createGlowStyle(24, TERMINAL_BRIGHT, TERMINAL_GREEN);

      const text = new Text({ text: '-', style: digitStyle });
      text.x = startX + i * DIGIT_SPACING + DIGIT_BOX_SIZE / 2;
      text.y = TARGET_Y + DIGIT_BOX_SIZE / 2 - 5;
      text.anchor.set(0.5);
      targetContainer.addChild(text);
      targetTexts.push(text);
    }

    return targetContainer;
  }

  /**
   * Create the input sequence display.
   */
  function createInputDisplay(): Container {
    const inputContainer = new Container();
    inputContainer.label = 'input-display';

    // Label
    const label = createTerminalText('INPUT:', STYLES.dim);
    label.x = 100;
    label.y = INPUT_Y;
    inputContainer.addChild(label);

    // Calculate starting X for centered digits
    const startX = (CANVAS_WIDTH - (5 * DIGIT_SPACING)) / 2;

    // Input boxes and texts
    inputTexts = [];
    for (let i = 0; i < 5; i++) {
      // Box (will be styled dynamically)
      const box = new Graphics();
      box.label = `input-box-${i}`;
      box.stroke({ color: TERMINAL_DIM, width: 1 });
      box.rect(startX + i * DIGIT_SPACING, INPUT_Y - 5, DIGIT_BOX_SIZE, DIGIT_BOX_SIZE);
      box.stroke();
      inputContainer.addChild(box);

      // Text (underscore for empty)
      const digitStyle = createGlowStyle(24, TERMINAL_GREEN, TERMINAL_GREEN);

      const text = new Text({ text: '_', style: digitStyle });
      text.x = startX + i * DIGIT_SPACING + DIGIT_BOX_SIZE / 2;
      text.y = INPUT_Y + DIGIT_BOX_SIZE / 2 - 5;
      text.anchor.set(0.5);
      inputContainer.addChild(text);
      inputTexts.push(text);
    }

    return inputContainer;
  }

  /**
   * Create the keyboard hint display.
   */
  function createKeyboardHints(): Container {
    keyboardHints = new Container();
    keyboardHints.label = 'keyboard-hints';

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    const startX = (CANVAS_WIDTH - (keys.length * 35)) / 2;

    for (let i = 0; i < keys.length; i++) {
      // Key box
      const box = new Graphics();
      box.fill({ color: 0x1a1a1a });
      box.roundRect(startX + i * 35, KEYBOARD_Y, 30, 30, 4);
      box.fill();
      box.stroke({ color: TERMINAL_DIM, width: 1 });
      box.roundRect(startX + i * 35, KEYBOARD_Y, 30, 30, 4);
      box.stroke();
      keyboardHints.addChild(box);

      // Key label
      const keyText = createTerminalText(keys[i] ?? '0', STYLES.small);
      keyText.x = startX + i * 35 + 15;
      keyText.y = KEYBOARD_Y + 15;
      keyText.anchor.set(0.5);
      keyboardHints.addChild(keyText);
    }

    return keyboardHints;
  }

  /**
   * Create the stats bar (timer, combo, score).
   */
  function createStatsBar(): Container {
    const statsContainer = new Container();
    statsContainer.label = 'stats-bar';

    // Timer
    const timerLabel = createTerminalText('TIME:', STYLES.dim);
    timerLabel.x = 100;
    timerLabel.y = STATS_Y;
    statsContainer.addChild(timerLabel);

    timerText = createTerminalText('01:00', STYLES.value);
    timerText.x = 170;
    timerText.y = STATS_Y;
    statsContainer.addChild(timerText);

    // Combo
    const comboLabel = createTerminalText('COMBO:', STYLES.dim);
    comboLabel.x = CANVAS_WIDTH / 2 - 80;
    comboLabel.y = STATS_Y;
    statsContainer.addChild(comboLabel);

    comboText = createTerminalText('x1', STYLES.value);
    comboText.x = CANVAS_WIDTH / 2 + 10;
    comboText.y = STATS_Y;
    statsContainer.addChild(comboText);

    // Score
    const scoreLabel = createTerminalText('SCORE:', STYLES.dim);
    scoreLabel.x = CANVAS_WIDTH - 250;
    scoreLabel.y = STATS_Y;
    statsContainer.addChild(scoreLabel);

    scoreText = createTerminalText('0', STYLES.value);
    scoreText.x = CANVAS_WIDTH - 160;
    scoreText.y = STATS_Y;
    statsContainer.addChild(scoreText);

    return statsContainer;
  }

  /**
   * Create the status/instruction text.
   */
  function createStatusDisplay(): Text {
    statusText = createTerminalText('Press any key to start...', STYLES.dim);
    statusText.x = CANVAS_WIDTH / 2;
    statusText.y = INPUT_Y + 70;
    statusText.anchor.set(0.5);
    return statusText;
  }

  /**
   * Create the results overlay.
   */
  function createResultsOverlay(result: MinigameResult): Container {
    const overlay = new Container();
    overlay.label = 'results-overlay';

    // Background
    const bg = new Graphics();
    bg.fill({ color: 0x0a0a0a, alpha: 0.9 });
    bg.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    bg.fill();
    overlay.addChild(bg);

    // Results box
    const box = new Graphics();
    box.fill({ color: 0x0a0a0a });
    box.roundRect(CANVAS_WIDTH / 2 - 200, 150, 400, 300, 8);
    box.fill();
    box.stroke({ color: TERMINAL_GREEN, width: 2 });
    box.roundRect(CANVAS_WIDTH / 2 - 200, 150, 400, 300, 8);
    box.stroke();
    overlay.addChild(box);

    // Title
    const title = createTerminalText('GAME OVER', STYLES.header);
    title.x = CANVAS_WIDTH / 2;
    title.y = 180;
    title.anchor.set(0.5);
    overlay.addChild(title);

    // Score
    const scoreLabel = createTerminalText('FINAL SCORE:', STYLES.dim);
    scoreLabel.x = CANVAS_WIDTH / 2;
    scoreLabel.y = 230;
    scoreLabel.anchor.set(0.5);
    overlay.addChild(scoreLabel);

    const finalScoreStyle = createGlowStyle(36, TERMINAL_BRIGHT, TERMINAL_GREEN, true);
    const finalScore = new Text({ text: String(result.score), style: finalScoreStyle });
    finalScore.x = CANVAS_WIDTH / 2;
    finalScore.y = 270;
    finalScore.anchor.set(0.5);
    overlay.addChild(finalScore);

    // Stats
    const statsY = 320;
    const maxCombo = createTerminalText(`Max Combo: ${formatCombo(result.maxCombo)}`, STYLES.primary);
    maxCombo.x = CANVAS_WIDTH / 2;
    maxCombo.y = statsY;
    maxCombo.anchor.set(0.5);
    overlay.addChild(maxCombo);

    const sequences = createTerminalText(`Sequences: ${result.successCount}`, STYLES.primary);
    sequences.x = CANVAS_WIDTH / 2;
    sequences.y = statsY + 25;
    sequences.anchor.set(0.5);
    overlay.addChild(sequences);

    // Money earned
    const moneyEarned = result.rewards.money ?? '0';
    const moneyText = createTerminalText(`Money Earned: $${moneyEarned}`, STYLES.bright);
    moneyText.x = CANVAS_WIDTH / 2;
    moneyText.y = statsY + 60;
    moneyText.anchor.set(0.5);
    overlay.addChild(moneyText);

    // Instructions
    const instruction = createTerminalText('Press ENTER to continue or ESC to exit', STYLES.small);
    instruction.x = CANVAS_WIDTH / 2;
    instruction.y = 420;
    instruction.anchor.set(0.5);
    overlay.addChild(instruction);

    return overlay;
  }

  // ========================================================================
  // UI Updates
  // ========================================================================

  /**
   * Update the target sequence display.
   */
  function updateTargetDisplay(): void {
    if (!game) return;

    const target = game.targetSequence;
    for (let i = 0; i < 5; i++) {
      const textEl = targetTexts[i];
      if (textEl) {
        textEl.text = target[i]?.toString() ?? '-';
      }
    }
  }

  /**
   * Update the input sequence display.
   */
  function updateInputDisplay(): void {
    if (!game) return;

    const input = game.inputSequence;
    const currentPos = game.currentPosition;

    for (let i = 0; i < 5; i++) {
      const textEl = inputTexts[i];
      if (textEl) {
        if (i < input.length) {
          // Show entered digit
          textEl.text = (input[i] ?? 0).toString();
          textEl.style.fill = colorToHex(TERMINAL_BRIGHT);
        } else if (i === currentPos) {
          // Current position - blinking cursor
          textEl.text = '_';
          textEl.style.fill = colorToHex(TERMINAL_GREEN);
        } else {
          // Future positions
          textEl.text = '_';
          textEl.style.fill = colorToHex(TERMINAL_DIM);
        }
      }
    }
  }

  /**
   * Update the stats display.
   */
  function updateStats(): void {
    if (!game) return;

    if (timerText) {
      timerText.text = formatTime(game.timeRemainingMs);

      // Flash red when low on time
      if (game.timeRemainingMs <= 10000) {
        timerText.style.fill = colorToHex(TERMINAL_RED);
      } else {
        timerText.style.fill = colorToHex(TERMINAL_BRIGHT);
      }
    }

    if (comboText) {
      comboText.text = formatCombo(game.combo);

      // Highlight high combos
      if (game.combo >= 3) {
        comboText.style.fill = colorToHex(TERMINAL_BRIGHT);
      } else {
        comboText.style.fill = colorToHex(TERMINAL_GREEN);
      }
    }

    if (scoreText) {
      scoreText.text = String(game.score);
    }
  }

  /**
   * Update the status text.
   */
  function updateStatus(text: string): void {
    if (statusText) {
      statusText.text = text;
    }
  }

  /**
   * Flash the screen for feedback.
   * Note: Visual flash effect not yet implemented, but this sets up timing.
   */
  function flashScreen(_color: number, duration = 100): void {
    // Future: Use color to flash the screen or highlight elements
    flashTimer = duration;
  }

  // ========================================================================
  // Game Flow
  // ========================================================================

  /**
   * Start a new game.
   */
  function startGame(): void {
    if (!game) {
      game = createCodeBreaker();
    }

    game.start();
    updateTargetDisplay();
    updateInputDisplay();
    updateStats();
    updateStatus('Type the numbers to match the sequence!');
  }

  /**
   * Handle game completion.
   */
  function handleGameComplete(result: MinigameResult): void {
    // Record score to game state
    const store = useGameStore.getState();
    store.recordScore('code-breaker', String(result.score));
    store.incrementPlayCount('code-breaker');

    // Award money
    const moneyReward = result.rewards.money ?? '0';
    store.addResource('money', moneyReward);
    store.trackResourceEarned('money', moneyReward);

    // Show results overlay
    const overlay = createResultsOverlay(result);
    container.addChild(overlay);

    // Update status
    updateStatus('');

    // Call completion callback
    if (options.onComplete) {
      options.onComplete(result);
    }
  }

  // ========================================================================
  // Input Handling
  // ========================================================================

  function setupInputHandler(): void {
    keydownHandler = (event: KeyboardEvent) => {
      if (!game) return;

      const key = event.key;

      // Handle escape to exit
      if (key === 'Escape') {
        if (game.phase === 'playing') {
          game.end();
        }
        if (options.onExit) {
          options.onExit();
        }
        return;
      }

      // Handle enter to restart after game over
      if (key === 'Enter' && game.phase === 'ended') {
        // Remove results overlay
        const overlay = container.getChildByLabel('results-overlay');
        if (overlay) {
          container.removeChild(overlay);
          overlay.destroy({ children: true });
        }

        // Start new game
        startGame();
        return;
      }

      // Handle number input during gameplay
      if (game.phase === 'playing' && /^[0-9]$/.test(key)) {
        const wasCorrect = game.lastInputCorrect;
        game.handleInput(key);

        // Visual feedback
        if (game.lastInputCorrect) {
          flashScreen(TERMINAL_GREEN);
        } else if (game.lastInputCorrect === false && wasCorrect !== false) {
          flashScreen(TERMINAL_RED);
        }

        // Check for sequence completion (target changed)
        updateTargetDisplay();
        updateInputDisplay();
        updateStats();
      }

      // Start game on first input if ready
      if (game.phase === 'ready' && /^[0-9]$/.test(key)) {
        startGame();
        game.handleInput(key);
        updateInputDisplay();
        updateStats();
      }
    };

    window.addEventListener('keydown', keydownHandler);
  }

  function removeInputHandler(): void {
    if (keydownHandler) {
      window.removeEventListener('keydown', keydownHandler);
      keydownHandler = null;
    }
  }

  // ========================================================================
  // Scene Lifecycle
  // ========================================================================

  const scene: Scene = {
    container,

    onEnter: () => {
      // Build the UI
      container.addChild(createBackground());
      container.addChild(createHeader());
      container.addChild(createTargetDisplay());
      container.addChild(createInputDisplay());
      container.addChild(createKeyboardHints());
      container.addChild(createStatsBar());
      container.addChild(createStatusDisplay());

      // Initialize game
      game = createCodeBreaker();

      // Setup input
      setupInputHandler();

      // Subscribe to game events
      game.on('end', () => {
        if (game) {
          handleGameComplete(game.getCurrentResult());
        }
      });

      game.on('sequence-complete', () => {
        updateTargetDisplay();
        updateInputDisplay();
      });

      console.log('Code Breaker scene entered');
    },

    onExit: () => {
      removeInputHandler();

      if (game) {
        if (game.phase === 'playing') {
          game.end();
        }
        game.destroy();
        game = null;
      }

      // Clear text references
      targetTexts = [];
      inputTexts = [];
      timerText = null;
      comboText = null;
      scoreText = null;
      statusText = null;
      keyboardHints = null;

      // Clear container children
      while (container.children.length > 0) {
        const child = container.children[0];
        if (child) {
          container.removeChild(child);
          child.destroy({ children: true });
        }
      }

      console.log('Code Breaker scene exited');
    },

    onUpdate: (delta: number) => {
      if (!game) return;

      // Update game logic
      game.update(delta);

      // Update flash effect timer
      if (flashTimer > 0) {
        flashTimer -= delta;
      }

      // Update displays if game is running
      if (game.phase === 'playing') {
        updateInputDisplay();
        updateStats();
      }
    },

    onDestroy: () => {
      removeInputHandler();

      if (game) {
        game.destroy();
        game = null;
      }
    },
  };

  return scene;
}
