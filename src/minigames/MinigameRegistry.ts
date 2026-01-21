/**
 * Minigame Registry
 *
 * A plugin-like system for registering and accessing minigame definitions.
 * Minigames are registered with metadata and a factory function for creating scenes.
 *
 * Key features:
 * - Register minigame definitions with factory functions
 * - Track which minigames are unlocked (via game store)
 * - Provide minigame metadata for UI display
 * - Lazy instantiation of minigame scenes
 *
 * Usage:
 *   const registry = new MinigameRegistry();
 *
 *   registry.register({
 *     id: 'code-breaker',
 *     name: 'Code Breaker',
 *     description: 'Match sequences to hack into systems',
 *     primaryResource: 'money',
 *     createScene: (game) => new CodeBreakerScene(game),
 *   });
 *
 *   const minigame = registry.get('code-breaker');
 *   const scene = minigame?.createScene(game);
 */

import type { MinigameDefinition, GameInstance } from '../core/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Summary information about a registered minigame for UI display.
 */
export interface MinigameSummary {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Primary resource earned */
  primaryResource: string;
}

// ============================================================================
// Registry Class
// ============================================================================

/**
 * Registry for minigame definitions.
 *
 * Minigames are registered during game initialization and can be
 * retrieved by ID to create scene instances.
 */
export class MinigameRegistry {
  /**
   * Registered minigame definitions, keyed by ID.
   */
  private readonly definitions: Map<string, MinigameDefinition> = new Map();

  // ==========================================================================
  // Registration
  // ==========================================================================

  /**
   * Register a minigame definition.
   *
   * If a definition with the same ID already exists, it will be replaced
   * with a warning.
   *
   * @param definition - The minigame definition to register
   *
   * @example
   * ```typescript
   * registry.register({
   *   id: 'code-breaker',
   *   name: 'Code Breaker',
   *   description: 'Match number sequences',
   *   primaryResource: 'money',
   *   createScene: (game) => new CodeBreakerScene(game),
   * });
   * ```
   */
  register(definition: MinigameDefinition): void {
    if (this.definitions.has(definition.id)) {
      console.warn(`[MinigameRegistry] Minigame '${definition.id}' already registered, replacing`);
    }

    this.definitions.set(definition.id, definition);
  }

  /**
   * Unregister a minigame by ID.
   *
   * @param id - The minigame ID to remove
   * @returns true if the minigame was found and removed
   */
  unregister(id: string): boolean {
    return this.definitions.delete(id);
  }

  // ==========================================================================
  // Access
  // ==========================================================================

  /**
   * Get a minigame definition by ID.
   *
   * @param id - The minigame identifier
   * @returns The definition or undefined if not found
   */
  get(id: string): MinigameDefinition | undefined {
    return this.definitions.get(id);
  }

  /**
   * Check if a minigame is registered.
   *
   * @param id - The minigame identifier
   * @returns true if the minigame is registered
   */
  has(id: string): boolean {
    return this.definitions.has(id);
  }

  /**
   * Get all registered minigame definitions.
   *
   * @returns Array of all registered definitions
   */
  getAll(): MinigameDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Get all registered minigame IDs.
   *
   * @returns Array of minigame IDs
   */
  getIds(): string[] {
    return Array.from(this.definitions.keys());
  }

  /**
   * Get summary information for all registered minigames.
   * Useful for UI display without exposing the scene factory.
   *
   * @returns Array of minigame summaries
   */
  getSummaries(): MinigameSummary[] {
    return this.getAll().map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      primaryResource: def.primaryResource,
    }));
  }

  /**
   * Get the count of registered minigames.
   */
  get count(): number {
    return this.definitions.size;
  }

  // ==========================================================================
  // Scene Creation
  // ==========================================================================

  /**
   * Create a scene instance for a minigame.
   *
   * This is a convenience method that gets the definition and calls its
   * createScene factory.
   *
   * @param id - The minigame identifier
   * @param game - The game instance to pass to the factory
   * @returns The created scene or undefined if minigame not found
   *
   * @example
   * ```typescript
   * const scene = registry.createScene('code-breaker', game);
   * if (scene) {
   *   sceneManager.switchTo('code-breaker');
   * }
   * ```
   */
  createScene(id: string, game: GameInstance): ReturnType<MinigameDefinition['createScene']> | undefined {
    const definition = this.definitions.get(id);
    if (!definition) {
      console.warn(`[MinigameRegistry] Minigame '${id}' not found`);
      return undefined;
    }

    return definition.createScene(game);
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Clear all registered minigames.
   */
  clear(): void {
    this.definitions.clear();
  }
}
