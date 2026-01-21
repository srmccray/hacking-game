/**
 * PixiJS Application Setup for the Hacker Incremental Game
 *
 * This module handles the PixiJS 8.x async initialization and provides
 * access to the application instance and stage for other UI components.
 *
 * Visual Style:
 * - ASCII-inspired with graphical elements
 * - Terminal green (#00ff00) on dark background (#0a0a0a)
 * - Monospace font rendering with glow effects
 *
 * Usage:
 *   import { initRenderer, getApp, getStage, destroyRenderer } from '@ui/renderer';
 *
 *   await initRenderer();
 *   const stage = getStage();
 *   stage.addChild(myContainer);
 */

import { Application, Container } from 'pixi.js';

// ============================================================================
// Configuration Constants
// ============================================================================

/** Default canvas width */
export const CANVAS_WIDTH = 800;

/** Default canvas height */
export const CANVAS_HEIGHT = 600;

/** Terminal background color (near black) */
export const BACKGROUND_COLOR = 0x0a0a0a;

/** Terminal text color (classic green) */
export const TERMINAL_GREEN = 0x00ff00;

/** Dimmed text color for secondary info */
export const TERMINAL_DIM = 0x008800;

/** Accent color for highlights */
export const TERMINAL_BRIGHT = 0x44ff44;

/** Error/warning color */
export const TERMINAL_RED = 0xff4444;

// ============================================================================
// Module State
// ============================================================================

let app: Application | null = null;
let rootContainer: Container | null = null;
let isInitialized = false;

// ============================================================================
// Initialization
// ============================================================================

/**
 * Configuration options for the renderer.
 */
export interface RendererConfig {
  /** Canvas width (default: 800) */
  width?: number;
  /** Canvas height (default: 600) */
  height?: number;
  /** Background color (default: 0x0a0a0a) */
  backgroundColor?: number;
  /** Whether to auto-resize to window (default: false for MVP) */
  autoResize?: boolean;
  /** Container element ID to mount canvas (default: 'game-container') */
  containerId?: string;
}

/**
 * Initialize the PixiJS application with the terminal aesthetic.
 *
 * This uses PixiJS 8.x async initialization pattern.
 *
 * @param config - Optional configuration overrides
 * @returns Promise that resolves when initialization is complete
 * @throws Error if initialization fails or already initialized
 */
export async function initRenderer(config: RendererConfig = {}): Promise<Application> {
  if (isInitialized) {
    throw new Error('Renderer already initialized. Call destroyRenderer() first.');
  }

  const {
    width = CANVAS_WIDTH,
    height = CANVAS_HEIGHT,
    backgroundColor = BACKGROUND_COLOR,
    containerId = 'game-container',
  } = config;

  // Create the PixiJS Application
  app = new Application();

  // Initialize with async pattern (PixiJS 8.x)
  await app.init({
    width,
    height,
    backgroundColor,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    antialias: false, // Keep crisp for ASCII aesthetic
  });

  // Create a root container for all game content
  rootContainer = new Container();
  rootContainer.label = 'root';
  app.stage.addChild(rootContainer);

  // Mount canvas to DOM
  const container = document.getElementById(containerId);
  if (!container) {
    throw new Error(`Container element #${containerId} not found`);
  }

  // Clear any existing canvas
  const existingCanvas = container.querySelector('canvas');
  if (existingCanvas) {
    existingCanvas.remove();
  }

  container.appendChild(app.canvas);

  isInitialized = true;

  console.log(`Renderer initialized: ${width}x${height}`);

  return app;
}

// ============================================================================
// Accessors
// ============================================================================

/**
 * Get the PixiJS Application instance.
 *
 * @returns The Application instance
 * @throws Error if renderer not initialized
 */
export function getApp(): Application {
  if (!app) {
    throw new Error('Renderer not initialized. Call initRenderer() first.');
  }
  return app;
}

/**
 * Get the root stage container.
 * This is the PixiJS stage (app.stage).
 *
 * @returns The stage Container
 * @throws Error if renderer not initialized
 */
export function getStage(): Container {
  if (!app) {
    throw new Error('Renderer not initialized. Call initRenderer() first.');
  }
  return app.stage;
}

/**
 * Get the root game container.
 * Add your game content as children of this container.
 *
 * @returns The root Container for game content
 * @throws Error if renderer not initialized
 */
export function getRootContainer(): Container {
  if (!rootContainer) {
    throw new Error('Renderer not initialized. Call initRenderer() or setRootContainer() first.');
  }
  return rootContainer;
}

/**
 * Set the root container externally.
 * Use this when the Game class creates its own PixiJS Application
 * but other modules need access to the root container.
 *
 * @param container - The root Container to use
 */
export function setRootContainer(container: Container): void {
  rootContainer = container;
  isInitialized = true;
  console.log('Root container set externally');
}

/**
 * Check if the renderer has been initialized.
 *
 * @returns true if initialized
 */
export function isRendererInitialized(): boolean {
  return isInitialized;
}

/**
 * Get the canvas dimensions.
 *
 * @returns Object with width and height
 */
export function getCanvasSize(): { width: number; height: number } {
  if (!app) {
    return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
  }
  return {
    width: app.screen.width,
    height: app.screen.height,
  };
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Destroy the renderer and clean up resources.
 * Call this before re-initializing or when unmounting.
 */
export function destroyRenderer(): void {
  if (app) {
    app.destroy(true, { children: true, texture: true });
    app = null;
    rootContainer = null;
    isInitialized = false;
    console.log('Renderer destroyed');
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert a hex color number to a CSS color string.
 *
 * @param color - Hex color number (e.g., 0x00ff00)
 * @returns CSS color string (e.g., '#00ff00')
 */
export function colorToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/**
 * Get the canvas center coordinates.
 *
 * @returns Object with x and y coordinates of center
 */
export function getCanvasCenter(): { x: number; y: number } {
  const size = getCanvasSize();
  return {
    x: size.width / 2,
    y: size.height / 2,
  };
}
