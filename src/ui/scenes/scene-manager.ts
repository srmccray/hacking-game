/**
 * Scene Manager for the Hacker Incremental Game
 *
 * This module provides scene switching functionality for transitions
 * between different game views (apartment, minigames, menus, etc.).
 *
 * Scenes are PixiJS Containers that can be shown/hidden/transitioned.
 *
 * Usage:
 *   import { SceneManager, Scene } from '@ui/scenes/scene-manager';
 *
 *   // Create scene manager with root container
 *   const sceneManager = new SceneManager(getRootContainer());
 *
 *   // Register scenes
 *   sceneManager.register('apartment', apartmentScene);
 *   sceneManager.register('minigame', minigameScene);
 *
 *   // Switch scenes
 *   await sceneManager.switchTo('minigame');
 */

import { Container } from 'pixi.js';

// ============================================================================
// Scene Interface
// ============================================================================

/**
 * Interface for a game scene.
 *
 * Scenes are Containers with optional lifecycle hooks.
 */
export interface Scene {
  /** The PixiJS Container for this scene */
  container: Container;

  /**
   * Called when the scene becomes active.
   * Use for initializing scene state, starting animations, etc.
   */
  onEnter?: () => void | Promise<void>;

  /**
   * Called when the scene is about to become inactive.
   * Use for cleanup, stopping animations, saving state, etc.
   */
  onExit?: () => void | Promise<void>;

  /**
   * Called every frame while the scene is active.
   * @param delta - Time since last update in ms
   */
  onUpdate?: (delta: number) => void;

  /**
   * Called when the scene is destroyed/unregistered.
   */
  onDestroy?: () => void;
}

// ============================================================================
// Scene Manager Class
// ============================================================================

/**
 * Manages game scenes and transitions between them.
 */
export class SceneManager {
  private root: Container;
  private scenes: Map<string, Scene> = new Map();
  private currentSceneId: string | null = null;
  private sceneContainer: Container;
  private isTransitioning: boolean = false;

  /**
   * Create a new SceneManager.
   *
   * @param rootContainer - The root container to add scenes to
   */
  constructor(rootContainer: Container) {
    this.root = rootContainer;

    // Create a container specifically for scenes
    // This allows other UI elements (like HUD) to exist outside scene container
    this.sceneContainer = new Container();
    this.sceneContainer.label = 'scene-container';
    this.root.addChild(this.sceneContainer);
  }

  /**
   * Register a scene with the manager.
   *
   * @param id - Unique identifier for the scene
   * @param scene - The Scene object
   */
  register(id: string, scene: Scene): void {
    if (this.scenes.has(id)) {
      console.warn(`Scene '${id}' already registered. Replacing.`);
      this.unregister(id);
    }

    // Initially hide the scene
    scene.container.visible = false;
    scene.container.label = `scene-${id}`;

    this.scenes.set(id, scene);
    this.sceneContainer.addChild(scene.container);

    console.log(`Scene '${id}' registered`);
  }

  /**
   * Unregister and destroy a scene.
   *
   * @param id - The scene identifier to remove
   */
  unregister(id: string): void {
    const scene = this.scenes.get(id);
    if (!scene) {
      return;
    }

    // If this is the current scene, clear it
    if (this.currentSceneId === id) {
      this.currentSceneId = null;
    }

    // Call destroy hook
    if (scene.onDestroy) {
      scene.onDestroy();
    }

    // Remove from display
    this.sceneContainer.removeChild(scene.container);
    scene.container.destroy({ children: true });

    this.scenes.delete(id);
    console.log(`Scene '${id}' unregistered`);
  }

  /**
   * Switch to a different scene.
   *
   * @param id - The scene identifier to switch to
   * @returns Promise that resolves when transition is complete
   */
  async switchTo(id: string): Promise<void> {
    if (this.isTransitioning) {
      console.warn('Scene transition already in progress');
      return;
    }

    const nextScene = this.scenes.get(id);
    if (!nextScene) {
      console.error(`Scene '${id}' not found`);
      return;
    }

    // Don't switch if already on this scene
    if (this.currentSceneId === id) {
      return;
    }

    this.isTransitioning = true;

    try {
      // Exit current scene
      if (this.currentSceneId) {
        const currentScene = this.scenes.get(this.currentSceneId);
        if (currentScene) {
          if (currentScene.onExit) {
            await currentScene.onExit();
          }
          currentScene.container.visible = false;
        }
      }

      // Enter new scene
      nextScene.container.visible = true;
      if (nextScene.onEnter) {
        await nextScene.onEnter();
      }

      this.currentSceneId = id;
      console.log(`Switched to scene '${id}'`);
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Get the currently active scene.
   *
   * @returns The current Scene or null
   */
  getCurrentScene(): Scene | null {
    if (!this.currentSceneId) {
      return null;
    }
    return this.scenes.get(this.currentSceneId) ?? null;
  }

  /**
   * Get the current scene's identifier.
   *
   * @returns The current scene ID or null
   */
  getCurrentSceneId(): string | null {
    return this.currentSceneId;
  }

  /**
   * Get a scene by ID.
   *
   * @param id - The scene identifier
   * @returns The Scene or undefined
   */
  getScene(id: string): Scene | undefined {
    return this.scenes.get(id);
  }

  /**
   * Check if a scene is registered.
   *
   * @param id - The scene identifier
   * @returns true if the scene exists
   */
  hasScene(id: string): boolean {
    return this.scenes.has(id);
  }

  /**
   * Get all registered scene IDs.
   *
   * @returns Array of scene identifiers
   */
  getSceneIds(): string[] {
    return Array.from(this.scenes.keys());
  }

  /**
   * Update the current scene.
   * Call this from the game loop.
   *
   * @param delta - Time since last update in ms
   */
  update(delta: number): void {
    const currentScene = this.getCurrentScene();
    if (currentScene?.onUpdate) {
      currentScene.onUpdate(delta);
    }
  }

  /**
   * Check if a transition is currently in progress.
   *
   * @returns true if transitioning
   */
  isInTransition(): boolean {
    return this.isTransitioning;
  }

  /**
   * Get the scene container (for adding overlay elements).
   *
   * @returns The scene container
   */
  getSceneContainer(): Container {
    return this.sceneContainer;
  }

  /**
   * Destroy the scene manager and all scenes.
   */
  destroy(): void {
    // Destroy all scenes
    for (const id of this.scenes.keys()) {
      this.unregister(id);
    }

    // Remove scene container
    this.root.removeChild(this.sceneContainer);
    this.sceneContainer.destroy();

    console.log('SceneManager destroyed');
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let sceneManagerInstance: SceneManager | null = null;

/**
 * Initialize the global scene manager instance.
 *
 * @param rootContainer - The root container for scenes
 * @returns The SceneManager instance
 */
export function initSceneManager(rootContainer: Container): SceneManager {
  if (sceneManagerInstance) {
    console.warn('SceneManager already initialized. Destroying old instance.');
    sceneManagerInstance.destroy();
  }

  sceneManagerInstance = new SceneManager(rootContainer);
  return sceneManagerInstance;
}

/**
 * Get the global scene manager instance.
 *
 * @returns The SceneManager instance
 * @throws Error if not initialized
 */
export function getSceneManager(): SceneManager {
  if (!sceneManagerInstance) {
    throw new Error('SceneManager not initialized. Call initSceneManager() first.');
  }
  return sceneManagerInstance;
}

/**
 * Destroy the global scene manager instance.
 */
export function destroySceneManager(): void {
  if (sceneManagerInstance) {
    sceneManagerInstance.destroy();
    sceneManagerInstance = null;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a simple scene from just a container.
 *
 * @param container - The scene container
 * @param hooks - Optional lifecycle hooks
 * @returns A Scene object
 */
export function createScene(
  container: Container,
  hooks: Partial<Omit<Scene, 'container'>> = {}
): Scene {
  return {
    container,
    ...hooks,
  };
}
