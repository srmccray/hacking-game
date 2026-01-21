/**
 * Hacker Incremental Game - Main Entry Point
 *
 * This is the minimal entry point for the game. All initialization logic
 * has been moved to the Game class for better organization and testability.
 */

import { Game } from './game/Game';
import { DEFAULT_CONFIG } from './game/GameConfig';

// ============================================================================
// Application Entry Point
// ============================================================================

/** The game instance */
let game: Game | null = null;

/**
 * Initialize and start the game.
 */
async function main(): Promise<void> {
  try {
    game = await Game.create(DEFAULT_CONFIG);
    await game.start();
  } catch (error) {
    console.error('Failed to initialize game:', error);

    // Show error on loading screen
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.textContent = 'Error: ' + (error instanceof Error ? error.message : 'Unknown error');
      loadingElement.style.color = '#ff4444';
    }
  }
}

// Start the game
main();

// ============================================================================
// Hot Module Replacement Support
// ============================================================================

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (game) {
      game.destroy();
      game = null;
    }
    console.log('HMR: Cleaned up game systems');
  });
}
