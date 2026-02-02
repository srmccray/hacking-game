/**
 * Town Scene for the Hacker Incremental Game
 *
 * A cyberpunk city street with four interactive storefronts. The player
 * walks along the street and can interact with each location:
 *
 * - Bio-Forge Cybernetics (magenta) - Coming Soon
 * - Chip Shop (cyan) - Coming Soon
 * - Neon Drip Cafe (yellow) - Coming Soon
 * - Your Apartment (green) - Returns to apartment scene
 *
 * Layout (800x600 canvas):
 * ```
 * ================================================================================
 * |  [skyline silhouette]                                                        |
 * |  ╔═BIO-FORGE═╗  ╔═CHIP SHOP═╗  ╔═NEON DRIP═╗  ╔═YOUR APT═╗               |
 * |  ║  building  ║  ║  building  ║  ║  building  ║  ║  building ║               |
 * |  ╚════════════╝  ╚════════════╝  ╚════════════╝  ╚══════════╝               |
 * |  ==========================STREET==========================================  |
 * |         @                                                                    |
 * |_________________________________________________________________________ ____|
 * ```
 *
 * Usage:
 *   import { createTownScene } from './TownScene';
 *   sceneManager.register('town', () => createTownScene(game));
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Scene, GameInstance } from '../../core/types';
import type { Game } from '../../game/Game';
import type { InputContext } from '../../input/InputManager';
import { INPUT_PRIORITY } from '../../input/InputManager';
import { COLORS } from '../../rendering/Renderer';
import { FONT_FAMILY } from '../../rendering/styles';
import { Player, type BoundingBox } from '../apartment/Player';
import { Station, StationManager } from '../apartment/Station';
import type { StationVisual } from '../apartment/Station';
import { GameEvents } from '../../events/game-events';
import { ApartmentHUD } from '../apartment/ApartmentHUD';
import {
  createTownBackground,
  createSceneTitle,
  createInstructions,
  getTownStationPositions,
  NEON_COLORS,
  STREET_LINE_Y,
} from './town-visuals';

// ============================================================================
// Configuration
// ============================================================================

/** Town scene layout configuration */
const TOWN_CONFIG = {
  /** Left boundary for player movement */
  leftBound: 30,
  /** Right boundary for player movement */
  rightBound: 770,
  /** Top boundary (just below the curb/street line) */
  topBound: STREET_LINE_Y + 10,
  /** Bottom boundary (above the floor) */
  bottomBound: 500,
  /** Player starting X position (near apartment entrance, right side) */
  playerStartX: 670,
  /** Player starting Y position (on the street) */
  playerStartY: 400,
};

// ============================================================================
// Station Visual Configs
// ============================================================================

/**
 * Create a station visual config for a town storefront.
 */
function createStoreVisual(
  signText: string,
  _neonColor: number,
  functional: boolean,
  promptText?: string
): StationVisual {
  // Pick an icon character based on store type
  const label = functional ? '[>]' : '[?]';
  const visual: StationVisual = {
    label,
    name: signText,
    width: 60,
    height: 30,
    functional,
    ascii: [`  [${signText}]  `],
  };
  if (promptText !== undefined) {
    visual.promptText = promptText;
  }
  return visual;
}

// ============================================================================
// Coming Soon Overlay
// ============================================================================

/**
 * Create a "Coming Soon" overlay dialog.
 * A semi-transparent overlay with centered text, dismissed by Enter or Escape.
 */
function createComingSoonOverlay(
  width: number,
  height: number,
  storeName: string,
  neonColor: number
): Container {
  const container = new Container();
  container.label = 'coming-soon-overlay';
  container.visible = false;

  // Semi-transparent dark background
  const bg = new Graphics();
  bg.fill({ color: 0x000000, alpha: 0.75 });
  bg.rect(0, 0, width, height);
  bg.fill();
  container.addChild(bg);

  // Dialog box
  const dialogWidth = 320;
  const dialogHeight = 160;
  const dialogX = (width - dialogWidth) / 2;
  const dialogY = (height - dialogHeight) / 2;

  const dialog = new Graphics();
  // Background
  dialog.fill({ color: 0x0a0a0a, alpha: 0.95 });
  dialog.roundRect(dialogX, dialogY, dialogWidth, dialogHeight, 6);
  dialog.fill();

  // Border with neon color
  dialog.stroke({ color: neonColor, width: 2, alpha: 0.8 });
  dialog.roundRect(dialogX, dialogY, dialogWidth, dialogHeight, 6);
  dialog.stroke();

  // Corner accents
  const accentSize = 8;
  dialog.stroke({ color: neonColor, width: 2 });
  // Top-left
  dialog.moveTo(dialogX, dialogY + accentSize);
  dialog.lineTo(dialogX, dialogY);
  dialog.lineTo(dialogX + accentSize, dialogY);
  // Top-right
  dialog.moveTo(dialogX + dialogWidth - accentSize, dialogY);
  dialog.lineTo(dialogX + dialogWidth, dialogY);
  dialog.lineTo(dialogX + dialogWidth, dialogY + accentSize);
  // Bottom-left
  dialog.moveTo(dialogX, dialogY + dialogHeight - accentSize);
  dialog.lineTo(dialogX, dialogY + dialogHeight);
  dialog.lineTo(dialogX + accentSize, dialogY + dialogHeight);
  // Bottom-right
  dialog.moveTo(dialogX + dialogWidth - accentSize, dialogY + dialogHeight);
  dialog.lineTo(dialogX + dialogWidth, dialogY + dialogHeight);
  dialog.lineTo(dialogX + dialogWidth, dialogY + dialogHeight - accentSize);
  dialog.stroke();

  container.addChild(dialog);

  // Store name
  const nameStyle = new TextStyle({
    fontFamily: FONT_FAMILY,
    fontSize: 18,
    fill: neonColor,
    fontWeight: 'bold',
    dropShadow: {
      color: neonColor,
      blur: 6,
      alpha: 0.8,
      distance: 0,
    },
  });

  const nameText = new Text({ text: storeName, style: nameStyle });
  nameText.anchor.set(0.5, 0.5);
  nameText.x = width / 2;
  nameText.y = dialogY + 45;
  container.addChild(nameText);

  // "Coming Soon" text
  const comingSoonStyle = new TextStyle({
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fill: COLORS.TERMINAL_DIM,
  });

  const comingSoonText = new Text({
    text: '> COMING SOON...',
    style: comingSoonStyle,
  });
  comingSoonText.anchor.set(0.5, 0.5);
  comingSoonText.x = width / 2;
  comingSoonText.y = dialogY + 85;
  container.addChild(comingSoonText);

  // Dismiss instruction
  const dismissStyle = new TextStyle({
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fill: COLORS.TERMINAL_DIM,
  });

  const dismissText = new Text({
    text: '[ENTER/ESC] Close',
    style: dismissStyle,
  });
  dismissText.anchor.set(0.5, 0.5);
  dismissText.x = width / 2;
  dismissText.y = dialogY + 125;
  container.addChild(dismissText);

  return container;
}

// ============================================================================
// Scene Implementation
// ============================================================================

/**
 * Town scene class.
 */
class TownScene implements Scene {
  readonly id = 'town';

  /** The PixiJS container for this scene */
  private readonly container: Container;

  /** Reference to the game instance */
  private readonly game: Game;

  /** The player character */
  private player: Player | null = null;

  /** Station manager */
  private readonly stationManager: StationManager;

  /** Resource display HUD */
  private apartmentHUD: ApartmentHUD | null = null;

  /** Input context for this scene */
  private inputContext: InputContext | null = null;

  /** Dialog input context (higher priority, for Coming Soon overlay) */
  private dialogContext: InputContext | null = null;

  /** Whether the scene is paused */
  private paused = false;

  /** Currently visible Coming Soon overlay */
  private activeOverlay: Container | null = null;

  /** All Coming Soon overlays, keyed by store name */
  private readonly overlays: Map<string, Container> = new Map();

  constructor(game: Game) {
    this.game = game;
    this.container = new Container();
    this.container.label = 'town-scene';
    this.stationManager = new StationManager();
  }

  // ==========================================================================
  // Scene Lifecycle
  // ==========================================================================

  getContainer(): Container {
    return this.container;
  }

  onEnter(): void {
    console.log('[TownScene] Entering scene');

    // Create the environment
    this.createEnvironment();

    // Create resource HUD
    this.createResourceHUD();

    // Create stations
    this.createStations();

    // Create player
    this.createPlayer();

    // Create Coming Soon overlays
    this.createOverlays();

    // Register input context
    this.registerInputContext();

    // Emit scene entered event
    this.game.eventBus.emit(GameEvents.SCENE_ENTERED, {
      sceneId: this.id,
    });
  }

  onExit(): void {
    console.log('[TownScene] Exiting scene');

    // Dismiss any active overlay
    this.dismissOverlay();

    // Disable input contexts
    if (this.inputContext) {
      this.game.inputManager.disableContext(this.inputContext.id);
    }
    if (this.dialogContext) {
      this.game.inputManager.disableContext(this.dialogContext.id);
    }

    // Clear player input
    if (this.player) {
      this.player.clearInput();
    }
  }

  onUpdate(deltaMs: number): void {
    if (this.paused || !this.player || this.activeOverlay) {
      return;
    }

    // Get proposed movement
    const delta = this.player.update(deltaMs);

    if (delta.deltaX !== 0 || delta.deltaY !== 0) {
      // Check collision with stations
      const proposedRect = this.player.getProposedBoundingBox(delta.deltaX, delta.deltaY);
      const collision = this.stationManager.checkCollision(proposedRect);

      if (collision) {
        const { adjustedDeltaX, adjustedDeltaY } = this.resolveCollision(delta.deltaX, delta.deltaY);
        this.player.applyMovement(adjustedDeltaX, adjustedDeltaY);
      } else {
        this.player.applyMovement(delta.deltaX, delta.deltaY);
      }
    }

    // Update which station the player is near
    const playerRect = this.player.getBoundingBox();
    const interactionRect: BoundingBox = {
      x: playerRect.x - 10,
      y: playerRect.y - 10,
      width: playerRect.width + 20,
      height: playerRect.height + 20,
    };
    this.stationManager.updatePlayerPosition(interactionRect);
  }

  onDestroy(): void {
    console.log('[TownScene] Destroying scene');

    // Unregister input contexts
    if (this.inputContext) {
      this.game.inputManager.unregisterContext(this.inputContext.id);
    }
    if (this.dialogContext) {
      this.game.inputManager.unregisterContext(this.dialogContext.id);
    }

    // Destroy resource HUD
    if (this.apartmentHUD) {
      this.apartmentHUD.destroy();
      this.apartmentHUD = null;
    }

    // Destroy player
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }

    // Destroy station manager
    this.stationManager.destroy();

    // Clear overlays map
    this.overlays.clear();
    this.activeOverlay = null;

    // Destroy container and children
    this.container.destroy({ children: true });
  }

  // ==========================================================================
  // Environment Creation
  // ==========================================================================

  /**
   * Create the town environment (buildings, street, decorations).
   */
  private createEnvironment(): void {
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;

    // Full background with buildings and street
    const background = createTownBackground(width, height);
    this.container.addChild(background);

    // Scene title
    const title = createSceneTitle(width);
    this.container.addChild(title);

    // Instructions
    const instructions = createInstructions(width, height);
    this.container.addChild(instructions);
  }

  // ==========================================================================
  // Resource HUD
  // ==========================================================================

  /**
   * Create the resource display HUD in the top margin.
   */
  private createResourceHUD(): void {
    this.apartmentHUD = new ApartmentHUD(
      this.game.store,
      this.container,
      this.game.config
    );
  }

  // ==========================================================================
  // Station Creation
  // ==========================================================================

  /**
   * Create all stations in the town.
   */
  private createStations(): void {
    const positions = getTownStationPositions();

    for (const pos of positions) {
      const isApartment = pos.buildingName === 'apartment';
      const functional = true; // All are interactable

      const visual = createStoreVisual(
        pos.signText,
        pos.neonColor,
        functional,
        isApartment ? '[ENTER] Go Home' : '[ENTER] Enter'
      );

      const station = new Station(pos.type, pos.x, pos.y, {
        visual,
        enabled: true,
        onInteract: (): void => {
          if (isApartment) {
            console.log('[TownScene] Apartment entrance - switching to apartment');
            this.player?.clearInput();
            void this.game.switchScene('apartment');
          } else {
            console.log(`[TownScene] ${pos.signText} interaction - showing Coming Soon`);
            this.showOverlay(pos.buildingName);
          }
        },
      });

      this.stationManager.addStation(station);
      this.container.addChild(station.container);
    }
  }

  // ==========================================================================
  // Player Creation
  // ==========================================================================

  /**
   * Create the player character.
   */
  private createPlayer(): void {
    this.player = new Player(
      TOWN_CONFIG.playerStartX,
      TOWN_CONFIG.playerStartY,
      this.game.config.movement
    );

    // Set bounds for the street area
    this.player.setBounds(
      TOWN_CONFIG.leftBound,
      TOWN_CONFIG.rightBound,
      TOWN_CONFIG.topBound,
      TOWN_CONFIG.bottomBound
    );

    this.container.addChild(this.player.container);
  }

  // ==========================================================================
  // Coming Soon Overlays
  // ==========================================================================

  /**
   * Pre-create Coming Soon overlays for each placeholder store.
   */
  private createOverlays(): void {
    const width = this.game.config.canvas.width;
    const height = this.game.config.canvas.height;

    const stores: Array<{ name: string; displayName: string; color: number }> = [
      { name: 'bio-forge', displayName: 'BIO-FORGE CYBERNETICS', color: NEON_COLORS.BIO_FORGE },
      { name: 'chip-shop', displayName: 'CHIP SHOP', color: NEON_COLORS.CHIP_SHOP },
      { name: 'neon-drip', displayName: 'NEON DRIP CAFE', color: NEON_COLORS.NEON_DRIP },
    ];

    for (const store of stores) {
      const overlay = createComingSoonOverlay(width, height, store.displayName, store.color);
      this.overlays.set(store.name, overlay);
      this.container.addChild(overlay);
    }
  }

  /**
   * Show a Coming Soon overlay for a specific store.
   */
  private showOverlay(storeName: string): void {
    const overlay = this.overlays.get(storeName);
    if (!overlay) {
      return;
    }

    this.activeOverlay = overlay;
    overlay.visible = true;

    // Clear player input so they stop moving
    this.player?.clearInput();

    // Enable dialog input context
    if (this.dialogContext) {
      this.game.inputManager.enableContext(this.dialogContext.id);
    }
  }

  /**
   * Dismiss the active Coming Soon overlay.
   */
  private dismissOverlay(): void {
    if (this.activeOverlay) {
      this.activeOverlay.visible = false;
      this.activeOverlay = null;

      // Disable dialog input context
      if (this.dialogContext) {
        this.game.inputManager.disableContext(this.dialogContext.id);
      }
    }
  }

  // ==========================================================================
  // Collision Resolution
  // ==========================================================================

  /**
   * Resolve collision by trying to slide along the obstacle.
   */
  private resolveCollision(
    deltaX: number,
    deltaY: number
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

    // Movement keys with held key support (WASD)
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

    // Escape to go back to apartment (shortcut)
    bindings.set('Escape', {
      onPress: () => this.handleEscape(),
    });

    this.inputContext = {
      id: 'town',
      priority: INPUT_PRIORITY.SCENE,
      enabled: true,
      blocksPropagation: false,
      bindings,
    };

    this.game.inputManager.registerContext(this.inputContext);
    this.game.inputManager.enableContext('town');

    // Dialog context for dismissing Coming Soon overlays
    const dialogBindings = new Map<string, { onPress?: () => void }>();
    dialogBindings.set('Enter', {
      onPress: () => this.dismissOverlay(),
    });
    dialogBindings.set('Escape', {
      onPress: () => this.dismissOverlay(),
    });
    dialogBindings.set('Space', {
      onPress: () => this.dismissOverlay(),
    });

    this.dialogContext = {
      id: 'town-dialog',
      priority: INPUT_PRIORITY.DIALOG,
      enabled: false,
      blocksPropagation: true,
      bindings: dialogBindings,
    };

    this.game.inputManager.registerContext(this.dialogContext);
  }

  /**
   * Try to interact with the nearby station.
   */
  private tryInteract(): void {
    if (this.paused || this.activeOverlay) {
      return;
    }

    const interacted = this.stationManager.interactWithActive();
    if (interacted) {
      this.player?.clearInput();
    }
  }

  /**
   * Handle Escape key - go back to apartment or dismiss overlay.
   */
  private handleEscape(): void {
    if (this.activeOverlay) {
      this.dismissOverlay();
      return;
    }

    // Shortcut: Escape returns to apartment
    this.player?.clearInput();
    void this.game.switchScene('apartment');
  }

  // ==========================================================================
  // Pause Control
  // ==========================================================================

  /**
   * Pause player movement.
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
 * Create a new town scene.
 *
 * @param game - The game instance
 * @returns A new TownScene
 */
export function createTownScene(game: GameInstance): Scene {
  return new TownScene(game as Game);
}
