/**
 * PixiJS Renderer Wrapper for v2 Architecture
 *
 * This module provides a clean wrapper around the PixiJS Application
 * with proper async initialization for PixiJS 8.x.
 *
 * Key features:
 * - Async factory pattern with `Renderer.create()`
 * - Automatic canvas mounting to DOM
 * - HMR-safe cleanup
 * - Root container for scene management
 *
 * Visual Style:
 * - ASCII-inspired with graphical elements
 * - Terminal green (#00ff00) on dark background (#0a0a0a)
 * - Monospace font rendering with glow effects
 *
 * Usage:
 *   const renderer = await Renderer.create(config.canvas);
 *
 *   // Access the root container for adding game content
 *   renderer.root.addChild(mySprite);
 *
 *   // Access the PixiJS app for advanced usage
 *   renderer.app.ticker.add(myTicker);
 *
 *   // Clean up
 *   renderer.destroy();
 */

import { Application, Container } from 'pixi.js';
import type { CanvasConfig } from '../game/GameConfig';

// ============================================================================
// Color Constants
// ============================================================================

/** Terminal background color (near black) */
export const COLORS = {
  /** Background color (near black) */
  BACKGROUND: 0x0a0a0a,
  /** Primary terminal green */
  TERMINAL_GREEN: 0x00ff00,
  /** Dimmed green for secondary info */
  TERMINAL_DIM: 0x008800,
  /** Bright green for highlights */
  TERMINAL_BRIGHT: 0x44ff44,
  /** Red for errors/warnings */
  TERMINAL_RED: 0xff4444,
  /** Yellow for warnings/highlights */
  TERMINAL_YELLOW: 0xffff00,
  /** Cyan for special elements */
  TERMINAL_CYAN: 0x00ffff,
  /** White for high contrast */
  WHITE: 0xffffff,
} as const;

// ============================================================================
// Renderer Class
// ============================================================================

/**
 * PixiJS Application wrapper with async initialization.
 *
 * Use the static `create()` method to instantiate - constructor is private.
 */
export class Renderer {
  /**
   * The underlying PixiJS Application instance.
   * Access for advanced usage like ticker management.
   */
  readonly app: Application;

  /**
   * The root container for all game content.
   * Scene containers should be added as children of this container.
   */
  readonly root: Container;

  /**
   * The canvas configuration used to create this renderer.
   */
  readonly config: CanvasConfig;

  /**
   * Private constructor - use Renderer.create() instead.
   */
  private constructor(app: Application, root: Container, config: CanvasConfig) {
    this.app = app;
    this.root = root;
    this.config = config;
  }

  /**
   * Create and initialize a new Renderer instance.
   *
   * This is an async factory method because PixiJS 8.x requires
   * async initialization via `app.init()`.
   *
   * @param config - Canvas configuration options
   * @returns Promise that resolves to the initialized Renderer
   * @throws Error if the container element is not found
   *
   * @example
   * ```typescript
   * const renderer = await Renderer.create({
   *   width: 800,
   *   height: 600,
   *   backgroundColor: 0x0a0a0a,
   *   containerId: 'game-container',
   * });
   * ```
   */
  static async create(config: CanvasConfig): Promise<Renderer> {
    const app = new Application();

    // PixiJS 8.x async initialization
    await app.init({
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false, // Keep crisp for ASCII aesthetic
    });

    // Find and validate container element
    const container = document.getElementById(config.containerId);
    if (!container) {
      throw new Error(`Container element #${config.containerId} not found`);
    }

    // HMR cleanup: remove any existing canvas
    const existingCanvas = container.querySelector('canvas');
    if (existingCanvas) {
      existingCanvas.remove();
    }

    // Mount canvas to DOM
    container.appendChild(app.canvas);

    // Create root container for game content
    const root = new Container();
    root.label = 'root';
    app.stage.addChild(root);

    return new Renderer(app, root, config);
  }

  // ==========================================================================
  // Accessors
  // ==========================================================================

  /**
   * Get the canvas width.
   */
  get width(): number {
    return this.app.screen.width;
  }

  /**
   * Get the canvas height.
   */
  get height(): number {
    return this.app.screen.height;
  }

  /**
   * Get the canvas center coordinates.
   */
  get center(): { x: number; y: number } {
    return {
      x: this.width / 2,
      y: this.height / 2,
    };
  }

  /**
   * Get the PixiJS stage (app.stage).
   * Use root container for game content instead.
   */
  get stage(): Container {
    return this.app.stage;
  }

  /**
   * Get the HTML canvas element.
   */
  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }

  /**
   * Get the PixiJS ticker for frame updates.
   */
  get ticker(): typeof this.app.ticker {
    return this.app.ticker;
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Resize the renderer to new dimensions.
   *
   * @param width - New width in pixels
   * @param height - New height in pixels
   */
  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
  }

  /**
   * Start the PixiJS render loop.
   * Note: PixiJS starts automatically, this is for resuming after stop.
   */
  start(): void {
    this.app.start();
  }

  /**
   * Stop the PixiJS render loop.
   * Useful for pausing the game.
   */
  stop(): void {
    this.app.stop();
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Destroy the renderer and clean up all resources.
   *
   * This removes the canvas from the DOM and destroys all PixiJS resources.
   * Call this when unmounting the game or before HMR refresh.
   */
  destroy(): void {
    // Remove canvas from DOM
    this.canvas.remove();

    // Destroy PixiJS application and all resources
    this.app.destroy(true, {
      children: true,
      texture: true,
      textureSource: true,
    });
  }
}
