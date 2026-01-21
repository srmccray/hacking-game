/**
 * Scene Manager for v2 Architecture
 *
 * This module handles scene registration, transitions, and lifecycle management.
 * Scenes are the top-level containers for different game states (main menu,
 * apartment, minigames).
 *
 * Key features:
 * - Factory-based scene registration
 * - Proper lifecycle hook ordering (onExit -> onDestroy -> onEnter)
 * - Stack-based scene management for modal overlays (optional)
 * - Integration with game update loop
 *
 * Usage:
 *   const sceneManager = new SceneManager(renderer.root);
 *
 *   // Register scenes with factory functions
 *   sceneManager.register('main-menu', () => new MainMenuScene(game));
 *   sceneManager.register('apartment', () => new ApartmentScene(game));
 *
 *   // Switch scenes
 *   await sceneManager.switchTo('main-menu');
 *
 *   // Update current scene in game loop
 *   sceneManager.update(deltaMs);
 */

import { Container } from 'pixi.js';
import type { Scene, SceneFactory } from '../core/types';

// ============================================================================
// Scene Manager Class
// ============================================================================

/**
 * Manages game scenes and transitions between them.
 *
 * Scenes are created lazily via factory functions and have their
 * lifecycle managed automatically.
 */
export class SceneManager {
  /**
   * The root container where scene containers are added.
   */
  private readonly root: Container;

  /**
   * Dedicated container for scenes, allows other UI elements
   * (like HUD) to exist outside the scene container.
   */
  private readonly sceneContainer: Container;

  /**
   * Registered scene factories, keyed by scene ID.
   */
  private readonly factories: Map<string, SceneFactory> = new Map();

  /**
   * Currently active scene instance.
   */
  private currentScene: Scene | null = null;

  /**
   * ID of the currently active scene.
   */
  private currentSceneId: string | null = null;

  /**
   * Whether a scene transition is currently in progress.
   */
  private transitioning: boolean = false;

  /**
   * Create a new SceneManager.
   *
   * @param root - The root container to add scenes to (typically renderer.root)
   */
  constructor(root: Container) {
    this.root = root;

    // Create a dedicated container for scenes
    this.sceneContainer = new Container();
    this.sceneContainer.label = 'scene-container';
    this.root.addChild(this.sceneContainer);
  }

  // ==========================================================================
  // Scene Registration
  // ==========================================================================

  /**
   * Register a scene factory with the manager.
   *
   * Scenes are created lazily when first switched to. This allows
   * the game to register all scenes upfront without instantiating them.
   *
   * @param id - Unique identifier for the scene
   * @param factory - Function that creates a new Scene instance
   *
   * @example
   * ```typescript
   * sceneManager.register('main-menu', () => new MainMenuScene(game));
   * ```
   */
  register(id: string, factory: SceneFactory): void {
    if (this.factories.has(id)) {
      console.warn(`[SceneManager] Scene '${id}' already registered, replacing`);
    }

    this.factories.set(id, factory);
  }

  /**
   * Unregister a scene factory.
   *
   * If the scene is currently active, it will be destroyed first.
   *
   * @param id - The scene identifier to remove
   * @returns true if the scene was found and removed
   */
  unregister(id: string): boolean {
    if (!this.factories.has(id)) {
      return false;
    }

    // If this is the current scene, destroy it
    if (this.currentSceneId === id && this.currentScene) {
      this.destroyCurrentScene();
    }

    this.factories.delete(id);
    return true;
  }

  /**
   * Check if a scene is registered.
   *
   * @param id - The scene identifier
   * @returns true if the scene is registered
   */
  hasScene(id: string): boolean {
    return this.factories.has(id);
  }

  /**
   * Get all registered scene IDs.
   */
  getSceneIds(): string[] {
    return Array.from(this.factories.keys());
  }

  // ==========================================================================
  // Scene Transitions
  // ==========================================================================

  /**
   * Switch to a different scene.
   *
   * This handles the complete transition lifecycle:
   * 1. Call `onExit()` on current scene
   * 2. Remove current scene container from display
   * 3. Call `onDestroy()` on current scene
   * 4. Create new scene via factory
   * 5. Add new scene container to display
   * 6. Call `onEnter()` on new scene
   *
   * @param id - The scene identifier to switch to
   * @returns Promise that resolves when the transition is complete
   * @throws Error if the scene is not registered
   *
   * @example
   * ```typescript
   * await sceneManager.switchTo('apartment');
   * ```
   */
  async switchTo(id: string): Promise<void> {
    // Prevent concurrent transitions
    if (this.transitioning) {
      console.warn('[SceneManager] Transition already in progress, ignoring switchTo');
      return;
    }

    // Validate the target scene exists
    const factory = this.factories.get(id);
    if (!factory) {
      throw new Error(`[SceneManager] Scene '${id}' not registered`);
    }

    // Don't switch if already on this scene
    if (this.currentSceneId === id) {
      return;
    }

    this.transitioning = true;

    try {
      // Exit and destroy current scene
      if (this.currentScene) {
        this.currentScene.onExit();
        this.sceneContainer.removeChild(this.currentScene.getContainer());
        this.currentScene.onDestroy();
        this.currentScene = null;
        this.currentSceneId = null;
      }

      // Create new scene via factory
      const newScene = factory();

      // Add to display
      this.sceneContainer.addChild(newScene.getContainer());

      // Enter new scene (may be async)
      await newScene.onEnter();

      // Update state
      this.currentScene = newScene;
      this.currentSceneId = id;
    } finally {
      this.transitioning = false;
    }
  }

  /**
   * Check if a transition is currently in progress.
   */
  isTransitioning(): boolean {
    return this.transitioning;
  }

  // ==========================================================================
  // Scene Access
  // ==========================================================================

  /**
   * Get the currently active scene.
   *
   * @returns The current Scene instance, or null if no scene is active
   */
  getCurrentScene(): Scene | null {
    return this.currentScene;
  }

  /**
   * Get the ID of the currently active scene.
   *
   * @returns The current scene ID, or null if no scene is active
   */
  getCurrentSceneId(): string | null {
    return this.currentSceneId;
  }

  /**
   * Get the scene container.
   * Useful for adding overlay elements that should appear above scenes.
   */
  getSceneContainer(): Container {
    return this.sceneContainer;
  }

  // ==========================================================================
  // Update Loop Integration
  // ==========================================================================

  /**
   * Update the current scene.
   * Call this from the game loop every frame.
   *
   * @param deltaMs - Time since last frame in milliseconds
   */
  update(deltaMs: number): void {
    if (this.currentScene?.onUpdate && !this.transitioning) {
      this.currentScene.onUpdate(deltaMs);
    }
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Destroy the current scene without switching to a new one.
   */
  private destroyCurrentScene(): void {
    if (this.currentScene) {
      this.currentScene.onExit();
      this.sceneContainer.removeChild(this.currentScene.getContainer());
      this.currentScene.onDestroy();
      this.currentScene = null;
      this.currentSceneId = null;
    }
  }

  /**
   * Destroy the scene manager and clean up all resources.
   *
   * This destroys the current scene and removes the scene container.
   */
  destroy(): void {
    // Destroy current scene if any
    this.destroyCurrentScene();

    // Clear factories
    this.factories.clear();

    // Remove scene container
    this.root.removeChild(this.sceneContainer);
    this.sceneContainer.destroy({ children: true });
  }
}

// ============================================================================
// Base Scene Class (Optional Helper)
// ============================================================================

/**
 * Abstract base class for scenes that provides common functionality.
 *
 * Extend this class to create concrete scene implementations.
 * Override the lifecycle methods as needed.
 *
 * @example
 * ```typescript
 * class MainMenuScene extends BaseScene {
 *   readonly id = 'main-menu';
 *
 *   onEnter(): void {
 *     // Setup scene content
 *   }
 *
 *   onExit(): void {
 *     // Cleanup before leaving
 *   }
 * }
 * ```
 */
export abstract class BaseScene implements Scene {
  /**
   * Unique identifier for this scene.
   */
  abstract readonly id: string;

  /**
   * The PixiJS container for this scene's content.
   */
  protected readonly container: Container;

  constructor() {
    this.container = new Container();
  }

  /**
   * Get the scene's container.
   */
  getContainer(): Container {
    return this.container;
  }

  /**
   * Called when the scene becomes active.
   * Override to setup scene content.
   */
  onEnter(): void | Promise<void> {
    // Default implementation does nothing
  }

  /**
   * Called when the scene is about to become inactive.
   * Override to cleanup before leaving (e.g., disable input contexts).
   */
  onExit(): void {
    // Default implementation does nothing
  }

  /**
   * Called every frame while the scene is active.
   * Override to update scene state.
   *
   * @param _deltaMs - Time since last frame in milliseconds
   */
  onUpdate(_deltaMs: number): void {
    // Default implementation does nothing
  }

  /**
   * Called when the scene is being destroyed.
   * Override to release resources.
   */
  onDestroy(): void {
    this.container.destroy({ children: true });
  }
}
