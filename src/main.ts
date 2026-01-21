/**
 * Hacker Incremental Game v2 - Entry Point
 *
 * This is the main entry point for the game. It uses Game.create() to initialize
 * all systems and Game.start() to begin the game loop.
 *
 * The Game class handles:
 * - PixiJS renderer initialization
 * - Input manager setup
 * - Scene manager configuration
 * - Save system initialization
 * - Game loop management
 *
 * HMR (Hot Module Replacement) is supported for development.
 */

import { Game } from './game/Game';

// Store game instance for HMR cleanup
let game: Game | null = null;

/**
 * Main entry point for the game.
 */
async function main(): Promise<void> {
  console.log('[Main] Hacker Incremental Game v2 starting...');

  try {
    // Create and initialize the game
    game = await Game.create();

    // Start the game (transitions to main menu)
    await game.start();

    console.log('[Main] Game started successfully');
  } catch (error) {
    console.error('[Main] Failed to initialize game:', error);

    // Show error message to user
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.textContent = 'Failed to load game. Please refresh the page.';
      loadingElement.classList.remove('hidden');
    }

    // Also show in the game container
    const container = document.getElementById('game-container');
    if (container) {
      container.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #ff4444;
          font-family: monospace;
          text-align: center;
          padding: 20px;
        ">
          <h1>Initialization Failed</h1>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
          <p style="color: #888; font-size: 12px; margin-top: 20px;">
            Check the browser console for details.<br/>
            Try refreshing the page.
          </p>
        </div>
      `;
    }

    throw error;
  }
}

// Run main and handle errors
main().catch((error) => {
  // Error already logged in main(), just ensure it's visible
  console.error('[Main] Unhandled error:', error);
});

// HMR support for development
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[HMR] Disposing game instance');
    if (game) {
      game.destroy();
      game = null;
    }
  });

  import.meta.hot.accept(() => {
    console.log('[HMR] Module updated, game will reinitialize');
  });
}
