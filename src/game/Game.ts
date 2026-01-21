/**
 * Root Game Class for v2 Architecture
 *
 * This is the single entry point for the hacker incremental game. It owns all
 * major systems and manages their lifecycle with explicit dependencies.
 *
 * The Game class uses an async factory pattern (Game.create()) for initialization,
 * ensuring all dependencies are properly set up before the game starts.
 *
 * Key features:
 * - Single entry point for all game systems
 * - Explicit dependency ownership (no service locator)
 * - Async initialization with proper error handling
 * - Clean lifecycle management with destroy()
 * - HMR-safe cleanup
 *
 * Usage:
 *   import { Game } from './game/Game';
 *
 *   const game = await Game.create();
 *   await game.start();
 *
 *   // On HMR or shutdown
 *   game.destroy();
 */

import type { GameConfig, PartialGameConfig } from './GameConfig';
import { createConfig } from './GameConfig';
import { Renderer } from '../rendering/Renderer';
import { InputManager } from '../input/InputManager';
import { SceneManager } from '../scenes/SceneManager';
import { createGameStore, type GameStore } from '../core/state/game-store';
import { SaveManager } from '../core/persistence/save-manager';
import { createGameEventBus, type GameEventBus } from '../events/game-events';
import type { GameInstance } from '../core/types';
import { createMainMenuScene } from '../scenes/main-menu';
import { createApartmentScene } from '../scenes/apartment';
import { MinigameRegistry, registerCodeBreaker, createCodeBreakerScene } from '../minigames';
import { TickEngine } from '../core/progression';
import { UpgradePanel, InGameMenu, WelcomeBackModal } from '../ui';
import {
  calculateOfflineProgress,
  applyOfflineProgress,
  type OfflineProgressResult,
} from '../core/progression/offline-progress';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for Game.create()
 */
export interface GameCreateOptions {
  /** Partial configuration to merge with defaults */
  config?: PartialGameConfig;
}

// ============================================================================
// Game Class
// ============================================================================

/**
 * Root game class that owns all major systems.
 *
 * Use the static `create()` method to instantiate - constructor is private.
 */
export class Game implements GameInstance {
  // ==========================================================================
  // Public System References
  // ==========================================================================

  /** Game configuration (immutable after creation) */
  readonly config: GameConfig;

  /** PixiJS renderer wrapper */
  readonly renderer: Renderer;

  /** Centralized input manager */
  readonly inputManager: InputManager;

  /** Scene lifecycle manager */
  readonly sceneManager: SceneManager;

  /** Zustand game state store */
  readonly store: GameStore;

  /** Event bus for cross-system communication */
  readonly eventBus: GameEventBus;

  /** Save/load manager with auto-save support */
  readonly saveManager: SaveManager;

  /** Registry for minigame definitions */
  readonly minigameRegistry: MinigameRegistry;

  /** Tick engine for idle progression */
  readonly tickEngine: TickEngine;

  // ==========================================================================
  // Private State
  // ==========================================================================

  /** Whether the game is currently running */
  private running = false;

  /** Upgrade panel UI component (lazy-created) */
  private _upgradePanel: UpgradePanel | null = null;

  /** In-game menu component (lazy-created) */
  private _inGameMenu: InGameMenu | null = null;

  /** Welcome back modal component (lazy-created) */
  private _welcomeBackModal: WelcomeBackModal | null = null;

  /** Pending offline progress result to show after scene transition */
  private pendingOfflineProgress: OfflineProgressResult | null = null;

  /** Last frame timestamp for delta calculation */
  private lastFrameTime = 0;

  /** Whether the game loop is active */
  private gameLoopActive = false;

  /** Bound game loop handler for cleanup */
  private readonly boundGameLoop: (currentTime: number) => void;

  /** Cleanup function for debug controls (if enabled) */
  private cleanupDebugControls: (() => void) | null = null;

  // ==========================================================================
  // Construction (private - use Game.create())
  // ==========================================================================

  /**
   * Private constructor - use Game.create() to instantiate.
   */
  private constructor(
    config: GameConfig,
    renderer: Renderer,
    inputManager: InputManager,
    sceneManager: SceneManager,
    store: GameStore,
    eventBus: GameEventBus,
    saveManager: SaveManager,
    minigameRegistry: MinigameRegistry,
    tickEngine: TickEngine
  ) {
    this.config = config;
    this.renderer = renderer;
    this.inputManager = inputManager;
    this.sceneManager = sceneManager;
    this.store = store;
    this.eventBus = eventBus;
    this.saveManager = saveManager;
    this.minigameRegistry = minigameRegistry;
    this.tickEngine = tickEngine;
    this.boundGameLoop = this.gameLoop.bind(this);
  }

  // ==========================================================================
  // Factory Method
  // ==========================================================================

  /**
   * Create and initialize a new Game instance.
   *
   * This async factory method handles all initialization in the correct order:
   * 1. Merge configuration with defaults
   * 2. Initialize PixiJS renderer
   * 3. Create event bus
   * 4. Create game store
   * 5. Initialize input manager
   * 6. Create scene manager
   * 7. Create save manager
   * 8. Wire up systems
   *
   * @param options - Optional creation options
   * @returns Promise resolving to a fully initialized Game instance
   * @throws Error if initialization fails
   *
   * @example
   * ```typescript
   * // With defaults
   * const game = await Game.create();
   *
   * // With custom config
   * const game = await Game.create({
   *   config: { debug: { enabled: true } }
   * });
   * ```
   */
  static async create(options: GameCreateOptions = {}): Promise<Game> {
    console.log('[Game] Initializing...');

    // 1. Create merged configuration
    const config = createConfig(options.config ?? {});
    console.log(`[Game] Config loaded: ${config.canvas.width}x${config.canvas.height}`);

    // 2. Initialize PixiJS renderer
    const renderer = await Renderer.create(config.canvas);
    console.log('[Game] Renderer initialized');

    // 3. Create event bus
    const eventBus = createGameEventBus();
    console.log('[Game] Event bus created');

    // 4. Create game store
    const store = createGameStore();
    console.log('[Game] Store created');

    // 5. Initialize input manager
    const inputManager = new InputManager();
    inputManager.init();
    console.log('[Game] Input manager initialized');

    // 6. Create scene manager
    const sceneManager = new SceneManager(renderer.root);
    console.log('[Game] Scene manager created');

    // 7. Create save manager
    const saveManager = new SaveManager(store, eventBus, config.storage);
    await saveManager.init();
    console.log('[Game] Save manager initialized');

    // 8. Create minigame registry and register minigames
    const minigameRegistry = new MinigameRegistry();
    registerCodeBreaker(minigameRegistry);
    console.log('[Game] Minigame registry created');

    // 9. Create tick engine for idle progression
    const tickEngine = new TickEngine(store, config);
    console.log('[Game] Tick engine created');

    // 10. Create game instance
    const game = new Game(
      config,
      renderer,
      inputManager,
      sceneManager,
      store,
      eventBus,
      saveManager,
      minigameRegistry,
      tickEngine
    );

    // 11. Register scenes
    game.registerScenes();
    console.log('[Game] Scenes registered');

    // 12. Set up global input bindings
    game.setupGlobalInputBindings();
    console.log('[Game] Global input bindings configured');

    // Note: UpgradePanel is created lazily on first access via game.upgradePanel

    console.log('[Game] Initialization complete');
    return game;
  }

  // ==========================================================================
  // Scene Registration
  // ==========================================================================

  /**
   * Register all game scenes with the scene manager.
   *
   * Scenes are registered as factory functions for lazy instantiation.
   * The Game instance is captured by closure for scene access to systems.
   */
  private registerScenes(): void {
    // Main menu scene - captures `this` in closure
    const game = this;
    this.sceneManager.register('main-menu', () => {
      return createMainMenuScene(game);
    });

    // Code Breaker minigame scene
    this.sceneManager.register('code-breaker', () => {
      return createCodeBreakerScene(game);
    });

    // Apartment scene (main gameplay hub)
    this.sceneManager.register('apartment', () => {
      return createApartmentScene(game);
    });
  }

  // ==========================================================================
  // Global Input Bindings
  // ==========================================================================

  /**
   * Set up global input bindings that work across all contexts.
   */
  private setupGlobalInputBindings(): void {
    // Escape key handling is typically context-specific, but we can add
    // game-wide bindings here if needed.

    // Debug controls (dev mode only)
    if (this.config.debug.enabled) {
      this.setupDebugControls();
    }
  }

  /**
   * Set up debug keyboard controls for development.
   */
  private setupDebugControls(): void {
    const handleDebugKey = (event: KeyboardEvent): void => {
      // Skip if modifier keys held or in input element
      if (event.ctrlKey || event.metaKey || event.altKey) {return;}
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      const state = this.store.getState();

      switch (key) {
        case 'm':
          state.addResource('money', '1000');
          console.log('[Debug] Added 1000 money');
          break;
        case 't':
          state.addResource('technique', '100');
          console.log('[Debug] Added 100 technique');
          break;
        case 'n':
          state.addResource('renown', '50');
          console.log('[Debug] Added 50 renown');
          break;
      }
    };

    window.addEventListener('keydown', handleDebugKey);

    this.cleanupDebugControls = (): void => {
      window.removeEventListener('keydown', handleDebugKey);
      console.log('[Debug] Controls removed');
    };

    console.log('[Debug] Controls enabled: M=money, T=technique, N=renown');
  }

  // ==========================================================================
  // Game Loop
  // ==========================================================================

  /**
   * Main game loop using requestAnimationFrame.
   */
  private gameLoop(currentTime: number): void {
    if (!this.gameLoopActive) {return;}

    // Calculate delta time (capped to prevent huge jumps)
    const deltaMs =
      this.lastFrameTime === 0
        ? 16.67
        : Math.min(currentTime - this.lastFrameTime, this.config.gameplay.maxDeltaMs);
    this.lastFrameTime = currentTime;

    // Update current scene
    this.sceneManager.update(deltaMs);

    // Continue the loop
    requestAnimationFrame(this.boundGameLoop);
  }

  /**
   * Start the game loop.
   */
  private startGameLoop(): void {
    if (this.gameLoopActive) {return;}

    this.gameLoopActive = true;
    this.lastFrameTime = 0;
    requestAnimationFrame(this.boundGameLoop);
    console.log('[Game] Game loop started');
  }

  /**
   * Stop the game loop.
   */
  private stopGameLoop(): void {
    this.gameLoopActive = false;
    console.log('[Game] Game loop stopped');
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Start the game.
   *
   * Initializes the game loop, starts auto-save, and transitions to the main menu.
   *
   * @example
   * ```typescript
   * const game = await Game.create();
   * await game.start();
   * ```
   */
  async start(): Promise<void> {
    if (this.running) {
      console.warn('[Game] Already running');
      return;
    }

    console.log('[Game] Starting...');

    // Start game loop
    this.startGameLoop();

    // Start auto-save
    this.saveManager.startAutoSave(this.config.gameplay.autoSaveIntervalMs);
    console.log(
      `[Game] Auto-save started (interval: ${this.config.gameplay.autoSaveIntervalMs / 1000}s)`
    );

    // Start tick engine for idle progression
    this.tickEngine.start();
    console.log('[Game] Tick engine started');

    // Transition to main menu
    await this.sceneManager.switchTo('main-menu');
    console.log('[Game] Main menu scene active');

    // Hide loading screen
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.classList.add('hidden');
    }

    this.running = true;

    console.log('[Game] Started successfully');
    this.logActiveSystemsStatus();
  }

  /**
   * Log status of all active systems.
   */
  private logActiveSystemsStatus(): void {
    console.log('[Game] Systems active:');
    console.log('  - Renderer: running');
    console.log('  - Input manager: listening');
    console.log('  - Scene manager: main-menu active');
    console.log('  - Store: ready');
    console.log('  - Event bus: ready');
    console.log('  - Save manager: auto-save active');
    console.log('  - Game loop: running');
  }

  /**
   * Stop the game and clean up all resources.
   *
   * Call this when unmounting the game or before HMR refresh.
   */
  destroy(): void {
    if (!this.running) {
      console.log('[Game] Not running, nothing to destroy');
      return;
    }

    console.log('[Game] Destroying...');

    // Stop game loop
    this.stopGameLoop();

    // Clean up debug controls
    if (this.cleanupDebugControls) {
      this.cleanupDebugControls();
      this.cleanupDebugControls = null;
    }

    // Destroy systems in reverse initialization order
    if (this._welcomeBackModal) {
      this._welcomeBackModal.destroy();
      this._welcomeBackModal = null;
    }
    if (this._inGameMenu) {
      this._inGameMenu.destroy();
      this._inGameMenu = null;
    }
    if (this._upgradePanel) {
      this._upgradePanel.destroy();
      this._upgradePanel = null;
    }
    this.tickEngine.destroy();
    this.saveManager.destroy();
    this.sceneManager.destroy();
    this.inputManager.destroy();
    this.eventBus.clear();
    this.renderer.destroy();

    this.running = false;
    console.log('[Game] Destroyed');
  }

  // ==========================================================================
  // Accessors
  // ==========================================================================

  /**
   * Check if the game is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get canvas dimensions from the renderer.
   */
  getCanvasSize(): { width: number; height: number } {
    return {
      width: this.renderer.width,
      height: this.renderer.height,
    };
  }

  /**
   * Get the current scene ID.
   */
  getCurrentSceneId(): string | null {
    return this.sceneManager.getCurrentSceneId();
  }

  /**
   * Get the upgrade panel (lazy-created on first access).
   */
  get upgradePanel(): UpgradePanel {
    if (!this._upgradePanel) {
      this._upgradePanel = new UpgradePanel(this);
      this.renderer.root.addChild(this._upgradePanel.container);
      console.log('[Game] Upgrade panel created (lazy)');
    }
    return this._upgradePanel;
  }

  /**
   * Get the in-game menu (lazy-created on first access).
   */
  get inGameMenu(): InGameMenu {
    if (!this._inGameMenu) {
      this._inGameMenu = new InGameMenu(this);
      this.renderer.root.addChild(this._inGameMenu.container);
      console.log('[Game] In-game menu created (lazy)');
    }
    return this._inGameMenu;
  }

  /**
   * Get the welcome back modal (lazy-created on first access).
   */
  get welcomeBackModal(): WelcomeBackModal {
    if (!this._welcomeBackModal) {
      this._welcomeBackModal = new WelcomeBackModal(this);
      this.renderer.root.addChild(this._welcomeBackModal.container);
      console.log('[Game] Welcome back modal created (lazy)');
    }
    return this._welcomeBackModal;
  }

  // ==========================================================================
  // Scene Navigation
  // ==========================================================================

  /**
   * Switch to a different scene.
   *
   * This is a convenience method that delegates to the scene manager.
   *
   * @param sceneId - The scene to switch to
   */
  async switchScene(sceneId: string): Promise<void> {
    await this.sceneManager.switchTo(sceneId);

    // If switching to apartment and there's pending offline progress, show the modal
    if (sceneId === 'apartment' && this.pendingOfflineProgress) {
      this.showWelcomeBackModal(this.pendingOfflineProgress);
      this.pendingOfflineProgress = null;
    }
  }

  // ==========================================================================
  // Offline Progress
  // ==========================================================================

  /**
   * Calculate and prepare offline progress for display.
   *
   * Call this after loading a save. If the player has been away long enough,
   * stores the result to show the welcome back modal after transitioning
   * to the apartment scene.
   *
   * @returns The offline progress result
   */
  prepareOfflineProgress(): OfflineProgressResult {
    const result = calculateOfflineProgress(this.store, this.config);

    if (result.shouldShowModal) {
      // Store for showing after scene transition
      this.pendingOfflineProgress = result;
      console.log('[Game] Offline progress calculated, will show modal:', {
        timeAway: result.formattedTimeAway,
        moneyEarned: result.earnings.money,
      });
    } else if (result.wasCalculated) {
      // Apply immediately if no modal needed
      applyOfflineProgress(this.store, result);
      console.log('[Game] Offline progress applied silently');
    }

    return result;
  }

  /**
   * Show the welcome back modal with offline progress.
   *
   * @param result - The offline progress result to display
   */
  showWelcomeBackModal(result: OfflineProgressResult): void {
    this.welcomeBackModal.show(result, () => {
      // Apply the offline progress when modal is dismissed
      applyOfflineProgress(this.store, result);
      console.log('[Game] Offline progress applied after modal dismissed');
    });
  }

  /**
   * Check if any modal is currently visible.
   *
   * @returns true if a modal is blocking input
   */
  isModalVisible(): boolean {
    return (
      this._welcomeBackModal?.isVisible() ||
      this._inGameMenu?.isVisible() ||
      this._upgradePanel?.isVisible() ||
      false
    );
  }
}
