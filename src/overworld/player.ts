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

/** Minimum X position (left boundary) */
const MIN_X = 60;

/** Maximum X position (right boundary) - will be set based on apartment width */
let maxX = 740;

// ============================================================================
// Types
// ============================================================================

/** Movement direction */
export type MoveDirection = 'left' | 'right' | 'none';

/** Player input state */
export interface PlayerInput {
  left: boolean;
  right: boolean;
}

/** Player instance */
export interface Player {
  /** The PixiJS container for the player */
  container: Container;
  /** Current X position */
  x: number;
  /** Current Y position (fixed) */
  y: number;
  /** Current movement direction */
  direction: MoveDirection;
  /** Whether the player is currently moving */
  isMoving: boolean;
  /** Set movement input */
  setInput: (input: Partial<PlayerInput>) => void;
  /** Update player position based on input */
  update: (deltaMs: number) => void;
  /** Set position boundaries */
  setBounds: (minX: number, maxX: number) => void;
  /** Get current position */
  getPosition: () => { x: number; y: number };
  /** Teleport to position */
  setPosition: (x: number) => void;
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
 * @returns A Player instance
 */
export function createPlayer(startX: number = 400): Player {
  const container = new Container();
  container.label = 'player';

  // Current input state
  const input: PlayerInput = {
    left: false,
    right: false,
  };

  // Position
  let x = startX;
  const y = FLOOR_Y;

  // Boundaries
  let boundMinX = MIN_X;
  let boundMaxX = maxX;

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
    direction: 'none',
    isMoving: false,

    setInput(newInput: Partial<PlayerInput>): void {
      if (newInput.left !== undefined) input.left = newInput.left;
      if (newInput.right !== undefined) input.right = newInput.right;

      // Update direction
      if (input.left && !input.right) {
        player.direction = 'left';
      } else if (input.right && !input.left) {
        player.direction = 'right';
      } else {
        player.direction = 'none';
      }

      player.isMoving = player.direction !== 'none';
    },

    update(deltaMs: number): void {
      if (player.direction === 'none') return;

      const deltaSeconds = deltaMs / 1000;
      const movement = PLAYER_SPEED * deltaSeconds;

      if (player.direction === 'left') {
        x -= movement;
      } else if (player.direction === 'right') {
        x += movement;
      }

      // Clamp to boundaries
      x = Math.max(boundMinX, Math.min(boundMaxX, x));

      // Update container position
      player.x = x;
      container.x = x;
    },

    setBounds(newMinX: number, newMaxX: number): void {
      boundMinX = newMinX;
      boundMaxX = newMaxX;
    },

    getPosition(): { x: number; y: number } {
      return { x: player.x, y: player.y };
    },

    setPosition(newX: number): void {
      x = Math.max(boundMinX, Math.min(boundMaxX, newX));
      player.x = x;
      container.x = x;
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
    if ([...MOVE_LEFT_KEYS, ...MOVE_RIGHT_KEYS, ...INTERACT_KEYS].includes(event.code)) {
      event.preventDefault();
    }

    if (MOVE_LEFT_KEYS.includes(event.code)) {
      handler.onMove('left', true);
    } else if (MOVE_RIGHT_KEYS.includes(event.code)) {
      handler.onMove('right', true);
    } else if (INTERACT_KEYS.includes(event.code)) {
      handler.onInteract();
    }
  }

  function handleKeyUp(event: KeyboardEvent): void {
    if (MOVE_LEFT_KEYS.includes(event.code)) {
      handler.onMove('left', false);
    } else if (MOVE_RIGHT_KEYS.includes(event.code)) {
      handler.onMove('right', false);
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
