/**
 * Root Game Class
 *
 * This is the single entry point for the hacker incremental game. It owns all
 * major systems and manages their lifecycle with explicit dependencies.
 *
 * The Game class uses a factory method pattern (Game.create()) for async
 * initialization, ensuring all dependencies are properly set up before the
 * game starts.
 *
 * Usage:
 *   import { Game } from './game/Game';
 *   import { DEFAULT_CONFIG } from './game/GameConfig';
 *
 *   const game = await Game.create(DEFAULT_CONFIG);
 *   game.start();
 *
 *   // On HMR or shutdown
 *   game.destroy();
 */

import { Application, Container } from 'pixi.js';
import { InputManager } from '../input/InputManager';
import { type GameConfig, createConfig } from './GameConfig';
import { useGameStore } from '../core/game-state';
import { createStorageAdapter } from '../core/storage';
import {
  initializeStorage,
  initializeSaveSystem,
  destroySaveSystem,
  hasSaveData,
} from '../core/save-system';
import {
  startTickEngine,
  stopTickEngine,
} from '../core/tick-engine';
import {
  calculateOfflineProgress,
  applyOfflineProgress,
  type OfflineProgressResult,
} from '../core/offline-progress';

// Import UI systems
import { SceneManager, initSceneManager, destroySceneManager } from '../ui/scenes/scene-manager';
import { setRootContainer } from '../ui/renderer';
import { createHUD, destroyHUD, refreshHUD } from '../ui/hud';
import {
  createUpgradePanel,
  destroyUpgradePanel,
  refreshUpgradePanel,
  toggleUpgradePanel,
  hideUpgradePanel,
} from '../ui/upgrade-panel';
import {
  showWelcomeBackModal,
  destroyWelcomeBackModal,
  isWelcomeBackModalVisible,
} from '../ui/welcome-back-modal';
import {
  initInGameMenu,
  showInGameMenu,
  isInGameMenuVisible,
  destroyInGameMenu,
} from '../ui/in-game-menu';

// Import scenes
import { createMainMenuScene, destroyMainMenuScene } from '../ui/scenes/main-menu';
import { createApartmentScene, destroyApartmentScene } from '../overworld/apartment';
import { createCodeBreakerScene } from '../minigames/code-breaker';

// ============================================================================
// Game State
// ============================================================================

/** Pending offline progress result */
let pendingOfflineProgress: OfflineProgressResult | null = null;

// ============================================================================
// Game Class
// ============================================================================

/**
 * The root game class that owns all major systems.
 */
export class Game {
  /** Game configuration */
  readonly config: GameConfig;

  /** PixiJS Application */
  private app: Application;

  /** Root container for all game content */
  private rootContainer: Container;

  /** Input manager for centralized input handling */
  readonly inputManager: InputManager;

  /** Scene manager for scene transitions */
  private sceneManager: SceneManager;

  /** Whether the game is running */
  private running = false;

  /** Game loop state */
  private lastTime = 0;
  private gameLoopRunning = false;
  private gameLoopBound: (currentTime: number) => void;

  /** Debug control cleanup */
  private cleanupDebugControls: (() => void) | null = null;

  // ==========================================================================
  // Construction (private - use Game.create())
  // ==========================================================================

  private constructor(
    config: GameConfig,
    app: Application,
    rootContainer: Container,
    inputManager: InputManager,
    sceneManager: SceneManager
  ) {
    this.config = config;
    this.app = app;
    this.rootContainer = rootContainer;
    this.inputManager = inputManager;
    this.sceneManager = sceneManager;
    this.gameLoopBound = this.gameLoop.bind(this);
  }

  // ==========================================================================
  // Factory Method
  // ==========================================================================

  /**
   * Create and initialize a new Game instance.
   *
   * This async factory method handles all initialization in the correct order:
   * 1. Create configuration
   * 2. Initialize storage
   * 3. Initialize PixiJS renderer
   * 4. Initialize input manager
   * 5. Create scene manager
   * 6. Create UI components (HUD, upgrade panel)
   * 7. Register scenes
   * 8. Initialize save system
   *
   * @param partialConfig - Optional partial configuration to merge with defaults
   * @returns Promise resolving to a fully initialized Game instance
   */
  static async create(partialConfig: Partial<GameConfig> = {}): Promise<Game> {
    console.log('Hacker Incremental Game initializing...');

    // 1. Create merged configuration
    const config = createConfig(partialConfig);

    // 2. Initialize storage adapter
    const storageAdapter = createStorageAdapter();
    initializeStorage(storageAdapter);

    // Check for existing saves
    if (await hasSaveData()) {
      console.log('Existing save slots found');
    } else {
      console.log('No save data found - new player');
    }

    // 3. Initialize PixiJS application
    const app = new Application();
    await app.init({
      width: config.canvas.width,
      height: config.canvas.height,
      backgroundColor: config.canvas.backgroundColor,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false, // Keep crisp for ASCII aesthetic
    });

    // Mount canvas to DOM
    const container = document.getElementById(config.canvas.containerId);
    if (!container) {
      throw new Error(`Container element #${config.canvas.containerId} not found`);
    }

    // Clear any existing canvas (for HMR)
    const existingCanvas = container.querySelector('canvas');
    if (existingCanvas) {
      existingCanvas.remove();
    }
    container.appendChild(app.canvas);

    // Create root container
    const rootContainer = new Container();
    rootContainer.label = 'root';
    app.stage.addChild(rootContainer);

    // Set the root container in the renderer module for other UI modules to access
    setRootContainer(rootContainer);

    console.log(`PixiJS renderer initialized: ${config.canvas.width}x${config.canvas.height}`);

    // 4. Initialize input manager
    const inputManager = new InputManager();
    inputManager.init();

    // 5. Create scene manager (using singleton for other modules to access)
    const sceneManager = initSceneManager(rootContainer);
    console.log('Scene manager initialized');

    // 6. Create UI components
    const hud = createHUD();
    rootContainer.addChild(hud);
    console.log('HUD created');

    const upgradePanel = createUpgradePanel();
    rootContainer.addChild(upgradePanel);
    hideUpgradePanel(); // Hide by default - will be shown when entering game
    console.log('Upgrade panel created (hidden)');

    // 7. Create game instance
    const game = new Game(
      config,
      app,
      rootContainer,
      inputManager,
      sceneManager
    );

    // 8. Register scenes and set up callbacks
    game.registerScenes();

    // 9. Initialize save system (auto-save, visibility handlers)
    initializeSaveSystem();

    // 10. Set up global input bindings
    game.setupGlobalInputBindings();

    console.log('Game initialized successfully');
    return game;
  }

  // ==========================================================================
  // Scene Registration
  // ==========================================================================

  /**
   * Register all game scenes with the scene manager.
   */
  private registerScenes(): void {
    const self = this;

    // Main menu scene
    const mainMenuScene = createMainMenuScene({
      onNewGame: async () => {
        console.log('Starting new game...');
        refreshHUD();
        refreshUpgradePanel();
        await self.enterGame();
      },
      onContinue: async () => {
        console.log('Continuing saved game...');
        self.calculatePendingOfflineProgress();
        refreshHUD();
        refreshUpgradePanel();
        await self.enterGame();
      },
    });
    this.sceneManager.register('main-menu', mainMenuScene);
    console.log('Main menu scene registered');

    // Apartment scene
    const apartmentScene = createApartmentScene({
      onDeskInteract: async () => {
        console.log('Desk interaction - Launching Code Breaker minigame');
        await self.sceneManager.switchTo('code-breaker');
      },
      onCouchInteract: () => {
        console.log('Couch interaction - coming in post-MVP');
      },
      onBedInteract: () => {
        console.log('Bed interaction - coming in post-MVP');
      },
    });
    this.sceneManager.register('apartment', apartmentScene);
    console.log('Apartment scene registered');

    // Code Breaker minigame scene
    const codeBreakerScene = createCodeBreakerScene({
      onComplete: (result) => {
        console.log('Code Breaker completed!');
        console.log(`  Score: ${result.score}`);
        console.log(`  Max Combo: ${result.maxCombo}`);
        console.log(`  Money Earned: $${result.rewards.money}`);
        refreshHUD();
      },
      onExit: async () => {
        console.log('Exiting Code Breaker - returning to apartment');
        await self.sceneManager.switchTo('apartment');
      },
    });
    this.sceneManager.register('code-breaker', codeBreakerScene);
    console.log('Code Breaker minigame registered');
  }

  // ==========================================================================
  // Global Input Bindings
  // ==========================================================================

  /**
   * Set up global input bindings that work across all contexts.
   */
  private setupGlobalInputBindings(): void {
    const self = this;

    // Escape key - ONLY OPEN in-game menu (when not already visible)
    // Closing is handled by in-game-menu.ts itself to properly handle confirm dialogs
    this.inputManager.registerGlobalBinding({
      code: 'Escape',
      onPress: () => {
        const currentScene = self.sceneManager.getCurrentSceneId();

        // If menu is already visible, let in-game-menu.ts handle it (for confirm dialogs, etc.)
        if (isInGameMenuVisible()) {
          return;
        }

        // Don't open if on main menu
        if (currentScene === 'main-menu') {
          return;
        }

        // Don't open if welcome-back modal is visible
        if (isWelcomeBackModalVisible()) {
          return;
        }

        // Show menu
        hideUpgradePanel(); // Hide upgrade panel when pausing
        showInGameMenu();
      },
      condition: () => {
        // Only handle if not in an input field
        return true;
      },
    });

    // Debug controls (dev mode only)
    if (this.config.debug.enabled) {
      this.setupDebugControls();
    }
  }

  /**
   * Set up debug keyboard controls.
   */
  private setupDebugControls(): void {
    const handleDebugKeydown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();

      // Only handle debug keys if not holding modifiers
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      // Don't handle if in input field
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (key) {
        case 'm':
          useGameStore.getState().addResource('money', '1000');
          console.log('Debug: Added 1000 money');
          break;

        case 'r':
          refreshHUD();
          console.log('Debug: Refreshed HUD');
          break;

        case 't':
          useGameStore.getState().addResource('technique', '100');
          console.log('Debug: Added 100 technique');
          break;

        case 'n':
          useGameStore.getState().addResource('renown', '50');
          console.log('Debug: Added 50 renown');
          break;

        case 'u':
          toggleUpgradePanel();
          console.log('Debug: Toggled upgrade panel');
          break;
      }
    };

    window.addEventListener('keydown', handleDebugKeydown);

    this.cleanupDebugControls = () => {
      window.removeEventListener('keydown', handleDebugKeydown);
      console.log('Debug controls cleaned up');
    };

    console.log('Debug controls enabled: M=add money, T=add technique, N=add renown, R=refresh HUD, U=toggle upgrades');
  }

  // ==========================================================================
  // Game Flow
  // ==========================================================================

  /**
   * Calculate pending offline progress from the loaded save state.
   */
  private calculatePendingOfflineProgress(): void {
    const state = useGameStore.getState();
    const lastPlayedTimestamp = state.lastPlayed;

    if (lastPlayedTimestamp > 0) {
      pendingOfflineProgress = calculateOfflineProgress(lastPlayedTimestamp);

      if (pendingOfflineProgress.wasCalculated) {
        console.log('Offline progress calculated:');
        console.log('  - Time away:', pendingOfflineProgress.formattedTimeAway);
      }
    }
  }

  /**
   * Enter the game (apartment scene) and handle offline progress.
   */
  private async enterGame(): Promise<void> {
    await this.sceneManager.switchTo('apartment');

    // Upgrade panel intentionally hidden until we add explicit UI to show it

    // Handle offline progress if applicable
    if (pendingOfflineProgress && pendingOfflineProgress.shouldShowModal) {
      console.log('Showing welcome-back modal...');

      showWelcomeBackModal(pendingOfflineProgress, () => {
        if (pendingOfflineProgress) {
          applyOfflineProgress(pendingOfflineProgress);
          refreshHUD();
          pendingOfflineProgress = null;
        }
        console.log('Welcome-back modal dismissed, offline progress applied');
      });
    } else if (pendingOfflineProgress && pendingOfflineProgress.wasCalculated) {
      // Less than 1 minute away - apply silently without modal
      applyOfflineProgress(pendingOfflineProgress);
      refreshHUD();
      console.log('Offline progress applied silently (short absence)');
      pendingOfflineProgress = null;
    }
  }

  // ==========================================================================
  // Game Loop
  // ==========================================================================

  /**
   * The main game loop using requestAnimationFrame.
   */
  private gameLoop(currentTime: number): void {
    if (!this.gameLoopRunning) return;

    // Calculate delta time (capped at 100ms to prevent huge jumps)
    const deltaMs = this.lastTime === 0 ? 16.67 : Math.min(currentTime - this.lastTime, 100);
    this.lastTime = currentTime;

    // Update the current scene
    this.sceneManager.update(deltaMs);

    // Continue the loop
    requestAnimationFrame(this.gameLoopBound);
  }

  /**
   * Start the game loop.
   */
  private startGameLoop(): void {
    if (this.gameLoopRunning) return;

    this.gameLoopRunning = true;
    this.lastTime = 0;
    requestAnimationFrame(this.gameLoopBound);
    console.log('Game loop started');
  }

  /**
   * Stop the game loop.
   */
  private stopGameLoop(): void {
    this.gameLoopRunning = false;
    console.log('Game loop stopped');
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start the game.
   * Initializes the tick engine, game loop, and switches to the main menu.
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('Game already running');
      return;
    }

    // Initialize in-game menu with exit callback
    const self = this;
    initInGameMenu({
      onExitToMainMenu: async () => {
        console.log('Exiting to main menu...');
        pendingOfflineProgress = null;
        hideUpgradePanel(); // Hide upgrade panel on main menu
        await self.sceneManager.switchTo('main-menu');
      },
      canOpenMenu: () => {
        const currentScene = self.sceneManager.getCurrentSceneId();
        return currentScene !== 'main-menu';
      },
    });
    console.log('In-game menu initialized');

    // Start tick engine
    startTickEngine();
    console.log('Tick engine started (idle progression active)');

    // Start game loop
    this.startGameLoop();

    // Switch to main menu
    await this.sceneManager.switchTo('main-menu');
    console.log('Main menu scene active');

    // Hide loading screen
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.classList.add('hidden');
    }

    this.running = true;

    console.log('Game started!');
    console.log('Systems active:');
    console.log('  - Zustand store: ready');
    console.log('  - Save system: active (auto-save every 30s)');
    console.log('  - PixiJS renderer: running');
    console.log('  - HUD: displaying resources');
    console.log('  - Upgrade panel: displaying upgrades');
    console.log('  - Scene manager: main-menu scene active');
    console.log('  - In-game menu: ready (Escape key)');
    console.log('  - Tick engine: idle progression active');
    console.log('  - Game loop: running');
    console.log('');
    console.log('Controls:');
    console.log('  - Arrow Keys / WASD: Navigate menus');
    console.log('  - Enter/Space: Select menu item');
    console.log('  - Escape: Open/close in-game menu');
    console.log('  - A/D or Arrow Keys: Move player (in game)');
  }

  /**
   * Stop the game and clean up all resources.
   */
  destroy(): void {
    if (!this.running) {
      return;
    }

    console.log('Destroying game...');

    // Stop loops
    this.stopGameLoop();
    stopTickEngine();

    // Clean up debug controls
    if (this.cleanupDebugControls) {
      this.cleanupDebugControls();
      this.cleanupDebugControls = null;
    }

    // Destroy systems in reverse order
    destroyInGameMenu();
    destroyMainMenuScene();
    destroyApartmentScene();
    destroySaveSystem();
    destroyHUD();
    destroyUpgradePanel();
    destroyWelcomeBackModal();

    // Destroy scene manager (both instance and singleton)
    this.sceneManager.destroy();
    destroySceneManager();

    // Destroy input manager
    this.inputManager.destroy();

    // Destroy PixiJS app
    this.app.destroy(true, { children: true, texture: true });

    this.running = false;
    console.log('Game destroyed');
  }

  // ==========================================================================
  // Accessors
  // ==========================================================================

  /**
   * Get the scene manager.
   */
  getSceneManager(): SceneManager {
    return this.sceneManager;
  }

  /**
   * Get the root container.
   */
  getRootContainer(): Container {
    return this.rootContainer;
  }

  /**
   * Get the PixiJS application.
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Get canvas dimensions.
   */
  getCanvasSize(): { width: number; height: number } {
    return {
      width: this.app.screen.width,
      height: this.app.screen.height,
    };
  }

  /**
   * Check if the game is running.
   */
  isRunning(): boolean {
    return this.running;
  }
}
