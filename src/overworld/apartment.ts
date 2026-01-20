/**
 * Apartment Scene for the Hacker Incremental Game
 *
 * The apartment is the main overworld hub where players navigate between
 * different activities. It contains interactive stations and the player
 * character.
 *
 * Layout (800x600 canvas):
 * ```
 * ================================================================================
 * |                                                                              |
 * |     ___________                                      _____                   |
 * |    |  MONITOR  |                                    | TV  |                  |
 * |    |___________|                                    |_____|                  |
 * |    [====DESK===]                                   [=COUCH=]     [==BED==]   |
 * |                                                                              |
 * |         @                                                                    |
 * |______________________________________________________________________________|
 * ```
 *
 * Usage:
 *   import { createApartmentScene, destroyApartmentScene } from '@overworld/apartment';
 *
 *   const scene = createApartmentScene({
 *     onDeskInteract: () => launchCodeBreaker(),
 *   });
 *   sceneManager.register('apartment', scene);
 */

import { Container, Graphics, Text } from 'pixi.js';
import { TextStyle } from 'pixi.js';
import type { Scene } from '../ui/scenes/scene-manager';
import { CANVAS_WIDTH, CANVAS_HEIGHT, TERMINAL_GREEN, TERMINAL_DIM, colorToHex } from '../ui/renderer';
import { MONOSPACE_FONT } from '../ui/styles';
import {
  createStation,
  StationManager,
  getStationManager,
  destroyStationManager,
  checkStationCollision,
  FLOOR_Y,
  type CollisionRect,
} from './stations';
import {
  createPlayer,
  setupPlayerInput,
  setPlayer,
  destroyPlayer,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  type Player,
} from './player';
import { createHUD, destroyHUD } from '../ui/hud';
import { isInGameMenuVisible } from '../ui/in-game-menu';

// ============================================================================
// Configuration
// ============================================================================

/** Apartment room configuration */
const APARTMENT_CONFIG = {
  /** Left boundary for player movement */
  leftBound: 60,
  /** Right boundary for player movement */
  rightBound: 740,
  /** Top boundary for player movement (near top wall) */
  topBound: 120,
  /** Bottom boundary for player movement (floor level) */
  bottomBound: FLOOR_Y,
  /** Player starting X position (center of room) */
  playerStartX: 400,
  /** Player starting Y position (bottom area, with room to move) */
  playerStartY: 380,
  /** Station positions - all on same Y axis with walking space around each */
  stations: {
    desk: { x: 150, y: 270 },   // Left
    couch: { x: 400, y: 270 },  // Center
    bed: { x: 620, y: 270 },    // Right (with space to walk around)
  },
};

// ============================================================================
// Types
// ============================================================================

/** Configuration for apartment scene callbacks */
export interface ApartmentSceneConfig {
  /** Called when player interacts with the desk station */
  onDeskInteract?: () => void;
  /** Called when player interacts with the couch station (placeholder) */
  onCouchInteract?: () => void;
  /** Called when player interacts with the bed station (placeholder) */
  onBedInteract?: () => void;
}

/** Apartment scene instance */
export interface ApartmentScene extends Scene {
  /** The player character */
  player: Player;
  /** Station manager */
  stationManager: StationManager;
  /** Pause player movement (for minigame launch) */
  pause: () => void;
  /** Resume player movement */
  resume: () => void;
  /** Check if scene is paused */
  isPaused: () => boolean;
}

// ============================================================================
// Module State
// ============================================================================

let apartmentScene: ApartmentScene | null = null;
let cleanupInput: (() => void) | null = null;
let isPaused = false;

// ============================================================================
// Scene Creation
// ============================================================================

/**
 * Create the apartment scene.
 *
 * @param config - Scene configuration with interaction callbacks
 * @returns An ApartmentScene instance (implements Scene interface)
 */
export function createApartmentScene(config: ApartmentSceneConfig = {}): ApartmentScene {
  // Clean up existing scene if any
  if (apartmentScene) {
    destroyApartmentScene();
  }

  const container = new Container();
  container.label = 'apartment-scene';

  // Create the room background
  const background = createRoomBackground();
  container.addChild(background);

  // Create the floor
  const floor = createFloor();
  container.addChild(floor);

  // Create room decorations (wall details)
  const decorations = createRoomDecorations();
  container.addChild(decorations);

  // Create station manager
  const stationManager = getStationManager();

  // Create stations
  const deskStation = createStation(
    'desk',
    APARTMENT_CONFIG.stations.desk.x,
    APARTMENT_CONFIG.stations.desk.y,
    {
      onInteract: () => {
        console.log('Desk station activated!');
        if (config.onDeskInteract) {
          config.onDeskInteract();
        }
      },
    }
  );
  stationManager.addStation(deskStation);
  container.addChild(deskStation.container);

  const couchStation = createStation(
    'couch',
    APARTMENT_CONFIG.stations.couch.x,
    APARTMENT_CONFIG.stations.couch.y,
    {
      onInteract: () => {
        console.log('Couch station activated (placeholder)');
        if (config.onCouchInteract) {
          config.onCouchInteract();
        }
      },
    }
  );
  stationManager.addStation(couchStation);
  container.addChild(couchStation.container);

  const bedStation = createStation(
    'bed',
    APARTMENT_CONFIG.stations.bed.x,
    APARTMENT_CONFIG.stations.bed.y,
    {
      onInteract: () => {
        console.log('Bed station activated (placeholder)');
        if (config.onBedInteract) {
          config.onBedInteract();
        }
      },
    }
  );
  stationManager.addStation(bedStation);
  container.addChild(bedStation.container);

  // Create player
  const player = createPlayer(APARTMENT_CONFIG.playerStartX, APARTMENT_CONFIG.playerStartY);
  player.setBounds(
    APARTMENT_CONFIG.leftBound,
    APARTMENT_CONFIG.rightBound,
    APARTMENT_CONFIG.topBound,
    APARTMENT_CONFIG.bottomBound
  );
  setPlayer(player);
  container.addChild(player.container);

  // Create instruction text
  const instructions = createInstructions();
  container.addChild(instructions);

  // Create HUD and add to scene
  const hudContainer = createHUD();
  container.addChild(hudContainer);

  // Create the scene object
  const scene: ApartmentScene = {
    container,
    player,
    stationManager,

    onEnter(): void {
      console.log('Entering apartment scene');
      isPaused = false;

      // Setup input handling
      cleanupInput = setupPlayerInput({
        onMove(direction, pressed) {
          if (isPaused || isInGameMenuVisible()) return;

          if (direction === 'left') {
            player.setInput({ left: pressed });
          } else if (direction === 'right') {
            player.setInput({ right: pressed });
          } else if (direction === 'up') {
            player.setInput({ up: pressed });
          } else if (direction === 'down') {
            player.setInput({ down: pressed });
          }
        },
        onInteract() {
          if (isPaused || isInGameMenuVisible()) return;

          const interacted = stationManager.interactWithActive();
          if (!interacted) {
            console.log('No station nearby to interact with');
          }
        },
      });

      // Initial station check with player bounding box
      const playerRect = player.getBoundingBox();
      stationManager.updatePlayerPosition(player.x, playerRect);
    },

    onExit(): void {
      console.log('Exiting apartment scene');

      // Stop movement
      player.setInput({ left: false, right: false, up: false, down: false });

      // Cleanup input
      if (cleanupInput) {
        cleanupInput();
        cleanupInput = null;
      }
    },

    onUpdate(delta: number): void {
      if (isPaused) return;

      // Calculate proposed movement
      const { deltaX, deltaY } = player.update(delta);

      const stations = stationManager.getAllStations();
      const currentPos = player.getPosition();

      // If there's movement, check for collisions
      if (deltaX !== 0 || deltaY !== 0) {
        // Calculate proposed bounding box for each axis independently
        // This allows "sliding" along walls when colliding

        // Check X movement
        let allowedDeltaX = deltaX;
        if (deltaX !== 0) {
          const proposedXRect: CollisionRect = {
            x: currentPos.x + deltaX - PLAYER_WIDTH / 2,
            y: currentPos.y - PLAYER_HEIGHT,
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
          };
          const xCollision = checkStationCollision(proposedXRect, stations);
          if (xCollision) {
            allowedDeltaX = 0;
          }
        }

        // Check Y movement
        let allowedDeltaY = deltaY;
        if (deltaY !== 0) {
          const proposedYRect: CollisionRect = {
            x: currentPos.x - PLAYER_WIDTH / 2,
            y: currentPos.y + deltaY - PLAYER_HEIGHT,
            width: PLAYER_WIDTH,
            height: PLAYER_HEIGHT,
          };
          const yCollision = checkStationCollision(proposedYRect, stations);
          if (yCollision) {
            allowedDeltaY = 0;
          }
        }

        // Apply allowed movement
        player.applyMovement(allowedDeltaX, allowedDeltaY);
      }

      // Check for proximity to stations (use expanded bounding box for interaction)
      const proximityMargin = 10; // pixels of proximity to trigger interaction prompt
      const proximityRect: CollisionRect = {
        x: currentPos.x - PLAYER_WIDTH / 2 - proximityMargin,
        y: currentPos.y - PLAYER_HEIGHT - proximityMargin,
        width: PLAYER_WIDTH + proximityMargin * 2,
        height: PLAYER_HEIGHT + proximityMargin * 2,
      };
      const nearbyStation = checkStationCollision(proximityRect, stations);
      stationManager.setActiveStation(nearbyStation);
    },

    pause(): void {
      isPaused = true;
      player.setInput({ left: false, right: false, up: false, down: false });
    },

    resume(): void {
      isPaused = false;
    },

    isPaused(): boolean {
      return isPaused;
    },
  };

  apartmentScene = scene;
  return scene;
}

// ============================================================================
// Visual Components
// ============================================================================

/**
 * Create the room background.
 */
function createRoomBackground(): Graphics {
  const bg = new Graphics();

  // Dark room background
  bg.fill({ color: 0x0a0a0a });
  bg.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  bg.fill();

  // Subtle wall gradient (darker at top)
  bg.fill({ color: 0x080808 });
  bg.rect(0, 0, CANVAS_WIDTH, 200);
  bg.fill();

  return bg;
}

/**
 * Create the floor.
 */
function createFloor(): Container {
  const container = new Container();

  // Floor line (dim green to match walls)
  const floorLine = new Graphics();
  floorLine.stroke({ color: TERMINAL_DIM, width: 1, alpha: 0.5 });
  floorLine.moveTo(20, FLOOR_Y + 20);
  floorLine.lineTo(CANVAS_WIDTH - 20, FLOOR_Y + 20);
  floorLine.stroke();
  container.addChild(floorLine);

  return container;
}

/**
 * Create room decorations (walls, corners, etc.).
 */
function createRoomDecorations(): Container {
  const container = new Container();

  // Top wall line
  const topWall = new Graphics();
  topWall.stroke({ color: TERMINAL_DIM, width: 1, alpha: 0.5 });
  topWall.moveTo(20, 80);
  topWall.lineTo(CANVAS_WIDTH - 20, 80);
  topWall.stroke();
  container.addChild(topWall);

  // Side walls
  const leftWall = new Graphics();
  leftWall.stroke({ color: TERMINAL_DIM, width: 1, alpha: 0.5 });
  leftWall.moveTo(20, 80);
  leftWall.lineTo(20, FLOOR_Y + 20);
  leftWall.stroke();
  container.addChild(leftWall);

  const rightWall = new Graphics();
  rightWall.stroke({ color: TERMINAL_DIM, width: 1, alpha: 0.5 });
  rightWall.moveTo(CANVAS_WIDTH - 20, 80);
  rightWall.lineTo(CANVAS_WIDTH - 20, FLOOR_Y + 20);
  rightWall.stroke();
  container.addChild(rightWall);

  // Room title (top-left)
  const titleStyle = new TextStyle({
    fontFamily: MONOSPACE_FONT,
    fontSize: 14,
    fill: colorToHex(TERMINAL_DIM),
    dropShadow: {
      color: colorToHex(TERMINAL_DIM),
      blur: 2,
      alpha: 0.5,
      distance: 0,
    },
  });

  const title = new Text({
    text: '[ APARTMENT ]',
    style: titleStyle,
  });
  title.anchor.set(0, 1); // Anchor at bottom-left
  title.x = 30;
  title.y = 74; // Bottom-aligned with HUD (38 + 36 height)
  container.addChild(title);

  // Corner accents
  const accentSize = 15;
  const corners = new Graphics();
  corners.stroke({ color: TERMINAL_GREEN, width: 2, alpha: 0.8 });

  // Top-left
  corners.moveTo(20, 80 + accentSize);
  corners.lineTo(20, 80);
  corners.lineTo(20 + accentSize, 80);
  corners.stroke();

  // Top-right
  corners.moveTo(CANVAS_WIDTH - 20 - accentSize, 80);
  corners.lineTo(CANVAS_WIDTH - 20, 80);
  corners.lineTo(CANVAS_WIDTH - 20, 80 + accentSize);
  corners.stroke();

  // Bottom-left
  corners.moveTo(20, FLOOR_Y + 20 - accentSize);
  corners.lineTo(20, FLOOR_Y + 20);
  corners.lineTo(20 + accentSize, FLOOR_Y + 20);
  corners.stroke();

  // Bottom-right
  corners.moveTo(CANVAS_WIDTH - 20 - accentSize, FLOOR_Y + 20);
  corners.lineTo(CANVAS_WIDTH - 20, FLOOR_Y + 20);
  corners.lineTo(CANVAS_WIDTH - 20, FLOOR_Y + 20 - accentSize);
  corners.stroke();

  container.addChild(corners);

  return container;
}

/**
 * Create instruction text at the bottom of the screen.
 */
function createInstructions(): Container {
  const container = new Container();

  const instructionStyle = new TextStyle({
    fontFamily: MONOSPACE_FONT,
    fontSize: 11,
    fill: colorToHex(TERMINAL_DIM),
  });

  // Position just below the room floor (FLOOR_Y + 20 = 440)
  const instructionY = FLOOR_Y + 35;

  const leftText = new Text({
    text: '[WASD or Arrow Keys] Move',
    style: instructionStyle,
  });
  leftText.x = 30;
  leftText.y = instructionY;
  container.addChild(leftText);

  const rightText = new Text({
    text: '[Enter/Space] Interact',
    style: instructionStyle,
  });
  rightText.anchor.set(1, 0);
  rightText.x = CANVAS_WIDTH - 30;
  rightText.y = instructionY;
  container.addChild(rightText);

  return container;
}

// ============================================================================
// Scene Management
// ============================================================================

/**
 * Get the current apartment scene instance.
 */
export function getApartmentScene(): ApartmentScene | null {
  return apartmentScene;
}

/**
 * Destroy the apartment scene and clean up resources.
 */
export function destroyApartmentScene(): void {
  // Cleanup input handlers
  if (cleanupInput) {
    cleanupInput();
    cleanupInput = null;
  }

  // Destroy HUD
  destroyHUD();

  // Destroy player
  destroyPlayer();

  // Destroy station manager
  destroyStationManager();

  // Destroy container
  if (apartmentScene) {
    apartmentScene.container.destroy({ children: true });
    apartmentScene = null;
  }

  isPaused = false;

  console.log('Apartment scene destroyed');
}

// ============================================================================
// Export Helpers
// ============================================================================

/**
 * Pause the apartment scene (for minigame transitions).
 */
export function pauseApartment(): void {
  if (apartmentScene) {
    apartmentScene.pause();
  }
}

/**
 * Resume the apartment scene.
 */
export function resumeApartment(): void {
  if (apartmentScene) {
    apartmentScene.resume();
  }
}
