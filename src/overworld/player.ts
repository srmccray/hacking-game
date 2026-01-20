/**
 * Player Character for the Apartment Overworld
 *
 * The player is represented as an ASCII `@` character (classic roguelike style)
 * with left/right movement using arrow keys or A/D.
 *
 * Features:
 * - ASCII `@` character with terminal glow effect
 * - Smooth left/right movement
 * - Collision with scene boundaries
 * - Fixed Y position (floor level)
 *
 * Usage:
 *   import { Player, createPlayer } from '@overworld/player';
 *
 *   const player = createPlayer(400); // start at x=400
 *   apartmentContainer.addChild(player.container);
 *
 *   // In update loop:
 *   player.update(deltaTime);
 */

import { Container, Text, Graphics } from 'pixi.js';
import { TextStyle } from 'pixi.js';
import { MONOSPACE_FONT } from '../ui/styles';
import { TERMINAL_GREEN, TERMINAL_BRIGHT, colorToHex } from '../ui/renderer';
import { FLOOR_Y } from './stations';

// ============================================================================
// Configuration
// ============================================================================

/** Player character symbol */
const PLAYER_SYMBOL = '@';

/** Player movement speed (pixels per second) */
export const PLAYER_SPEED = 200;

/** Player character font size */
const PLAYER_FONT_SIZE = 32;

/** Player bounding box dimensions (approximate for @ character at 32px font) */
export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 32;

/** Minimum X position (left boundary) */
const MIN_X = 60;

/** Maximum X position (right boundary) - will be set based on apartment width */
let maxX = 740;

/** Minimum Y position (top boundary - near top wall) */
const MIN_Y = 120;

/** Maximum Y position (bottom boundary - floor level) */
const MAX_Y = 420;

// ============================================================================
// Types
// ============================================================================

/** Movement direction (for single-axis callbacks) */
export type MoveDirection = 'left' | 'right' | 'up' | 'down' | 'none';

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

/** Player instance */
export interface Player {
  /** The PixiJS container for the player */
  container: Container;
  /** Current X position */
  x: number;
  /** Current Y position */
  y: number;
  /** Current velocity */
  velocity: Velocity;
  /** Whether the player is currently moving */
  isMoving: boolean;
  /** Set movement input */
  setInput: (input: Partial<PlayerInput>) => void;
  /** Update player position based on input, returns proposed delta for collision checking */
  update: (deltaMs: number) => { deltaX: number; deltaY: number };
  /** Apply movement delta (called after collision check) */
  applyMovement: (deltaX: number, deltaY: number) => void;
  /** Set position boundaries */
  setBounds: (minX: number, maxX: number, minY: number, maxY: number) => void;
  /** Get current position */
  getPosition: () => { x: number; y: number };
  /** Teleport to position */
  setPosition: (x: number, y?: number) => void;
  /** Get the player's bounding box for collision detection */
  getBoundingBox: () => { x: number; y: number; width: number; height: number };
  /** Destroy the player */
  destroy: () => void;
}

// ============================================================================
// Player Creation
// ============================================================================

/**
 * Create a new player character.
 *
 * @param startX - Initial X position
 * @param startY - Initial Y position (defaults to FLOOR_Y)
 * @returns A Player instance
 */
export function createPlayer(startX: number = 400, startY: number = FLOOR_Y): Player {
  const container = new Container();
  container.label = 'player';

  // Current input state
  const input: PlayerInput = {
    left: false,
    right: false,
    up: false,
    down: false,
  };

  // Position
  let x = startX;
  let y = startY;

  // Boundaries
  let boundMinX = MIN_X;
  let boundMaxX = maxX;
  let boundMinY = MIN_Y;
  let boundMaxY = MAX_Y;

  // Velocity
  const velocity: Velocity = { x: 0, y: 0 };

  // Create the player character sprite
  const characterSprite = createPlayerSprite();
  container.addChild(characterSprite);

  // Create a subtle shadow/glow underneath
  const shadow = createPlayerShadow();
  shadow.y = 8;
  container.addChildAt(shadow, 0);

  // Set initial position
  container.x = x;
  container.y = y;

  // Player object
  const player: Player = {
    container,
    x,
    y,
    velocity,
    isMoving: false,

    setInput(newInput: Partial<PlayerInput>): void {
      if (newInput.left !== undefined) input.left = newInput.left;
      if (newInput.right !== undefined) input.right = newInput.right;
      if (newInput.up !== undefined) input.up = newInput.up;
      if (newInput.down !== undefined) input.down = newInput.down;

      // Calculate velocity based on input
      let vx = 0;
      let vy = 0;

      if (input.left && !input.right) vx = -1;
      else if (input.right && !input.left) vx = 1;

      if (input.up && !input.down) vy = -1;
      else if (input.down && !input.up) vy = 1;

      // Normalize diagonal movement to prevent faster diagonal speed
      if (vx !== 0 && vy !== 0) {
        const magnitude = Math.sqrt(vx * vx + vy * vy);
        vx /= magnitude;
        vy /= magnitude;
      }

      velocity.x = vx;
      velocity.y = vy;
      player.velocity = velocity;
      player.isMoving = vx !== 0 || vy !== 0;
    },

    update(deltaMs: number): { deltaX: number; deltaY: number } {
      if (!player.isMoving) {
        return { deltaX: 0, deltaY: 0 };
      }

      const deltaSeconds = deltaMs / 1000;
      const baseMovement = PLAYER_SPEED * deltaSeconds;

      const deltaX = velocity.x * baseMovement;
      const deltaY = velocity.y * baseMovement;

      return { deltaX, deltaY };
    },

    applyMovement(deltaX: number, deltaY: number): void {
      // Apply delta and clamp to boundaries
      x = Math.max(boundMinX, Math.min(boundMaxX, x + deltaX));
      y = Math.max(boundMinY, Math.min(boundMaxY, y + deltaY));

      // Update player state and container position
      player.x = x;
      player.y = y;
      container.x = x;
      container.y = y;
    },

    setBounds(newMinX: number, newMaxX: number, newMinY: number, newMaxY: number): void {
      boundMinX = newMinX;
      boundMaxX = newMaxX;
      boundMinY = newMinY;
      boundMaxY = newMaxY;
    },

    getPosition(): { x: number; y: number } {
      return { x: player.x, y: player.y };
    },

    setPosition(newX: number, newY?: number): void {
      x = Math.max(boundMinX, Math.min(boundMaxX, newX));
      if (newY !== undefined) {
        y = Math.max(boundMinY, Math.min(boundMaxY, newY));
      }
      player.x = x;
      player.y = y;
      container.x = x;
      container.y = y;
    },

    getBoundingBox(): { x: number; y: number; width: number; height: number } {
      // Player is anchored at bottom-center, so calculate top-left corner
      return {
        x: player.x - PLAYER_WIDTH / 2,
        y: player.y - PLAYER_HEIGHT,
        width: PLAYER_WIDTH,
        height: PLAYER_HEIGHT,
      };
    },

    destroy(): void {
      container.destroy({ children: true });
    },
  };

  return player;
}

/**
 * Create the player character sprite (ASCII @).
 */
function createPlayerSprite(): Container {
  const container = new Container();

  // Main character style with glow
  const characterStyle = new TextStyle({
    fontFamily: MONOSPACE_FONT,
    fontSize: PLAYER_FONT_SIZE,
    fontWeight: 'bold',
    fill: colorToHex(TERMINAL_BRIGHT),
    dropShadow: {
      color: colorToHex(TERMINAL_GREEN),
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
  container.addChild(character);

  return container;
}

/**
 * Create a subtle shadow/glow effect under the player.
 */
function createPlayerShadow(): Graphics {
  const shadow = new Graphics();

  // Elliptical glow underneath player
  shadow.fill({ color: TERMINAL_GREEN, alpha: 0.2 });
  shadow.ellipse(0, 0, 15, 5);
  shadow.fill();

  return shadow;
}

// ============================================================================
// Input Handling
// ============================================================================

/** Key codes for movement */
const MOVE_LEFT_KEYS = ['ArrowLeft', 'KeyA'];
const MOVE_RIGHT_KEYS = ['ArrowRight', 'KeyD'];
const MOVE_UP_KEYS = ['ArrowUp', 'KeyW'];
const MOVE_DOWN_KEYS = ['ArrowDown', 'KeyS'];
const INTERACT_KEYS = ['Enter', 'Space'];

/** Input handler type */
export type InputHandler = {
  onMove: (direction: MoveDirection, pressed: boolean) => void;
  onInteract: () => void;
};

/**
 * Create keyboard input handlers for player movement.
 *
 * @param handler - Callbacks for movement and interaction
 * @returns Cleanup function to remove event listeners
 */
export function setupPlayerInput(handler: InputHandler): () => void {
  function handleKeyDown(event: KeyboardEvent): void {
    // Prevent default for game keys
    if (
      [...MOVE_LEFT_KEYS, ...MOVE_RIGHT_KEYS, ...MOVE_UP_KEYS, ...MOVE_DOWN_KEYS, ...INTERACT_KEYS].includes(
        event.code
      )
    ) {
      event.preventDefault();
    }

    if (MOVE_LEFT_KEYS.includes(event.code)) {
      handler.onMove('left', true);
    } else if (MOVE_RIGHT_KEYS.includes(event.code)) {
      handler.onMove('right', true);
    } else if (MOVE_UP_KEYS.includes(event.code)) {
      handler.onMove('up', true);
    } else if (MOVE_DOWN_KEYS.includes(event.code)) {
      handler.onMove('down', true);
    } else if (INTERACT_KEYS.includes(event.code)) {
      handler.onInteract();
    }
  }

  function handleKeyUp(event: KeyboardEvent): void {
    if (MOVE_LEFT_KEYS.includes(event.code)) {
      handler.onMove('left', false);
    } else if (MOVE_RIGHT_KEYS.includes(event.code)) {
      handler.onMove('right', false);
    } else if (MOVE_UP_KEYS.includes(event.code)) {
      handler.onMove('up', false);
    } else if (MOVE_DOWN_KEYS.includes(event.code)) {
      handler.onMove('down', false);
    }
  }

  // Add listeners
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}

// ============================================================================
// Singleton Instance (for global access)
// ============================================================================

let playerInstance: Player | null = null;

/**
 * Get the global player instance.
 */
export function getPlayer(): Player | null {
  return playerInstance;
}

/**
 * Set the global player instance.
 */
export function setPlayer(player: Player | null): void {
  playerInstance = player;
}

/**
 * Destroy the global player instance.
 */
export function destroyPlayer(): void {
  if (playerInstance) {
    playerInstance.destroy();
    playerInstance = null;
  }
}
