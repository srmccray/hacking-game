/**
 * Centralized Input Manager
 *
 * This module provides a single point of control for all keyboard input in the game.
 * It supports context-based input handling, allowing different parts of the game
 * (scenes, menus, dialogs) to register their own input bindings.
 *
 * Key features:
 * - Context-based input dispatching with priority levels
 * - Held key tracking for continuous input (player movement)
 * - Global bindings that work regardless of active context
 * - Automatic cleanup when contexts are disabled
 *
 * Usage:
 *   const inputManager = new InputManager();
 *
 *   // Register a context for player movement
 *   inputManager.registerContext({
 *     id: 'apartment',
 *     priority: 50,
 *     bindings: new Map([
 *       ['KeyA', { onPress: () => player.setInput({ left: true }), onRelease: () => player.setInput({ left: false }) }],
 *     ]),
 *   });
 *
 *   // Check if a key is currently held
 *   if (inputManager.isKeyHeld('KeyA')) { ... }
 */

// ============================================================================
// Types
// ============================================================================

/**
 * A single key binding with press and release handlers.
 */
export interface InputBinding {
  /** Called when the key is pressed down */
  onPress?: () => void;
  /** Called when the key is released */
  onRelease?: () => void;
}

/**
 * An input context groups related bindings with a priority level.
 * Higher priority contexts receive input first.
 */
export interface InputContext {
  /** Unique identifier for this context */
  id: string;
  /** Priority level (higher = checked first). Default priorities:
   * - Dialogs/modals: 100
   * - Menus: 75
   * - Scenes: 50
   * - Global: 0
   */
  priority: number;
  /** Map of key codes to bindings */
  bindings: Map<string, InputBinding>;
  /** Whether this context is currently active */
  enabled: boolean;
  /** If true, prevents lower-priority contexts from receiving input */
  blocksPropagation?: boolean;
}

/**
 * Global binding that always receives input regardless of context.
 */
export interface GlobalBinding {
  /** The key code */
  code: string;
  /** Handler for key press */
  onPress?: () => void;
  /** Handler for key release */
  onRelease?: () => void;
  /** Condition to check before handling (e.g., canOpenMenu) */
  condition?: () => boolean;
}

// ============================================================================
// Input Manager Class
// ============================================================================

/**
 * Centralized input manager for the game.
 */
export class InputManager {
  /** Registered input contexts */
  private contexts: Map<string, InputContext> = new Map();

  /** Global bindings that always receive input */
  private globalBindings: GlobalBinding[] = [];

  /** Currently held keys */
  private keyStates: Map<string, boolean> = new Map();

  /** Bound event handlers for cleanup */
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;

  /** Whether the manager is initialized */
  private initialized = false;

  constructor() {
    this.handleKeyDownBound = this.handleKeyDown.bind(this);
    this.handleKeyUpBound = this.handleKeyUp.bind(this);
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the input manager and start listening for keyboard events.
   */
  init(): void {
    if (this.initialized) {
      console.warn('[InputManager] Already initialized');
      return;
    }

    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);

    this.initialized = true;
    console.log('[InputManager] Initialized');
  }

  /**
   * Destroy the input manager and remove event listeners.
   */
  destroy(): void {
    if (!this.initialized) {
      return;
    }

    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);

    this.contexts.clear();
    this.globalBindings = [];
    this.keyStates.clear();

    this.initialized = false;
    console.log('[InputManager] Destroyed');
  }

  // ==========================================================================
  // Context Management
  // ==========================================================================

  /**
   * Register an input context.
   *
   * @param context - The context to register
   */
  registerContext(context: InputContext): void {
    if (this.contexts.has(context.id)) {
      console.warn(`[InputManager] Context '${context.id}' already registered, replacing`);
    }

    this.contexts.set(context.id, context);
    console.log(`[InputManager] Registered context '${context.id}' (priority: ${context.priority})`);
  }

  /**
   * Unregister an input context.
   *
   * @param id - The context ID to remove
   */
  unregisterContext(id: string): void {
    if (this.contexts.delete(id)) {
      console.log(`[InputManager] Unregistered context '${id}'`);
    }
  }

  /**
   * Enable an input context.
   *
   * @param id - The context ID to enable
   */
  enableContext(id: string): void {
    const context = this.contexts.get(id);
    if (context) {
      context.enabled = true;
      console.log(`[InputManager] Enabled context '${id}'`);
    }
  }

  /**
   * Disable an input context.
   * Also releases any held keys for this context.
   *
   * @param id - The context ID to disable
   */
  disableContext(id: string): void {
    const context = this.contexts.get(id);
    if (context) {
      // Release all held keys for this context's bindings
      for (const [code, binding] of context.bindings) {
        if (this.keyStates.get(code) && binding.onRelease) {
          binding.onRelease();
        }
      }

      context.enabled = false;
      console.log(`[InputManager] Disabled context '${id}'`);
    }
  }

  /**
   * Check if a context exists and is enabled.
   *
   * @param id - The context ID to check
   * @returns true if the context exists and is enabled
   */
  isContextEnabled(id: string): boolean {
    const context = this.contexts.get(id);
    return context?.enabled ?? false;
  }

  /**
   * Get all context IDs.
   */
  getContextIds(): string[] {
    return Array.from(this.contexts.keys());
  }

  /**
   * Update bindings for an existing context.
   *
   * @param id - The context ID
   * @param bindings - New bindings map
   */
  updateContextBindings(id: string, bindings: Map<string, InputBinding>): void {
    const context = this.contexts.get(id);
    if (context) {
      context.bindings = bindings;
    }
  }

  // ==========================================================================
  // Global Bindings
  // ==========================================================================

  /**
   * Register a global binding that works regardless of context.
   *
   * @param binding - The global binding to register
   */
  registerGlobalBinding(binding: GlobalBinding): void {
    // Remove existing binding for the same code if present
    this.globalBindings = this.globalBindings.filter((b) => b.code !== binding.code);
    this.globalBindings.push(binding);
    console.log(`[InputManager] Registered global binding for '${binding.code}'`);
  }

  /**
   * Unregister a global binding.
   *
   * @param code - The key code to unregister
   */
  unregisterGlobalBinding(code: string): void {
    const initialLength = this.globalBindings.length;
    this.globalBindings = this.globalBindings.filter((b) => b.code !== code);
    if (this.globalBindings.length < initialLength) {
      console.log(`[InputManager] Unregistered global binding for '${code}'`);
    }
  }

  // ==========================================================================
  // Key State Queries
  // ==========================================================================

  /**
   * Check if a key is currently held down.
   * Useful for continuous input like player movement.
   *
   * @param code - The key code (e.g., 'KeyA', 'ArrowLeft')
   * @returns true if the key is held
   */
  isKeyHeld(code: string): boolean {
    return this.keyStates.get(code) ?? false;
  }

  /**
   * Check if any of the specified keys are held.
   *
   * @param codes - Array of key codes to check
   * @returns true if any key is held
   */
  isAnyKeyHeld(codes: string[]): boolean {
    return codes.some((code) => this.isKeyHeld(code));
  }

  /**
   * Get all currently held keys.
   *
   * @returns Array of held key codes
   */
  getHeldKeys(): string[] {
    const held: string[] = [];
    for (const [code, isHeld] of this.keyStates) {
      if (isHeld) {
        held.push(code);
      }
    }
    return held;
  }

  /**
   * Release all held keys.
   * Useful when changing scenes or opening menus.
   */
  releaseAllKeys(): void {
    // Trigger release handlers for all held keys
    for (const [code, isHeld] of this.keyStates) {
      if (isHeld) {
        this.handleKeyRelease(code);
      }
    }
    this.keyStates.clear();
  }

  // ==========================================================================
  // Event Handlers
  // ==========================================================================

  /**
   * Handle keydown events.
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // Ignore if target is an input field
    if (this.isInputElement(event.target)) {
      return;
    }

    // Ignore repeated keydown events (key held)
    if (event.repeat) {
      return;
    }

    const code = event.code;

    // Track key state
    this.keyStates.set(code, true);

    // Check global bindings first
    for (const binding of this.globalBindings) {
      if (binding.code === code) {
        // Check condition if present
        if (binding.condition && !binding.condition()) {
          continue;
        }

        if (binding.onPress) {
          event.preventDefault();
          binding.onPress();
          return; // Global bindings always block propagation
        }
      }
    }

    // Get contexts sorted by priority (descending)
    const sortedContexts = this.getSortedContexts();

    // Find the first enabled context that handles this key
    for (const context of sortedContexts) {
      if (!context.enabled) {
        continue;
      }

      const binding = context.bindings.get(code);
      if (binding?.onPress) {
        event.preventDefault();
        binding.onPress();

        if (context.blocksPropagation) {
          return;
        }
      }

      // If context blocks propagation and is enabled, stop checking
      if (context.blocksPropagation) {
        return;
      }
    }
  }

  /**
   * Handle keyup events.
   */
  private handleKeyUp(event: KeyboardEvent): void {
    // Ignore if target is an input field
    if (this.isInputElement(event.target)) {
      return;
    }

    const code = event.code;

    // Update key state
    this.keyStates.set(code, false);

    // Trigger release handler
    this.handleKeyRelease(code);
  }

  /**
   * Handle key release for both keyup and forced releases.
   */
  private handleKeyRelease(code: string): void {
    // Check global bindings
    for (const binding of this.globalBindings) {
      if (binding.code === code && binding.onRelease) {
        binding.onRelease();
      }
    }

    // Get contexts sorted by priority
    const sortedContexts = this.getSortedContexts();

    // Notify all enabled contexts about the release
    for (const context of sortedContexts) {
      if (!context.enabled) {
        continue;
      }

      const binding = context.bindings.get(code);
      if (binding?.onRelease) {
        binding.onRelease();
      }
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Get contexts sorted by priority (highest first).
   */
  private getSortedContexts(): InputContext[] {
    return Array.from(this.contexts.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Check if an event target is an input element.
   */
  private isInputElement(target: EventTarget | null): boolean {
    if (!target) return false;
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    );
  }
}

// ============================================================================
// Priority Constants
// ============================================================================

/**
 * Standard priority levels for input contexts.
 */
export const INPUT_PRIORITY = {
  /** Global bindings (always active) */
  GLOBAL: 0,
  /** Main game scene (apartment, etc.) */
  SCENE: 50,
  /** In-game menu */
  MENU: 75,
  /** Modal dialogs */
  DIALOG: 100,
} as const;
