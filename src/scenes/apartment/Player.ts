/**
 * Player Character for the Apartment Scene
 *
 * The player is represented as an ASCII `@` character (classic roguelike style)
 * with 2D movement using arrow keys or WASD.
 *
 * Features:
 * - ASCII `@` character with terminal glow effect
 * - Smooth 2D movement
 * - Collision with scene boundaries
 * - Bounding box for collision detection
 *
 * Usage:
 *   import { Player } from './Player';
 *
 *   const player = new Player(400, 380, config.movement);
 *   apartmentContainer.addChild(player.container);
 *
 *   // In update loop:
 *   const delta = player.update(deltaMs);
 *   // After collision check:
 *   player.applyMovement(delta.deltaX, delta.deltaY);
 */

import { Container, Text, Graphics, TextStyle } from 'pixi.js';
import { COLORS } from '../../rendering/Renderer';
import { FONT_FAMILY } from '../../rendering/styles';
import type { MovementConfig } from '../../game/GameConfig';

// ============================================================================
// Constants
// ============================================================================

/** Player character symbol */
const PLAYER_SYMBOL = '@';

/** Player character font size */
const PLAYER_FONT_SIZE = 32;

// ============================================================================
// Types
// ============================================================================

/** Player input state */
export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}

/** Velocity vector for 2D movement */
export interface Velocity {
  x: number;
  y: number;
}

/** Bounding box for collision detection */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Movement boundaries */
export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ============================================================================
// Player Class
// ============================================================================

/**
 * Player character class for the apartment scene.
 */
export class Player {
  /** The PixiJS container for the player */
  readonly container: Container;

  /** Current X position */
  x: number;

  /** Current Y position */
  y: number;

  /** Current velocity */
  velocity: Velocity = { x: 0, y: 0 };

  /** Whether the player is currently moving */
  isMoving = false;

  /** Movement configuration */
  private readonly config: MovementConfig;

  /** Current input state */
  private readonly input: PlayerInput = {
    left: false,
    right: false,
    up: false,
    down: false,
  };

  /** Movement boundaries */
  private readonly bounds: Bounds = {
    minX: 60,
    maxX: 740,
    minY: 120,
    maxY: 420,
  };

  /** Character sprite for visual reference */
  private readonly characterSprite: Container;

  /** Shadow/glow effect */
  private readonly shadow: Graphics;

  /**
   * Create a new player character.
   *
   * @param startX - Initial X position
   * @param startY - Initial Y position
   * @param config - Movement configuration
   */
  constructor(startX: number, startY: number, config: MovementConfig) {
    this.x = startX;
    this.y = startY;
    this.config = config;

    this.container = new Container();
    this.container.label = 'player';

    // Create the character sprite
    this.characterSprite = this.createCharacterSprite();
    this.container.addChild(this.characterSprite);

    // Create shadow/glow underneath
    this.shadow = this.createShadow();
    this.shadow.y = 8;
    this.container.addChildAt(this.shadow, 0);

    // Set initial position
    this.container.x = this.x;
    this.container.y = this.y;
  }

  // ==========================================================================
  // Character Visuals
  // ==========================================================================

  /**
   * Create the player character sprite (ASCII @).
   */
  private createCharacterSprite(): Container {
    const spriteContainer = new Container();

    const characterStyle = new TextStyle({
      fontFamily: FONT_FAMILY,
      fontSize: PLAYER_FONT_SIZE,
      fontWeight: 'bold',
      fill: COLORS.TERMINAL_BRIGHT,
      dropShadow: {
        color: COLORS.TERMINAL_GREEN,
        blur: 8,
        alpha: 0.9,
        distance: 0,
      },
    });

    const character = new Text({
      text: PLAYER_SYMBOL,
      style: characterStyle,
    });
    character.anchor.set(0.5, 1); // Anchor at bottom center (feet)
    spriteContainer.addChild(character);

    return spriteContainer;
  }

  /**
   * Create a subtle shadow/glow effect under the player.
   */
  private createShadow(): Graphics {
    const shadow = new Graphics();

    // Elliptical glow underneath player
    shadow.fill({ color: COLORS.TERMINAL_GREEN, alpha: 0.2 });
    shadow.ellipse(0, 0, 15, 5);
    shadow.fill();

    return shadow;
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Set movement input state.
   *
   * @param newInput - Partial input state to update
   */
  setInput(newInput: Partial<PlayerInput>): void {
    if (newInput.left !== undefined) {this.input.left = newInput.left;}
    if (newInput.right !== undefined) {this.input.right = newInput.right;}
    if (newInput.up !== undefined) {this.input.up = newInput.up;}
    if (newInput.down !== undefined) {this.input.down = newInput.down;}

    // Calculate velocity based on input
    let vx = 0;
    let vy = 0;

    if (this.input.left && !this.input.right) {vx = -1;}
    else if (this.input.right && !this.input.left) {vx = 1;}

    if (this.input.up && !this.input.down) {vy = -1;}
    else if (this.input.down && !this.input.up) {vy = 1;}

    // Normalize diagonal movement to prevent faster diagonal speed
    if (vx !== 0 && vy !== 0) {
      const magnitude = Math.sqrt(vx * vx + vy * vy);
      vx /= magnitude;
      vy /= magnitude;
    }

    this.velocity.x = vx;
    this.velocity.y = vy;
    this.isMoving = vx !== 0 || vy !== 0;
  }

  /**
   * Clear all movement input.
   */
  clearInput(): void {
    this.input.left = false;
    this.input.right = false;
    this.input.up = false;
    this.input.down = false;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.isMoving = false;
  }

  // ==========================================================================
  // Movement
  // ==========================================================================

  /**
   * Update player position based on input.
   * Returns proposed delta for collision checking.
   *
   * @param deltaMs - Time since last frame in milliseconds
   * @returns Proposed movement delta
   */
  update(deltaMs: number): { deltaX: number; deltaY: number } {
    if (!this.isMoving) {
      return { deltaX: 0, deltaY: 0 };
    }

    const deltaSeconds = deltaMs / 1000;
    const baseMovement = this.config.speed * deltaSeconds;

    const deltaX = this.velocity.x * baseMovement;
    const deltaY = this.velocity.y * baseMovement;

    return { deltaX, deltaY };
  }

  /**
   * Apply movement delta (called after collision check).
   *
   * @param deltaX - X movement to apply
   * @param deltaY - Y movement to apply
   */
  applyMovement(deltaX: number, deltaY: number): void {
    // Apply delta and clamp to boundaries
    this.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.x + deltaX));
    this.y = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, this.y + deltaY));

    // Update container position
    this.container.x = this.x;
    this.container.y = this.y;
  }

  /**
   * Set position boundaries.
   *
   * @param minX - Minimum X position
   * @param maxX - Maximum X position
   * @param minY - Minimum Y position
   * @param maxY - Maximum Y position
   */
  setBounds(minX: number, maxX: number, minY: number, maxY: number): void {
    this.bounds.minX = minX;
    this.bounds.maxX = maxX;
    this.bounds.minY = minY;
    this.bounds.maxY = maxY;
  }

  /**
   * Get current position.
   */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Teleport to position (clamped to bounds).
   *
   * @param newX - Target X position
   * @param newY - Optional target Y position
   */
  setPosition(newX: number, newY?: number): void {
    this.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, newX));
    if (newY !== undefined) {
      this.y = Math.max(this.bounds.minY, Math.min(this.bounds.maxY, newY));
    }
    this.container.x = this.x;
    this.container.y = this.y;
  }

  /**
   * Get the player's bounding box for collision detection.
   * Player is anchored at bottom-center, so calculate top-left corner.
   */
  getBoundingBox(): BoundingBox {
    return {
      x: this.x - this.config.playerWidth / 2,
      y: this.y - this.config.playerHeight,
      width: this.config.playerWidth,
      height: this.config.playerHeight,
    };
  }

  /**
   * Get a proposed bounding box for collision testing.
   *
   * @param deltaX - Proposed X movement
   * @param deltaY - Proposed Y movement
   */
  getProposedBoundingBox(deltaX: number, deltaY: number): BoundingBox {
    return {
      x: this.x + deltaX - this.config.playerWidth / 2,
      y: this.y + deltaY - this.config.playerHeight,
      width: this.config.playerWidth,
      height: this.config.playerHeight,
    };
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Destroy the player and clean up resources.
   */
  destroy(): void {
    this.container.destroy({ children: true });
  }
}
