/**
 * Hacker Incremental Game - Main Entry Point
 *
 * This file initializes the game and serves as the entry point for all game systems.
 *
 * Initialization order:
 * 1. Load saved game state
 * 2. Initialize save system (auto-save)
 * 3. Initialize PixiJS renderer
 * 4. Create HUD
 * 5. Create Upgrade Panel
 * 6. Initialize scene manager
 * 7. Create apartment scene
 * 8. Register Code Breaker minigame
 * 9. Start game loop
 * 10. Setup debug controls (dev only)
 */

// Game systems - core
import { useGameStore } from './core/game-state';
import {
  initializeSaveSystem,
  loadGame,
  saveGame,
  destroySaveSystem,
} from './core/save-system';
import {
  startTickEngine,
  stopTickEngine,
} from './core/tick-engine';
import {
  calculateOfflineProgress,
  applyOfflineProgress,
  type OfflineProgressResult,
} from './core/offline-progress';

// Game systems - UI
import {
  initRenderer,
  destroyRenderer,
  getRootContainer,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
} from './ui/renderer';
import { createHUD, destroyHUD, refreshHUD } from './ui/hud';
import {
  initSceneManager,
  getSceneManager,
  destroySceneManager,
} from './ui/scenes/scene-manager';
import {
  createUpgradePanel,
  destroyUpgradePanel,
  refreshUpgradePanel,
  toggleUpgradePanel,
} from './ui/upgrade-panel';
import {
  showWelcomeBackModal,
  destroyWelcomeBackModal,
} from './ui/welcome-back-modal';
import {
  createMainMenuScene,
  destroyMainMenuScene,
} from './ui/scenes/main-menu';
import {
  initInGameMenu,
  destroyInGameMenu,
} from './ui/in-game-menu';

// Overworld
import {
  createApartmentScene,
  destroyApartmentScene,
} from './overworld/apartment';

// Minigames
import { createCodeBreakerScene } from './minigames/code-breaker';

// ============================================================================
// Loading Screen
// ============================================================================

/**
 * Hide the HTML loading indicator.
 */
function hideLoading(): void {
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.classList.add('hidden');
  }
}

// ============================================================================
// Save System Integration
// ============================================================================

/** Pending offline progress result (set during load, shown after init) */
let pendingOfflineProgress: OfflineProgressResult | null = null;

/**
 * Load any existing save data and restore game state.
 * Also calculates offline progress if applicable.
 * @returns true if a save was loaded, false if starting fresh
 */
function loadSavedGame(): boolean {
  const savedState = loadGame();

  if (savedState) {
    // Store the lastPlayed timestamp BEFORE loading state (loading will update it)
    const lastPlayedTimestamp = savedState.lastPlayed;

    useGameStore.getState().loadState(savedState);
    console.log('Loaded saved game from localStorage');

    // Log some info about the loaded state
    const state = useGameStore.getState();
    console.log('  - Last played:', new Date(lastPlayedTimestamp).toLocaleString());
    console.log('  - Money:', state.resources.money);

    // Calculate offline progress (but don't apply yet - wait for modal)
    pendingOfflineProgress = calculateOfflineProgress(lastPlayedTimestamp);

    if (pendingOfflineProgress.wasCalculated) {
      console.log('  - Time away:', pendingOfflineProgress.formattedTimeAway);
      console.log('  - Offline earnings calculated (pending modal)');
    }

    return true;
  }

  console.log('No saved game found, starting fresh');
  return false;
}

// ============================================================================
// Game Loop
// ============================================================================

let lastTime = 0;
let gameLoopRunning = false;

/**
 * The main game loop using requestAnimationFrame.
 * Updates the active scene with delta time.
 */
function gameLoop(currentTime: number): void {
  if (!gameLoopRunning) return;

  // Calculate delta time (capped at 100ms to prevent huge jumps)
  const deltaMs = lastTime === 0 ? 16.67 : Math.min(currentTime - lastTime, 100);
  lastTime = currentTime;

  // Update the current scene
  const sceneManager = getSceneManager();
  sceneManager.update(deltaMs);

  // Continue the loop
  requestAnimationFrame(gameLoop);
}

/**
 * Start the game loop.
 */
function startGameLoop(): void {
  if (gameLoopRunning) return;

  gameLoopRunning = true;
  lastTime = 0;
  requestAnimationFrame(gameLoop);
  console.log('Game loop started');
}

/**
 * Stop the game loop.
 */
function stopGameLoop(): void {
  gameLoopRunning = false;
  console.log('Game loop stopped');
}

// ============================================================================
// Debug Controls
// ============================================================================

/**
 * Set up debug keyboard controls for testing.
 * Press 'M' to add money, 'R' to refresh HUD.
 */
function setupDebugControls(): void {
  window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    // Only handle debug keys if not holding modifiers and not in an input field
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    switch (key) {
      case 'm':
        // Add some money for testing
        useGameStore.getState().addResource('money', '1000');
        console.log('Debug: Added 1000 money');
        break;

      case 'r':
        // Refresh HUD
        refreshHUD();
        console.log('Debug: Refreshed HUD');
        break;

      case 't':
        // Add technique for testing
        useGameStore.getState().addResource('technique', '100');
        console.log('Debug: Added 100 technique');
        break;

      case 'n':
        // Add renown for testing
        useGameStore.getState().addResource('renown', '50');
        console.log('Debug: Added 50 renown');
        break;

      case 'u':
        // Toggle upgrade panel
        toggleUpgradePanel();
        console.log('Debug: Toggled upgrade panel');
        break;
    }
  });

  console.log('Debug controls enabled: M=add money, T=add technique, N=add renown, R=refresh HUD, U=toggle upgrades');
}

// ============================================================================
// Main Initialization
// ============================================================================

/**
 * Initialize the game.
 */
async function init(): Promise<void> {
  console.log('Hacker Incremental Game initializing...');

  // ============================================================================
  // Step 1: Load saved game state (if any)
  // ============================================================================
  const hadSavedGame = loadSavedGame();

  // ============================================================================
  // Step 2: Initialize save system (auto-save, tab blur, beforeunload)
  // ============================================================================
  initializeSaveSystem();

  // If this is a fresh game, save the initial state
  if (!hadSavedGame) {
    saveGame();
  }

  // ============================================================================
  // Step 3: Initialize PixiJS renderer
  // ============================================================================
  await initRenderer({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  });

  console.log('PixiJS renderer initialized');

  // ============================================================================
  // Step 4: Create HUD
  // ============================================================================
  const rootContainer = getRootContainer();
  const hud = createHUD();
  rootContainer.addChild(hud);

  // Refresh HUD with loaded state
  if (hadSavedGame) {
    refreshHUD();
  }

  console.log('HUD created');

  // ============================================================================
  // Step 5: Create Upgrade Panel
  // ============================================================================
  const upgradePanel = createUpgradePanel();
  rootContainer.addChild(upgradePanel);

  // Refresh upgrade panel with loaded state
  if (hadSavedGame) {
    refreshUpgradePanel();
  }

  console.log('Upgrade panel created');

  // ============================================================================
  // Step 6: Initialize scene manager
  // ============================================================================
  const sceneManager = initSceneManager(rootContainer);

  console.log('Scene manager initialized');

  // ============================================================================
  // Step 7: Create and register apartment scene
  // ============================================================================
  const apartmentScene = createApartmentScene({
    onDeskInteract: async () => {
      // Launch the Code Breaker minigame
      console.log('Desk interaction - Launching Code Breaker minigame');

      // Switch to Code Breaker scene
      await sceneManager.switchTo('code-breaker');
    },
    onCouchInteract: () => {
      console.log('Couch interaction - coming in post-MVP');
    },
    onBedInteract: () => {
      console.log('Bed interaction - coming in post-MVP');
    },
  });

  sceneManager.register('apartment', apartmentScene);

  // ============================================================================
  // Step 8: Create and register Code Breaker minigame scene
  // ============================================================================
  const codeBreakerScene = createCodeBreakerScene({
    onComplete: (result) => {
      console.log('Code Breaker completed!');
      console.log(`  Score: ${result.score}`);
      console.log(`  Max Combo: ${result.maxCombo}`);
      console.log(`  Money Earned: $${result.rewards.money}`);

      // Refresh HUD to show updated money
      refreshHUD();
    },
    onExit: async () => {
      console.log('Exiting Code Breaker - returning to apartment');
      await sceneManager.switchTo('apartment');
    },
  });

  sceneManager.register('code-breaker', codeBreakerScene);

  console.log('Apartment scene registered');
  console.log('Code Breaker minigame registered');

  // ============================================================================
  // Step 9: Create and register main menu scene
  // ============================================================================

  /**
   * Helper function to enter the game (apartment scene).
   * Handles offline progress modal if applicable.
   */
  async function enterGame(): Promise<void> {
    await sceneManager.switchTo('apartment');

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

  const mainMenuScene = createMainMenuScene({
    onNewGame: async () => {
      console.log('Starting new game...');
      // hardReset() is already called by the main menu
      refreshHUD();
      refreshUpgradePanel();
      await enterGame();
    },
    onContinue: async () => {
      console.log('Continuing saved game...');
      await enterGame();
    },
  });

  sceneManager.register('main-menu', mainMenuScene);
  console.log('Main menu scene registered');

  // ============================================================================
  // Step 10: Initialize in-game menu (Escape key handler)
  // ============================================================================
  initInGameMenu({
    onExitToMainMenu: async () => {
      console.log('Exiting to main menu...');
      // Clear pending offline progress since we're going back to menu
      pendingOfflineProgress = null;
      await sceneManager.switchTo('main-menu');
    },
    canOpenMenu: () => {
      // Don't allow menu during minigames (can be expanded later)
      const currentScene = sceneManager.getCurrentSceneId();
      // For now, only block on main menu (already handled in in-game-menu.ts)
      // Could add minigame checks here if needed
      return currentScene !== 'main-menu';
    },
  });

  console.log('In-game menu initialized');

  // ============================================================================
  // Step 11: Switch to initial scene (main menu)
  // ============================================================================
  await sceneManager.switchTo('main-menu');

  console.log('Main menu scene active');

  // ============================================================================
  // Step 12: Start tick engine (idle progression)
  // ============================================================================
  startTickEngine();

  console.log('Tick engine started (idle progression active)');

  // ============================================================================
  // Step 13: Start game loop
  // ============================================================================
  startGameLoop();

  // ============================================================================
  // Step 14: Setup debug controls (development only)
  // ============================================================================
  if (import.meta.env.DEV) {
    setupDebugControls();
  }

  // Note: Offline progress (welcome-back modal) is now handled when
  // entering the game from the main menu via enterGame()

  // ============================================================================
  // Done!
  // ============================================================================
  hideLoading();

  console.log('Game initialized successfully!');
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

// ============================================================================
// Application Entry Point
// ============================================================================

// Start the game
init().catch((error) => {
  console.error('Failed to initialize game:', error);

  // Show error on loading screen
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.textContent = 'Error: ' + (error instanceof Error ? error.message : 'Unknown error');
    loadingElement.style.color = '#ff4444';
  }
});

// Hot Module Replacement support for development
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    // Stop game loop and tick engine
    stopGameLoop();
    stopTickEngine();

    // Clean up all systems on HMR to prevent duplicates
    destroyInGameMenu();
    destroyMainMenuScene();
    destroyApartmentScene();
    destroySaveSystem();
    destroyHUD();
    destroyUpgradePanel();
    destroyWelcomeBackModal();
    destroySceneManager();
    destroyRenderer();
    console.log('HMR: Cleaned up game systems');
  });
}
