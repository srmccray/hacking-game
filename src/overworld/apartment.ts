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
  FLOOR_Y,
} from './stations';
import {
  createPlayer,
  setupPlayerInput,
  setPlayer,
  destroyPlayer,
  type Player,
} from './player';

// ============================================================================
// Configuration
// ============================================================================

/** Apartment room configuration */
const APARTMENT_CONFIG = {
  /** Left boundary for player movement */
  leftBound: 60,
  /** Right boundary for player movement */
  rightBound: 740,
  /** Player starting X position */
  playerStartX: 200,
  /** Station positions */
  stations: {
    desk: { x: 150 },
    couch: { x: 500 },
    bed: { x: 680 },
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
  const deskStation = createStation('desk', APARTMENT_CONFIG.stations.desk.x, {
    onInteract: () => {
      console.log('Desk station activated!');
      if (config.onDeskInteract) {
        config.onDeskInteract();
      }
    },
  });
  stationManager.addStation(deskStation);
  container.addChild(deskStation.container);

  const couchStation = createStation('couch', APARTMENT_CONFIG.stations.couch.x, {
    onInteract: () => {
      console.log('Couch station activated (placeholder)');
      if (config.onCouchInteract) {
        config.onCouchInteract();
      }
    },
  });
  stationManager.addStation(couchStation);
  container.addChild(couchStation.container);

  const bedStation = createStation('bed', APARTMENT_CONFIG.stations.bed.x, {
    onInteract: () => {
      console.log('Bed station activated (placeholder)');
      if (config.onBedInteract) {
        config.onBedInteract();
      }
    },
  });
  stationManager.addStation(bedStation);
  container.addChild(bedStation.container);

  // Create player
  const player = createPlayer(APARTMENT_CONFIG.playerStartX);
  player.setBounds(APARTMENT_CONFIG.leftBound, APARTMENT_CONFIG.rightBound);
  setPlayer(player);
  container.addChild(player.container);

  // Create instruction text
  const instructions = createInstructions();
  container.addChild(instructions);

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
          if (isPaused) return;

          if (direction === 'left') {
            player.setInput({ left: pressed });
          } else if (direction === 'right') {
            player.setInput({ right: pressed });
          }
        },
        onInteract() {
          if (isPaused) return;

          const interacted = stationManager.interactWithActive();
          if (!interacted) {
            console.log('No station nearby to interact with');
          }
        },
      });

      // Initial station check
      stationManager.updatePlayerPosition(player.x);
    },

    onExit(): void {
      console.log('Exiting apartment scene');

      // Stop movement
      player.setInput({ left: false, right: false });

      // Cleanup input
      if (cleanupInput) {
        cleanupInput();
        cleanupInput = null;
      }
    },

    onUpdate(delta: number): void {
      if (isPaused) return;

      // Update player position
      player.update(delta);

      // Update station interaction state
      stationManager.updatePlayerPosition(player.x);
    },

    pause(): void {
      isPaused = true;
      player.setInput({ left: false, right: false });
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

  // Floor line
  const floorLine = new Graphics();
  floorLine.stroke({ color: TERMINAL_GREEN, width: 2, alpha: 0.8 });
  floorLine.moveTo(20, FLOOR_Y + 20);
  floorLine.lineTo(CANVAS_WIDTH - 20, FLOOR_Y + 20);
  floorLine.stroke();
  container.addChild(floorLine);

  // Floor texture (ASCII pattern)
  const floorStyle = new TextStyle({
    fontFamily: MONOSPACE_FONT,
    fontSize: 10,
    fill: colorToHex(TERMINAL_DIM),
    letterSpacing: 2,
  });

  // Create a floor pattern
  const pattern = '_'.repeat(80);
  const floorPattern = new Text({
    text: pattern,
    style: floorStyle,
  });
  floorPattern.x = 20;
  floorPattern.y = FLOOR_Y + 25;
  floorPattern.alpha = 0.3;
  container.addChild(floorPattern);

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

  // Room title
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
  title.anchor.set(0.5, 0);
  title.x = CANVAS_WIDTH / 2;
  title.y = 55;
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

  const leftText = new Text({
    text: '[A/D or Arrow Keys] Move',
    style: instructionStyle,
  });
  leftText.x = 30;
  leftText.y = CANVAS_HEIGHT - 40;
  container.addChild(leftText);

  const rightText = new Text({
    text: '[Enter/Space] Interact',
    style: instructionStyle,
  });
  rightText.anchor.set(1, 0);
  rightText.x = CANVAS_WIDTH - 30;
  rightText.y = CANVAS_HEIGHT - 40;
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
