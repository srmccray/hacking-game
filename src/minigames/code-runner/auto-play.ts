/**
 * Code Runner Auto-Play Controller
 *
 * AI controller that drives Code Runner input automatically.
 * Scans upcoming obstacles, calculates gap centers, and sets
 * left/right movement input with level-dependent reaction
 * distance and targeting accuracy/jitter.
 *
 * AI Level Parameters:
 * | Level | Reaction Distance (px) | Targeting Accuracy | Jitter   |
 * |-------|------------------------|-------------------|----------|
 * | 1     | 80                     | 60%               | High     |
 * | 2     | 120                    | 70%               | Medium   |
 * | 3     | 160                    | 80%               | Low      |
 * | 4     | 200                    | 90%               | Minimal  |
 * | 5     | 250                    | 95%               | None     |
 *
 * Usage:
 *   const controller = createCodeRunnerAutoPlay(game, 3, 800);
 *   // In game loop:
 *   controller.update(deltaMs);
 *   // On cleanup:
 *   controller.destroy();
 */

import type { AutoPlayController } from '../code-breaker/auto-play';
import type { CodeRunnerGame, Obstacle } from './CodeRunnerGame';

// ============================================================================
// Level Configuration
// ============================================================================

/**
 * Parameters for a single AI level.
 */
interface AILevelParams {
  /** How far above the player (in px) the AI starts reacting to an obstacle */
  reactionDistance: number;
  /** 0.0-1.0: how close to the true gap center the AI aims (1.0 = perfect) */
  targetingAccuracy: number;
  /** Amplitude of random left/right oscillation in pixels (0 = none) */
  jitterAmplitude: number;
  /** How often jitter re-rolls a new offset, in milliseconds */
  jitterIntervalMs: number;
}

/**
 * AI level configurations indexed by level (1-5).
 * Index 0 is unused; levels start at 1.
 */
const AI_LEVEL_PARAMS: readonly AILevelParams[] = [
  // Index 0: placeholder (unused)
  { reactionDistance: 0, targetingAccuracy: 0, jitterAmplitude: 0, jitterIntervalMs: 0 },
  // Level 1: Short reaction, poor aim, high jitter
  { reactionDistance: 80, targetingAccuracy: 0.60, jitterAmplitude: 40, jitterIntervalMs: 150 },
  // Level 2: Medium reaction, decent aim, medium jitter
  { reactionDistance: 120, targetingAccuracy: 0.70, jitterAmplitude: 25, jitterIntervalMs: 200 },
  // Level 3: Good reaction, good aim, low jitter
  { reactionDistance: 160, targetingAccuracy: 0.80, jitterAmplitude: 12, jitterIntervalMs: 300 },
  // Level 4: Long reaction, great aim, minimal jitter
  { reactionDistance: 200, targetingAccuracy: 0.90, jitterAmplitude: 4, jitterIntervalMs: 500 },
  // Level 5: Maximum reaction, near-perfect aim, no jitter
  { reactionDistance: 250, targetingAccuracy: 0.95, jitterAmplitude: 0, jitterIntervalMs: 0 },
];

/**
 * Dead-zone in pixels: if the player is within this distance of the target,
 * the AI stops issuing movement input to avoid oscillating.
 */
const MOVEMENT_DEAD_ZONE = 4;

// ============================================================================
// Implementation
// ============================================================================

/**
 * Code Runner auto-play controller implementation.
 *
 * Each frame, scans obstacles from the game state, finds the nearest
 * obstacle within the AI's reaction distance above the player, computes
 * the gap center (with accuracy offset), adds jitter, and calls
 * game.setInput(left, right) to steer the player.
 */
class CodeRunnerAutoPlayController implements AutoPlayController {
  readonly level: number;

  private readonly game: CodeRunnerGame;
  private readonly params: AILevelParams;
  private readonly canvasWidth: number;

  /** Whether the controller has been destroyed */
  private destroyed: boolean = false;

  /**
   * A fixed random offset applied to the gap center target.
   * Represents the AI's "inaccuracy" -- rolled once per obstacle.
   * Keyed by obstacle ID to keep a stable offset per obstacle.
   */
  private targetOffsets: Map<number, number> = new Map();

  /** Current jitter offset in pixels */
  private jitterOffset: number = 0;

  /** Time accumulated since the last jitter re-roll */
  private jitterTimer: number = 0;

  constructor(game: CodeRunnerGame, level: number, canvasWidth: number) {
    this.game = game;
    this.canvasWidth = canvasWidth;

    // Clamp level to valid range
    const clampedLevel = Math.max(1, Math.min(5, level));
    this.level = clampedLevel;
    this.params = AI_LEVEL_PARAMS[clampedLevel]!;
  }

  update(deltaMs: number): void {
    if (this.destroyed) return;

    // Only act while the game is actively playing
    if (!this.game.isPlaying) return;

    const state = this.game.getState();

    // Update jitter
    this.updateJitter(deltaMs);

    // Find the nearest obstacle within reaction distance above the player
    const target = this.findTargetObstacle(state.obstacles, state.playerY);

    let targetX: number;

    if (target !== null) {
      // Compute gap center for this obstacle
      const gapCenter = this.computeGapCenter(target);

      // Apply accuracy offset (stable per obstacle)
      targetX = this.applyAccuracyOffset(target, gapCenter);

      // Apply jitter
      targetX += this.jitterOffset;
    } else {
      // No obstacle in range: drift toward center of the canvas
      targetX = this.canvasWidth / 2 + this.jitterOffset;
    }

    // Determine movement input
    const dx = targetX - state.playerX;

    if (Math.abs(dx) < MOVEMENT_DEAD_ZONE) {
      // Close enough -- stop moving
      this.game.setInput(false, false);
    } else if (dx < 0) {
      this.game.setInput(true, false);
    } else {
      this.game.setInput(false, true);
    }

    // Clean up stale target offsets for obstacles that no longer exist
    this.pruneTargetOffsets(state.obstacles);
  }

  destroy(): void {
    this.destroyed = true;
    this.targetOffsets.clear();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Find the nearest obstacle that is above the player and within
   * the AI's reaction distance.
   *
   * Obstacles scroll downward (increasing Y). An obstacle is "above"
   * the player when obstacle.y + obstacle.height < playerY (the bottom
   * edge of the obstacle is above the player). We look for obstacles
   * whose bottom edge is within reactionDistance pixels above the player.
   *
   * Returns null if no obstacle qualifies.
   */
  private findTargetObstacle(
    obstacles: readonly Obstacle[],
    playerY: number,
  ): Obstacle | null {
    let nearest: Obstacle | null = null;
    let nearestDistance = Infinity;

    for (const obstacle of obstacles) {
      // Skip already-passed obstacles
      if (obstacle.passed) continue;

      // The obstacle bottom edge
      const obstacleBottom = obstacle.y + obstacle.height;

      // We care about obstacles whose bottom edge is above or at the player
      // (i.e., the player hasn't collided with them yet).
      // Distance = how far above the player this obstacle's bottom edge is.
      const distanceAbove = playerY - obstacleBottom;

      // Only consider obstacles that are above the player (positive distance)
      // and within reaction range
      if (distanceAbove > 0 && distanceAbove <= this.params.reactionDistance) {
        if (distanceAbove < nearestDistance) {
          nearestDistance = distanceAbove;
          nearest = obstacle;
        }
      }
    }

    return nearest;
  }

  /**
   * Compute the center X position of the gap in an obstacle.
   *
   * The gap runs from obstacle.leftWidth to (canvasWidth - obstacle.rightWidth).
   */
  private computeGapCenter(obstacle: Obstacle): number {
    const gapStart = obstacle.leftWidth;
    const gapEnd = this.canvasWidth - obstacle.rightWidth;
    return (gapStart + gapEnd) / 2;
  }

  /**
   * Apply the AI's targeting inaccuracy as a stable per-obstacle offset.
   *
   * The offset is rolled once per obstacle ID and cached so the AI
   * doesn't jitter its aim target each frame. The offset is proportional
   * to (1 - accuracy) and the gap width, so lower-level AIs aim further
   * from center.
   */
  private applyAccuracyOffset(obstacle: Obstacle, gapCenter: number): number {
    if (!this.targetOffsets.has(obstacle.id)) {
      const gapStart = obstacle.leftWidth;
      const gapEnd = this.canvasWidth - obstacle.rightWidth;
      const gapWidth = gapEnd - gapStart;

      // Maximum offset: half the gap, scaled by inaccuracy
      const inaccuracy = 1 - this.params.targetingAccuracy;
      const maxOffset = (gapWidth / 2) * inaccuracy;

      // Random offset in [-maxOffset, +maxOffset]
      const offset = (Math.random() * 2 - 1) * maxOffset;
      this.targetOffsets.set(obstacle.id, offset);
    }

    return gapCenter + this.targetOffsets.get(obstacle.id)!;
  }

  /**
   * Update the jitter oscillation.
   * At lower AI levels, re-rolls a random offset at regular intervals
   * to simulate nervous/imprecise movement.
   */
  private updateJitter(deltaMs: number): void {
    if (this.params.jitterAmplitude <= 0 || this.params.jitterIntervalMs <= 0) {
      this.jitterOffset = 0;
      return;
    }

    this.jitterTimer += deltaMs;
    if (this.jitterTimer >= this.params.jitterIntervalMs) {
      this.jitterTimer = 0;
      this.jitterOffset =
        (Math.random() * 2 - 1) * this.params.jitterAmplitude;
    }
  }

  /**
   * Remove cached target offsets for obstacles that are no longer active.
   */
  private pruneTargetOffsets(obstacles: readonly Obstacle[]): void {
    if (this.targetOffsets.size === 0) return;

    const activeIds = new Set(obstacles.map((o) => o.id));
    for (const id of this.targetOffsets.keys()) {
      if (!activeIds.has(id)) {
        this.targetOffsets.delete(id);
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Code Runner auto-play controller.
 *
 * @param game - The CodeRunnerGame instance to control
 * @param level - AI level (1-5). Values outside range are clamped.
 * @param canvasWidth - Width of the game canvas in pixels
 * @returns An AutoPlayController that drives Code Runner movement
 */
export function createCodeRunnerAutoPlay(
  game: CodeRunnerGame,
  level: number,
  canvasWidth: number,
): AutoPlayController {
  return new CodeRunnerAutoPlayController(game, level, canvasWidth);
}
