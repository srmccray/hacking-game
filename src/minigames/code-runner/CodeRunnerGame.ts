/**
 * Code Runner Game Logic
 *
 * A fall-down style endless runner minigame where obstacles scroll down
 * and the player must move left/right to avoid them through gaps.
 *
 * Features:
 * - Horizontal player movement (left/right)
 * - Obstacles spawning from top with randomized gaps
 * - AABB collision detection
 * - Wall-pass scoring (walls passed = score)
 * - Progressive difficulty (each wall increases one of three penalties)
 * - Configurable via GameConfig
 *
 * Game Rules:
 * - Player is positioned at the bottom of the screen
 * - Obstacles (horizontal bars with gaps) scroll down from the top
 * - Player must navigate through the gaps to survive
 * - Each wall passed increases score and applies a random difficulty penalty
 * - Game ends on collision with any obstacle
 * - Money reward is based on walls passed
 *
 * Usage:
 *   const game = new CodeRunnerGame(config.minigames.codeRunner, canvasWidth, canvasHeight);
 *   game.start();
 *
 *   // Handle input
 *   game.setInput(leftPressed, rightPressed);
 *
 *   // In game loop
 *   game.update(deltaMs);
 *
 *   // Get state for rendering
 *   const state = game.getState();
 */

import { BaseMinigame, type MinigameEventType } from '../BaseMinigame';
import type { CodeRunnerConfig } from '../../game/GameConfig';
import { DEFAULT_CONFIG } from '../../game/GameConfig';

// ============================================================================
// Types
// ============================================================================

/**
 * An obstacle that the player must avoid.
 * Obstacles are full-width bars with a gap somewhere in the middle.
 */
export interface Obstacle {
  /** Unique identifier for this obstacle instance */
  id: number;
  /** X position of the left edge of the left block */
  x: number;
  /** Y position of the obstacle (top edge) */
  y: number;
  /** Width of the left block (gap starts at x + leftWidth) */
  leftWidth: number;
  /** Width of the right block */
  rightWidth: number;
  /** Height of the obstacle blocks */
  height: number;
  /** Whether the player has passed this obstacle (for cleanup) */
  passed: boolean;
}

/**
 * Current state of the game for rendering.
 */
export interface CodeRunnerState {
  /** Player X position (center) */
  playerX: number;
  /** Player Y position (center) */
  playerY: number;
  /** Player hitbox dimensions */
  playerSize: { width: number; height: number };
  /** All active obstacles */
  obstacles: readonly Obstacle[];
  /** Distance traveled (score basis) */
  distance: number;
  /** Whether the game is currently playing */
  isPlaying: boolean;
}

/**
 * Events specific to Code Runner.
 */
export type CodeRunnerEventType =
  | MinigameEventType
  | 'obstacle-spawned'
  | 'obstacle-passed'
  | 'collision';

/**
 * Difficulty penalty types applied when a wall is passed.
 * Each wall randomly picks one of these three types.
 */
export type DifficultyType = 'spawn_rate' | 'gap_width' | 'player_speed';

// ============================================================================
// Code Runner Game Class
// ============================================================================

/**
 * Code Runner minigame logic.
 */
export class CodeRunnerGame extends BaseMinigame {
  readonly id = 'code-runner';

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /** Minigame configuration */
  private readonly config: CodeRunnerConfig;

  /** Game area dimensions */
  private readonly canvasWidth: number;
  private readonly canvasHeight: number;

  // ==========================================================================
  // Game State
  // ==========================================================================

  /** Player X position (center of player) */
  private _playerX: number = 0;

  /** Player Y position (center of player) - fixed near bottom */
  private _playerY: number = 0;

  /** Active obstacles on screen */
  private _obstacles: Obstacle[] = [];

  /** Distance traveled (used for scoring) */
  private _distance: number = 0;

  /** Time since last obstacle spawn (milliseconds) */
  private _spawnTimer: number = 0;

  /** Whether initial delay has passed */
  private _initialDelayPassed: boolean = false;

  /** Current input state */
  private _inputLeft: boolean = false;
  private _inputRight: boolean = false;

  /** Obstacle height constant */
  private readonly OBSTACLE_HEIGHT = 20;

  /** Counter for generating unique obstacle IDs */
  private _nextObstacleId: number = 0;

  /** Number of walls the player has passed */
  private _wallsPassed: number = 0;

  /** Accumulated spawn rate penalty from difficulty scaling (ms) */
  private _spawnRatePenalty: number = 0;

  /** Accumulated gap width penalty from difficulty scaling (px) */
  private _gapWidthPenalty: number = 0;

  /** Accumulated player speed penalty from difficulty scaling (px/s) */
  private _playerSpeedPenalty: number = 0;

  /** Bonus gap width from upgrades (in pixels) */
  private readonly _gapWidthBonus: number;

  /** Bonus wall spacing from upgrades (in pixels, converted to spawn rate increase) */
  private readonly _wallSpacingBonus: number;

  /** Bonus move speed from upgrades (in pixels/sec) */
  private readonly _moveSpeedBonus: number;

  // ==========================================================================
  // Constructor
  // ==========================================================================

  /**
   * Create a new Code Runner game.
   *
   * @param config - Configuration from GameConfig.minigames.codeRunner
   * @param canvasWidth - Width of the game area in pixels
   * @param canvasHeight - Height of the game area in pixels
   * @param gapWidthBonus - Bonus gap width from upgrades (in pixels, default 0)
   * @param wallSpacingBonus - Bonus vertical wall spacing from upgrades (in pixels, default 0)
   * @param moveSpeedBonus - Bonus player move speed from upgrades (in pixels/sec, default 0)
   */
  constructor(config?: CodeRunnerConfig, canvasWidth: number = 800, canvasHeight: number = 600, gapWidthBonus: number = 0, wallSpacingBonus: number = 0, moveSpeedBonus: number = 0) {
    super();
    this.config = config ?? DEFAULT_CONFIG.minigames.codeRunner;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this._gapWidthBonus = gapWidthBonus;
    this._wallSpacingBonus = wallSpacingBonus;
    this._moveSpeedBonus = moveSpeedBonus;

    // Initialize player position
    this._playerX = canvasWidth / 2;
    this._playerY = canvasHeight - 80; // Near bottom with some margin
  }

  // ==========================================================================
  // Public Getters
  // ==========================================================================

  /** Get the player's X position */
  get playerX(): number {
    return this._playerX;
  }

  /** Get the player's Y position */
  get playerY(): number {
    return this._playerY;
  }

  /** Get the current obstacles (read-only copy) */
  get obstacles(): readonly Obstacle[] {
    return this._obstacles;
  }

  /** Get the distance traveled */
  get distance(): number {
    return this._distance;
  }

  /** Get the number of walls passed */
  get wallsPassed(): number {
    return this._wallsPassed;
  }

  /** Get the player hitbox size */
  get playerSize(): { width: number; height: number } {
    return { ...this.config.playerHitboxSize };
  }

  // ==========================================================================
  // Lifecycle Implementation
  // ==========================================================================

  protected onStart(): void {
    // Reset player to center
    this._playerX = this.canvasWidth / 2;
    this._playerY = this.canvasHeight - 80;

    // Clear obstacles and reset state
    this._obstacles = [];
    this._distance = 0;
    this._spawnTimer = 0;
    this._initialDelayPassed = false;
    this._inputLeft = false;
    this._inputRight = false;
    this._nextObstacleId = 0;
    this._wallsPassed = 0;
    this._spawnRatePenalty = 0;
    this._gapWidthPenalty = 0;
    this._playerSpeedPenalty = 0;
  }

  protected onEnd(): void {
    // Calculate and emit final stats
    this._inputLeft = false;
    this._inputRight = false;
  }

  protected onUpdate(deltaMs: number): void {
    // Convert delta to seconds for physics calculations
    const deltaSec = deltaMs / 1000;

    // Update player movement
    this.updatePlayerMovement(deltaSec);

    // Update obstacles (movement and spawning)
    this.updateObstacles(deltaSec, deltaMs);

    // Update distance based on scroll speed
    this._distance += this.config.scrollSpeed * deltaSec;

    // Check collisions
    if (this.checkCollisions()) {
      this.emit('collision' as MinigameEventType, {
        minigameId: this.id,
        data: {
          distance: this._distance,
          playerX: this._playerX,
        },
      });
      this.end();
    }

    // Score is based on walls passed
    this._score = this._wallsPassed;
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Set the current input state for player movement.
   *
   * @param left - Whether left movement is active
   * @param right - Whether right movement is active
   */
  setInput(left: boolean, right: boolean): void {
    this._inputLeft = left;
    this._inputRight = right;
  }

  // ==========================================================================
  // State Access
  // ==========================================================================

  /**
   * Get the current game state for rendering.
   * Returns a snapshot of all state needed to render the game.
   */
  getState(): CodeRunnerState {
    return {
      playerX: this._playerX,
      playerY: this._playerY,
      playerSize: { ...this.config.playerHitboxSize },
      obstacles: [...this._obstacles],
      distance: this._distance,
      isPlaying: this.isPlaying,
    };
  }

  // ==========================================================================
  // Reward Calculation
  // ==========================================================================

  /**
   * Calculate the money reward based on walls passed.
   * Formula: wallsPassed * moneyPerWall
   *
   * @returns Money as a string (for Decimal compatibility)
   */
  calculateMoneyReward(): string {
    const money = this._wallsPassed * this.config.moneyPerWall;
    return String(money);
  }

  // ==========================================================================
  // Private Methods - Player Movement
  // ==========================================================================

  /**
   * Update player position based on input.
   */
  private updatePlayerMovement(deltaSec: number): void {
    // Calculate movement direction
    let moveDir = 0;
    if (this._inputLeft) {
      moveDir -= 1;
    }
    if (this._inputRight) {
      moveDir += 1;
    }

    // Apply movement (subtract difficulty penalty, clamp floor 80px/s)
    if (moveDir !== 0) {
      const effectiveSpeed = Math.max(80, this.config.playerSpeed + this._moveSpeedBonus - this._playerSpeedPenalty);
      this._playerX += moveDir * effectiveSpeed * deltaSec;

      // Clamp to screen bounds (accounting for player width)
      const halfWidth = this.config.playerHitboxSize.width / 2;
      this._playerX = Math.max(halfWidth, Math.min(this.canvasWidth - halfWidth, this._playerX));
    }
  }

  // ==========================================================================
  // Private Methods - Obstacle Management
  // ==========================================================================

  /**
   * Update obstacle positions and spawn new obstacles.
   */
  private updateObstacles(deltaSec: number, deltaMs: number): void {
    // Move existing obstacles down
    for (const obstacle of this._obstacles) {
      obstacle.y += this.config.scrollSpeed * deltaSec;

      // Mark obstacles that have passed the player (below screen)
      if (!obstacle.passed && obstacle.y > this.canvasHeight) {
        obstacle.passed = true;
        this._wallsPassed++;

        // Apply random difficulty penalty
        const difficultyType = this.applyDifficultyPenalty();

        this.emit('obstacle-passed' as MinigameEventType, {
          minigameId: this.id,
          data: {
            distance: this._distance,
            wallsPassed: this._wallsPassed,
            difficultyType,
          },
        });
      }
    }

    // Remove obstacles that are well off-screen
    this._obstacles = this._obstacles.filter((o) => o.y < this.canvasHeight + 100);

    // Handle obstacle spawning with initial delay
    this._spawnTimer += deltaMs;

    // Calculate effective spawn rate including wall spacing bonus and difficulty penalty
    // Bonus is in pixels; convert to milliseconds: bonusMs = bonusPx / scrollSpeed * 1000
    const spacingBonusMs = this._wallSpacingBonus > 0
      ? (this._wallSpacingBonus / this.config.scrollSpeed) * 1000
      : 0;
    const effectiveSpawnRate = Math.max(400, this.config.obstacleSpawnRate + spacingBonusMs - this._spawnRatePenalty);

    if (!this._initialDelayPassed) {
      if (this._spawnTimer >= this.config.initialObstacleDelay) {
        this._initialDelayPassed = true;
        this._spawnTimer = effectiveSpawnRate; // Spawn immediately after delay
      }
    }

    if (this._initialDelayPassed && this._spawnTimer >= effectiveSpawnRate) {
      this.spawnObstacle();
      this._spawnTimer = 0;
    }
  }

  /**
   * Spawn a new obstacle at the top of the screen.
   */
  private spawnObstacle(): void {
    // Calculate gap position - ensure gap is at least gapWidth and has margins from edges
    const minGapStart = 40; // Minimum margin from left edge
    const maxGapEnd = this.canvasWidth - 40; // Minimum margin from right edge
    const gapWidth = Math.max(30, this.config.gapWidth + this._gapWidthBonus - this._gapWidthPenalty);

    // Random gap start position
    const gapStart = minGapStart + Math.random() * (maxGapEnd - gapWidth - minGapStart);
    const gapEnd = gapStart + gapWidth;

    const obstacle: Obstacle = {
      id: this._nextObstacleId++,
      x: 0,
      y: -this.OBSTACLE_HEIGHT, // Spawn above screen
      leftWidth: gapStart,
      rightWidth: this.canvasWidth - gapEnd,
      height: this.OBSTACLE_HEIGHT,
      passed: false,
    };

    this._obstacles.push(obstacle);

    this.emit('obstacle-spawned' as MinigameEventType, {
      minigameId: this.id,
      data: {
        gapStart,
        gapEnd,
        gapWidth,
      },
    });
  }

  // ==========================================================================
  // Private Methods - Difficulty Scaling
  // ==========================================================================

  /**
   * Apply a random difficulty penalty when a wall is passed.
   * Randomly picks one of three penalty types and increments it.
   *
   * @returns The difficulty type that was applied
   */
  private applyDifficultyPenalty(): DifficultyType {
    const types: DifficultyType[] = ['spawn_rate', 'gap_width', 'player_speed'];
    const chosen = types[Math.floor(Math.random() * types.length)]!;

    switch (chosen) {
      case 'spawn_rate':
        this._spawnRatePenalty += 50; // ms
        break;
      case 'gap_width':
        this._gapWidthPenalty += 3; // px
        break;
      case 'player_speed':
        this._playerSpeedPenalty += 5; // px/s
        break;
    }

    return chosen;
  }

  // ==========================================================================
  // Private Methods - Collision Detection
  // ==========================================================================

  /**
   * Check for collisions between player and obstacles.
   * Uses AABB (Axis-Aligned Bounding Box) collision detection.
   *
   * @returns true if a collision was detected
   */
  private checkCollisions(): boolean {
    const playerHalfWidth = this.config.playerHitboxSize.width / 2;
    const playerHalfHeight = this.config.playerHitboxSize.height / 2;

    // Player AABB
    const playerLeft = this._playerX - playerHalfWidth;
    const playerRight = this._playerX + playerHalfWidth;
    const playerTop = this._playerY - playerHalfHeight;
    const playerBottom = this._playerY + playerHalfHeight;

    for (const obstacle of this._obstacles) {
      // Check collision with left block
      if (
        this.aabbCollision(
          playerLeft,
          playerTop,
          playerRight,
          playerBottom,
          obstacle.x,
          obstacle.y,
          obstacle.x + obstacle.leftWidth,
          obstacle.y + obstacle.height
        )
      ) {
        return true;
      }

      // Check collision with right block
      const rightBlockX = this.canvasWidth - obstacle.rightWidth;
      if (
        this.aabbCollision(
          playerLeft,
          playerTop,
          playerRight,
          playerBottom,
          rightBlockX,
          obstacle.y,
          this.canvasWidth,
          obstacle.y + obstacle.height
        )
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * AABB collision detection between two rectangles.
   *
   * @returns true if the rectangles overlap
   */
  private aabbCollision(
    aLeft: number,
    aTop: number,
    aRight: number,
    aBottom: number,
    bLeft: number,
    bTop: number,
    bRight: number,
    bBottom: number
  ): boolean {
    return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop;
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Reset all state to initial values.
   */
  protected override resetState(): void {
    super.resetState();
    this._playerX = this.canvasWidth / 2;
    this._playerY = this.canvasHeight - 80;
    this._obstacles = [];
    this._distance = 0;
    this._spawnTimer = 0;
    this._initialDelayPassed = false;
    this._inputLeft = false;
    this._inputRight = false;
    this._nextObstacleId = 0;
    this._wallsPassed = 0;
    this._spawnRatePenalty = 0;
    this._gapWidthPenalty = 0;
    this._playerSpeedPenalty = 0;
  }

  // ==========================================================================
  // Static Helpers
  // ==========================================================================

  /**
   * Get the minigame ID constant.
   */
  static get MINIGAME_ID(): string {
    return 'code-runner';
  }

  /**
   * Calculate expected money for a given number of walls passed.
   *
   * @param wallsPassed - The number of walls passed
   * @param config - Optional config (uses default if not provided)
   * @returns Money as string
   */
  static calculateReward(wallsPassed: number, config?: CodeRunnerConfig): string {
    const moneyPerWall =
      config?.moneyPerWall ?? DEFAULT_CONFIG.minigames.codeRunner.moneyPerWall;
    return String(wallsPassed * moneyPerWall);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Code Runner game instance.
 *
 * @param config - Optional configuration override
 * @param canvasWidth - Width of the game area
 * @param canvasHeight - Height of the game area
 * @returns A new CodeRunnerGame instance
 */
export function createCodeRunnerGame(
  config?: CodeRunnerConfig,
  canvasWidth?: number,
  canvasHeight?: number,
  gapWidthBonus?: number,
  wallSpacingBonus?: number,
  moveSpeedBonus?: number
): CodeRunnerGame {
  return new CodeRunnerGame(config, canvasWidth, canvasHeight, gapWidthBonus, wallSpacingBonus, moveSpeedBonus);
}
