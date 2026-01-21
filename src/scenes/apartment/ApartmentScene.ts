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
 *   import { createApartmentScene } from './ApartmentScene';
 *   sceneManager.register('apartment', () => createApartmentScene(game));
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene, GameInstance } from '../../core/types';
import type { Game } from '../../game/Game';
import type { InputContext } from '../../input/InputManager';
import { INPUT_PRIORITY } from '../../input/InputManager';
import { COLORS } from '../../rendering/Renderer';
import { FONT_FAMILY, terminalDimStyle } from '../../rendering/styles';
import { Player, type BoundingBox } from './Player';
import { Station, StationManager, FLOOR_Y } from './Station';
import { GameEvents } from '../../events/game-events';

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
  /** Player starting Y position (bottom area) */
  playerStartY: 380,
  /** Station positions */
  stations: {
    desk: { x: 150, y: 270 },   // Left
    couch: { x: 400, y: 270 },  // Center
    bed: { x: 620, y: 270 },    // Right
  },
};

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Apartment scene class.
 */
class ApartmentScene implements Scene {
  readonly id = 'apartment';

  /** The PixiJS container for this scene */
  private readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** The player character */
  private player: Player | null = null;

  /** Station manager */
  private readonly stationManager: StationManager;

  /** Input context for this scene */
  private inputContext: InputContext | null = null;

  /** Whether the scene is paused */
  private paused = false;

  /** Event unsubscribers */
  private unsubscribers: Array<() => void> = [];

  constructor(game: Game) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'apartment-scene';
    this.stationManager = new StationManager();
  }

  // ==========================================================================
  // Scene Lifecycle
  // ==========================================================================

  getContainer(): Container {
    return this.container;
  }

  onEnter(): void {
    console.log('[ApartmentScene] Entering scene');

    // Create the room
    this.createRoom();

    // Create stations
    this.createStations();

    // Create player
    this.createPlayer();

    // Register input context
    this.registerInputContext();

    // Emit scene entered event
    this.game.eventBus.emit(GameEvents.SCENE_ENTERED, {
      sceneId: this.id,
    });
  }

  onExit(): void {
    console.log('[ApartmentScene] Exiting scene');

    // Disable input context
    if (this.inputContext) {
      this.game.inputManager.disableContext(this.inputContext.id);
    }

    // Clean up event listeners
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    // Clear player input
    if (this.player) {
      this.player.clearInput();
    }

    // Note: SceneExitedPayload requires nextSceneId but we don't know it here.
    // The scene manager handles transitions, so we skip this event on exit.
    // If needed, callers should emit this event with the correct nextSceneId.
  }

  onUpdate(deltaMs: number): void {
    if (this.paused || !this.player) {
      return;
    }

    // Get proposed movement
    const delta = this.player.update(deltaMs);

    if (delta.deltaX !== 0 || delta.deltaY !== 0) {
      // Check collision with stations
      const proposedRect = this.player.getProposedBoundingBox(delta.deltaX, delta.deltaY);
      const collision = this.stationManager.checkCollision(proposedRect);

      if (collision) {
        // Try to slide along walls
        const { adjustedDeltaX, adjustedDeltaY } = this.resolveCollision(delta.deltaX, delta.deltaY, collision);
        this.player.applyMovement(adjustedDeltaX, adjustedDeltaY);
      } else {
        this.player.applyMovement(delta.deltaX, delta.deltaY);
      }
    }

    // Update which station the player is near
    const playerRect = this.player.getBoundingBox();
    // Expand the player rect slightly for interaction detection
    const interactionRect: BoundingBox = {
      x: playerRect.x - 10,
      y: playerRect.y - 10,
      width: playerRect.width + 20,
      height: playerRect.height + 20,
    };
    this.stationManager.updatePlayerPosition(interactionRect);
  }

  onDestroy(): void {
    console.log('[ApartmentScene] Destroying scene');

    // Unregister input context
    if (this.inputContext) {
      this.game.inputManager.unregisterContext(this.inputContext.id);
    }

    // Destroy player
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    // Destroy station manager
    this.stationManager.destroy();

    // Destroy container and children
    this.container.destroy({ children: true });
  }

  // ==========================================================================
  // Room Creation
  // ==========================================================================

  /**
   * Create the room background and decorations.
   */
  private createRoom(): void {
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;

    // Background
    const bg = new Graphics();
    bg.fill({ color: COLORS.BACKGROUND, alpha: 1 });
    bg.rect(0, 0, width, height);
    bg.fill();
    this.container.addChild(bg);

    // Floor
    const floor = new Graphics();
    floor.stroke({ color: COLORS.TERMINAL_DIM, width: 2 });
    floor.moveTo(40, FLOOR_Y + 30);
    floor.lineTo(width - 40, FLOOR_Y + 30);
    floor.stroke();

    // Add some floor detail
    floor.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.3 });
    for (let x = 60; x < width - 40; x += 40) {
      floor.moveTo(x, FLOOR_Y + 32);
      floor.lineTo(x, FLOOR_Y + 40);
    }
    floor.stroke();
    this.container.addChild(floor);

    // Walls
    const walls = new Graphics();
    walls.stroke({ color: COLORS.TERMINAL_DIM, width: 1, alpha: 0.5 });

    // Left wall
    walls.moveTo(40, 80);
    walls.lineTo(40, FLOOR_Y + 30);

    // Right wall
    walls.moveTo(width - 40, 80);
    walls.lineTo(width - 40, FLOOR_Y + 30);

    // Top wall/ceiling
    walls.moveTo(40, 80);
    walls.lineTo(width - 40, 80);

    walls.stroke();
    this.container.addChild(walls);

    // Room decorations
    this.createRoomDecorations();

    // Scene title
    const title = new Text({
      text: 'YOUR APARTMENT',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        fill: COLORS.TERMINAL_DIM,
      }),
    });
    title.anchor.set(0.5, 0);
    title.x = width / 2;
    title.y = 20;
    this.container.addChild(title);

    // Instructions
    const instructions = new Text({
      text: 'WASD/Arrows: Move | Enter/Space: Interact | U: Upgrades | Esc: Menu',
      style: terminalDimStyle,
    });
    instructions.anchor.set(0.5, 0);
    instructions.x = width / 2;
    instructions.y = height - 30;
    this.container.addChild(instructions);
  }

  /**
   * Create decorative elements for the room.
   */
  private createRoomDecorations(): void {
    const decorations = new Container();
    decorations.label = 'decorations';

    // Window (top center)
    const window = new Graphics();
    window.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    window.rect(340, 100, 120, 80);
    window.stroke();

    // Window panes
    window.moveTo(400, 100);
    window.lineTo(400, 180);
    window.moveTo(340, 140);
    window.lineTo(460, 140);
    window.stroke();

    // Window glow (moonlight)
    window.fill({ color: COLORS.TERMINAL_GREEN, alpha: 0.05 });
    window.rect(341, 101, 58, 38);
    window.rect(401, 101, 58, 38);
    window.fill();

    decorations.addChild(window);

    // Poster on left wall
    const poster = new Graphics();
    poster.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    poster.rect(60, 120, 40, 60);
    poster.stroke();

    const posterText = new Text({
      text: '01\n10',
      style: new TextStyle({
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        fill: COLORS.TERMINAL_DIM,
        align: 'center',
      }),
    });
    posterText.anchor.set(0.5);
    posterText.x = 80;
    posterText.y = 150;
    decorations.addChild(posterText);
    decorations.addChild(poster);

    // Clock on right wall
    const clock = new Graphics();
    clock.stroke({ color: COLORS.TERMINAL_DIM, width: 1 });
    clock.circle(700, 140, 20);
    clock.stroke();
    clock.moveTo(700, 140);
    clock.lineTo(700, 125);
    clock.moveTo(700, 140);
    clock.lineTo(710, 140);
    clock.stroke();
    decorations.addChild(clock);

    this.container.addChild(decorations);
  }

  // ==========================================================================
  // Station Creation
  // ==========================================================================

  /**
   * Create all stations in the apartment.
   */
  private createStations(): void {
    // Desk station (launches Code Breaker)
    const desk = new Station('desk', APARTMENT_CONFIG.stations.desk.x, APARTMENT_CONFIG.stations.desk.y, {
      onInteract: (): void => {
        console.log('[ApartmentScene] Desk interaction - launching Code Breaker');
        void this.game.switchScene('code-breaker');
      },
    });
    this.stationManager.addStation(desk);
    this.container.addChild(desk.container);

    // Couch station (placeholder)
    const couch = new Station('couch', APARTMENT_CONFIG.stations.couch.x, APARTMENT_CONFIG.stations.couch.y, {
      onInteract: (): void => {
        console.log('[ApartmentScene] Couch interaction (placeholder)');
      },
    });
    this.stationManager.addStation(couch);
    this.container.addChild(couch.container);

    // Bed station (placeholder)
    const bed = new Station('bed', APARTMENT_CONFIG.stations.bed.x, APARTMENT_CONFIG.stations.bed.y, {
      onInteract: (): void => {
        console.log('[ApartmentScene] Bed interaction (placeholder)');
      },
    });
    this.stationManager.addStation(bed);
    this.container.addChild(bed.container);
  }

  // ==========================================================================
  // Player Creation
  // ==========================================================================

  /**
   * Create the player character.
   */
  private createPlayer(): void {
    this.player = new Player(
      APARTMENT_CONFIG.playerStartX,
      APARTMENT_CONFIG.playerStartY,
      this.game.config.movement
    );

    // Set bounds
    this.player.setBounds(
      APARTMENT_CONFIG.leftBound,
      APARTMENT_CONFIG.rightBound,
      APARTMENT_CONFIG.topBound,
      APARTMENT_CONFIG.bottomBound
    );

    this.container.addChild(this.player.container);
  }

  // ==========================================================================
  // Collision Resolution
  // ==========================================================================

  /**
   * Resolve collision by trying to slide along the obstacle.
   */
  private resolveCollision(
    deltaX: number,
    deltaY: number,
    _collision: Station
  ): { adjustedDeltaX: number; adjustedDeltaY: number } {
    if (!this.player) {
      return { adjustedDeltaX: 0, adjustedDeltaY: 0 };
    }

    let adjustedDeltaX = deltaX;
    let adjustedDeltaY = deltaY;

    // Try X movement only
    const xOnlyRect = this.player.getProposedBoundingBox(deltaX, 0);
    const xCollision = this.stationManager.checkCollision(xOnlyRect);
    if (xCollision) {
      adjustedDeltaX = 0;
    }

    // Try Y movement only
    const yOnlyRect = this.player.getProposedBoundingBox(0, deltaY);
    const yCollision = this.stationManager.checkCollision(yOnlyRect);
    if (yCollision) {
      adjustedDeltaY = 0;
    }

    return { adjustedDeltaX, adjustedDeltaY };
  }

  // ==========================================================================
  // Input Handling
  // ==========================================================================

  /**
   * Register the input context for this scene.
   */
  private registerInputContext(): void {
    const bindings = new Map<string, { onPress?: () => void; onRelease?: () => void }>();

    // Movement keys with held key support
    // WASD
    bindings.set('KeyA', {
      onPress: () => this.player?.setInput({ left: true }),
      onRelease: () => this.player?.setInput({ left: false }),
    });
    bindings.set('KeyD', {
      onPress: () => this.player?.setInput({ right: true }),
      onRelease: () => this.player?.setInput({ right: false }),
    });
    bindings.set('KeyW', {
      onPress: () => this.player?.setInput({ up: true }),
      onRelease: () => this.player?.setInput({ up: false }),
    });
    bindings.set('KeyS', {
      onPress: () => this.player?.setInput({ down: true }),
      onRelease: () => this.player?.setInput({ down: false }),
    });

    // Arrow keys
    bindings.set('ArrowLeft', {
      onPress: () => this.player?.setInput({ left: true }),
      onRelease: () => this.player?.setInput({ left: false }),
    });
    bindings.set('ArrowRight', {
      onPress: () => this.player?.setInput({ right: true }),
      onRelease: () => this.player?.setInput({ right: false }),
    });
    bindings.set('ArrowUp', {
      onPress: () => this.player?.setInput({ up: true }),
      onRelease: () => this.player?.setInput({ up: false }),
    });
    bindings.set('ArrowDown', {
      onPress: () => this.player?.setInput({ down: true }),
      onRelease: () => this.player?.setInput({ down: false }),
    });

    // Interaction keys
    bindings.set('Enter', {
      onPress: () => this.tryInteract(),
    });
    bindings.set('Space', {
      onPress: () => this.tryInteract(),
    });

    // Upgrade panel toggle
    bindings.set('KeyU', {
      onPress: () => this.toggleUpgradePanel(),
    });

    // Escape to menu
    bindings.set('Escape', {
      onPress: () => this.openPauseMenu(),
    });

    this.inputContext = {
      id: 'apartment',
      priority: INPUT_PRIORITY.SCENE,
      enabled: true,
      blocksPropagation: false, // Allow global bindings
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('apartment');
  }

  /**
   * Try to interact with the nearby station.
   */
  private tryInteract(): void {
    if (this.paused) {
      return;
    }

    const interacted = this.stationManager.interactWithActive();
    if (interacted) {
      // Clear player input before scene transition
      this.player?.clearInput();
    }
  }

  /**
   * Toggle the upgrade panel.
   */
  private toggleUpgradePanel(): void {
    // Check if any modal is blocking
    if (this.game.inGameMenu.isVisible()) {
      return;
    }

    this.game.upgradePanel.toggle();
  }

  /**
   * Open the pause menu.
   */
  private openPauseMenu(): void {
    // Check if upgrade panel is open - close it first
    if (this.game.upgradePanel.isVisible()) {
      this.game.upgradePanel.hide();
      return;
    }

    // Check if any other modal is visible
    if (this.game.isModalVisible()) {
      return;
    }

    this.game.inGameMenu.show();
  }

  // ==========================================================================
  // Pause Control
  // ==========================================================================

  /**
   * Pause player movement (for minigame launch).
   */
  pause(): void {
    this.paused = true;
    this.player?.clearInput();
  }

  /**
   * Resume player movement.
   */
  resume(): void {
    this.paused = false;
  }

  /**
   * Check if scene is paused.
   */
  isPaused(): boolean {
    return this.paused;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new apartment scene.
 *
 * @param game - The game instance
 * @returns A new ApartmentScene
 */
export function createApartmentScene(game: GameInstance): Scene {
  return new ApartmentScene(game as Game);
}
