# FRD: Hacker Incremental Game v2 - Architecture Rebuild

**Created:** 2026-01-20
**Updated:** 2026-01-20
**Tier:** MEDIUM
**Triage Scores:** Complexity 4.5/10, Risk 3.3/10
**Status:** Draft

---

## Executive Summary

This document specifies the architectural rebuild of the Hacker Incremental Game. The v1 implementation is functionally complete but has accumulated architectural issues that make it difficult to maintain, test, and extend. This rebuild preserves all user-facing features while establishing a cleaner foundation for future development.

The key architectural changes are:
1. **Game class as root container** - Single entry point owning all systems
2. **Centralized InputManager** - Context-based input with priority dispatching
3. **Unified GameConfig** - Single source of truth for configuration
4. **EventBus for cross-system communication** - Decoupled messaging between systems
5. **MinigameRegistry** - Plugin-like system for adding new minigames
6. **Improved state reactivity** - Zustand subscriptions instead of manual refresh calls

---

## Problem Statement

### Current State

The v1 implementation uses a 14-step initialization sequence in `main.ts` with multiple global singletons (HUD, SceneManager, Player, SaveSystem, TickEngine). Input handling is scattered across 4+ files with no coordination. Configuration is spread across multiple modules.

### Pain Points

1. **Complex initialization** - 14-step async init in `main.ts` (~200+ lines) with tightly coupled steps
2. **Global singletons** - Module-level state makes testing difficult and ownership unclear
3. **Scattered input handling** - Keyboard events handled in `player.ts`, `in-game-menu.ts`, `main.ts`, and `code-breaker-scene.ts` with no coordination
4. **Manual state refresh** - UI components require explicit `refreshHUD()` calls instead of reactive updates
5. **Configuration sprawl** - Constants in `game-config.ts`, `renderer.ts`, `types.ts` without clear hierarchy
6. **Tight coupling** - Systems communicate through direct imports rather than events

### Goals (from Orchestrator)

1. **Modularity and testability** - Reduce singletons, use dependency injection
2. **Declarative configuration** - Single source of truth for all config
3. **Better state reactivity** - Zustand subscriptions, avoid manual refresh calls
4. **Unified minigame components** - Logic + rendering together, easier to add new minigames
5. **Centralized event bus** - Cross-system communication without tight coupling
6. **Support for multiple minigames** - Cauldron-style system where minigames feed shared progression

### Success Metrics

- Single `Game.create()` entry point (vs 14 steps)
- All input handling through one InputManager
- Zero manual `refreshHUD()` or `refreshUpgradePanel()` calls
- Adding a new minigame requires only registry entry + minigame module
- All existing features work identically (no UX changes)

---

## Proposed Solution

### Overview

Rewrite the game with a root `Game` class that owns all systems. Use explicit dependency injection (not a generic container) for clear ownership and type safety. Implement a centralized InputManager with context-based dispatching and priority levels. Add an EventBus for cross-system communication.

### Design Principles

1. **Explicit over implicit** - Constructor injection over service locator pattern
2. **Composition over inheritance** - Systems composed together, not extended
3. **Single source of truth** - One config, one store, one input manager
4. **Reactive by default** - Zustand subscriptions drive UI updates
5. **Testability first** - All systems testable in isolation

### Key Components

#### 1. Game Class (Root Container)

Single entry point that owns all major systems with clear initialization order and lifecycle management.

**Responsibilities:**
- Async initialization via `Game.create()` factory
- Owns: Renderer, Store, InputManager, SceneManager, TickEngine, SaveManager, EventBus
- Manages game loop (requestAnimationFrame)
- Handles HMR cleanup

#### 2. InputManager

Centralized keyboard input with context-based dispatching, priority levels, and held key tracking.

**Responsibilities:**
- Single point of control for all keyboard input
- Context switching (scene-based input bindings)
- Priority-based dispatching (dialogs > menus > scenes > global)
- Held key tracking for continuous input (player movement)
- Global bindings (Escape key works everywhere)

#### 3. EventBus

Lightweight typed event system for cross-system communication.

**Responsibilities:**
- Decouple systems that need to communicate
- Type-safe event definitions
- Subscribe/unsubscribe pattern
- Used for: score recording, resource changes, scene transitions

#### 4. MinigameRegistry

Plugin-like system for registering and instantiating minigames.

**Responsibilities:**
- Register minigame definitions
- Factory pattern for creating minigame scenes
- Metadata for UI (name, description, unlock status)

#### 5. Unified GameConfig

Hierarchical configuration object with all game settings.

**Responsibilities:**
- Single source of truth for configuration
- Runtime-mergeable with partial overrides
- Type-safe access to all settings

### Patterns to Preserve (from v1)

These patterns work well and should be kept:

| Pattern | Location | Why Keep |
|---------|----------|----------|
| Game factory method | `Game.ts` | Async init with clear dependency order |
| InputManager class | `InputManager.ts` | Already well-designed with context priority |
| BaseMinigame abstract class | `base-minigame.ts` | Event emitter, scoring, timing built in |
| Zustand vanilla store | `game-state.ts` | Good pattern with subscribeWithSelector |
| Storage adapter abstraction | `storage/` | Async interface for cross-platform |
| Scene lifecycle hooks | `scene-manager.ts` | onEnter, onExit, onUpdate, onDestroy |
| Class-based managers | Various | Encapsulated state, clear ownership |

---

## Technical Design

### Architecture Overview

```
src/
├── game/
│   ├── Game.ts                 # Root game class with factory method
│   ├── GameConfig.ts           # Unified configuration
│   └── index.ts                # Public exports
├── core/
│   ├── types.ts                # Shared TypeScript interfaces
│   ├── state/
│   │   ├── game-store.ts       # Zustand store (vanilla + subscribeWithSelector)
│   │   └── selectors.ts        # State selectors
│   ├── resources/
│   │   └── resource-manager.ts # Decimal operations and formatting
│   ├── persistence/
│   │   ├── storage-adapter.ts  # Async storage interface
│   │   ├── local-storage-adapter.ts
│   │   └── save-manager.ts     # Save/load with slots
│   └── progression/
│       ├── tick-engine.ts      # Idle progression loop
│       ├── auto-generation.ts  # Score-based generation rates
│       └── offline-progress.ts # Offline earnings calculation
├── input/
│   ├── InputManager.ts         # Centralized input handling
│   ├── InputContext.ts         # Context interface and constants
│   └── index.ts
├── events/
│   ├── EventBus.ts             # Typed event emitter
│   ├── game-events.ts          # Event type definitions
│   └── index.ts
├── rendering/
│   ├── Renderer.ts             # PixiJS application wrapper
│   ├── styles.ts               # Text styles
│   └── index.ts
├── scenes/
│   ├── SceneManager.ts         # Scene lifecycle management
│   ├── Scene.ts                # Base scene interface
│   ├── main-menu/
│   │   └── MainMenuScene.ts
│   └── apartment/
│       ├── ApartmentScene.ts
│       ├── Player.ts
│       └── Station.ts
├── minigames/
│   ├── MinigameRegistry.ts     # Minigame registration
│   ├── BaseMinigame.ts         # Abstract base class
│   ├── MinigameScene.ts        # Base minigame scene
│   └── code-breaker/
│       ├── CodeBreakerGame.ts  # Game logic
│       ├── CodeBreakerScene.ts # PixiJS rendering
│       └── index.ts
├── ui/
│   ├── UIManager.ts            # UI layer management
│   ├── HUD.ts                  # Resource display (reactive)
│   ├── UpgradePanel.ts         # Upgrade purchasing
│   ├── PauseMenu.ts            # In-game menu
│   ├── WelcomeBackModal.ts     # Offline earnings display
│   └── index.ts
├── upgrades/
│   ├── upgrade-definitions.ts  # Upgrade data
│   └── upgrade-manager.ts      # Purchase logic
└── main.ts                     # Minimal entry point
```

### Core Design Details

#### 1. Game Class Implementation

```typescript
// game/Game.ts
import { Application, Container } from 'pixi.js';
import { InputManager } from '../input/InputManager';
import { EventBus } from '../events/EventBus';
import { SceneManager } from '../scenes/SceneManager';
import { createGameStore, type GameStore } from '../core/state/game-store';
import { TickEngine } from '../core/progression/tick-engine';
import { SaveManager } from '../core/persistence/save-manager';
import { MinigameRegistry } from '../minigames/MinigameRegistry';
import { HUD } from '../ui/HUD';
import { type GameConfig, createConfig } from './GameConfig';

export class Game {
  // Owned systems (explicit, not in a container)
  readonly config: GameConfig;
  readonly app: Application;
  readonly store: GameStore;
  readonly eventBus: EventBus;
  readonly inputManager: InputManager;
  readonly sceneManager: SceneManager;
  readonly tickEngine: TickEngine;
  readonly saveManager: SaveManager;
  readonly minigameRegistry: MinigameRegistry;
  readonly hud: HUD;

  private rootContainer: Container;
  private running = false;
  private gameLoopId: number | null = null;
  private lastFrameTime = 0;

  private constructor(
    config: GameConfig,
    app: Application,
    store: GameStore,
    eventBus: EventBus,
    inputManager: InputManager,
    sceneManager: SceneManager,
    tickEngine: TickEngine,
    saveManager: SaveManager,
    minigameRegistry: MinigameRegistry,
    hud: HUD,
    rootContainer: Container
  ) {
    this.config = config;
    this.app = app;
    this.store = store;
    this.eventBus = eventBus;
    this.inputManager = inputManager;
    this.sceneManager = sceneManager;
    this.tickEngine = tickEngine;
    this.saveManager = saveManager;
    this.minigameRegistry = minigameRegistry;
    this.hud = hud;
    this.rootContainer = rootContainer;
  }

  /**
   * Factory method for async initialization.
   * Initializes all systems in correct dependency order.
   */
  static async create(partialConfig: Partial<GameConfig> = {}): Promise<Game> {
    // 1. Create merged configuration
    const config = createConfig(partialConfig);

    // 2. Initialize PixiJS application (async)
    const app = new Application();
    await app.init({
      width: config.canvas.width,
      height: config.canvas.height,
      backgroundColor: config.canvas.backgroundColor,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
    });

    // Mount to DOM
    const container = document.getElementById(config.canvas.containerId);
    if (!container) {
      throw new Error(`Container #${config.canvas.containerId} not found`);
    }
    container.querySelector('canvas')?.remove();
    container.appendChild(app.canvas);

    // 3. Create root container
    const rootContainer = new Container();
    rootContainer.label = 'root';
    app.stage.addChild(rootContainer);

    // 4. Create event bus (no dependencies)
    const eventBus = new EventBus();

    // 5. Create game store (no dependencies)
    const store = createGameStore();

    // 6. Create input manager (no dependencies)
    const inputManager = new InputManager();
    inputManager.init();

    // 7. Create scene manager (depends on rootContainer)
    const sceneManager = new SceneManager(rootContainer);

    // 8. Create save manager (depends on store, config)
    const saveManager = new SaveManager(store, config.storage);
    await saveManager.init();

    // 9. Create tick engine (depends on store, eventBus)
    const tickEngine = new TickEngine(store, eventBus, config.gameplay);

    // 10. Create minigame registry
    const minigameRegistry = new MinigameRegistry();

    // 11. Create HUD (depends on store - uses subscriptions)
    const hud = new HUD(store, rootContainer, config);

    // 12. Construct game instance
    const game = new Game(
      config,
      app,
      store,
      eventBus,
      inputManager,
      sceneManager,
      tickEngine,
      saveManager,
      minigameRegistry,
      hud,
      rootContainer
    );

    // 13. Register scenes (needs game reference for callbacks)
    game.registerScenes();

    // 14. Register minigames
    game.registerMinigames();

    // 15. Setup global input bindings
    game.setupGlobalInputBindings();

    return game;
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.tickEngine.start();
    this.startGameLoop();
    await this.sceneManager.switchTo('main-menu');

    document.getElementById('loading')?.classList.add('hidden');
    this.running = true;
  }

  destroy(): void {
    if (!this.running) return;

    this.stopGameLoop();
    this.tickEngine.stop();
    this.saveManager.destroy();
    this.hud.destroy();
    this.sceneManager.destroy();
    this.inputManager.destroy();
    this.app.destroy(true, { children: true, texture: true });

    this.running = false;
  }

  // ... private methods for registerScenes, registerMinigames, etc.
}
```

#### 2. InputManager with Priority Contexts

```typescript
// input/InputManager.ts
export interface InputBinding {
  onPress?: () => void;
  onRelease?: () => void;
}

export interface InputContext {
  id: string;
  priority: number;
  bindings: Map<string, InputBinding>;
  enabled: boolean;
  blocksPropagation?: boolean;
}

export interface GlobalBinding {
  code: string;
  onPress?: () => void;
  onRelease?: () => void;
  condition?: () => boolean;
}

export const INPUT_PRIORITY = {
  GLOBAL: 0,
  SCENE: 50,
  MENU: 75,
  DIALOG: 100,
} as const;

export class InputManager {
  private contexts: Map<string, InputContext> = new Map();
  private globalBindings: GlobalBinding[] = [];
  private keyStates: Map<string, boolean> = new Map();
  private initialized = false;

  init(): void {
    if (this.initialized) return;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.initialized = true;
  }

  destroy(): void {
    if (!this.initialized) return;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.contexts.clear();
    this.globalBindings = [];
    this.keyStates.clear();
    this.initialized = false;
  }

  registerContext(context: InputContext): void {
    this.contexts.set(context.id, context);
  }

  enableContext(id: string): void {
    const context = this.contexts.get(id);
    if (context) context.enabled = true;
  }

  disableContext(id: string): void {
    const context = this.contexts.get(id);
    if (context) {
      // Release held keys for this context
      for (const [code, binding] of context.bindings) {
        if (this.keyStates.get(code) && binding.onRelease) {
          binding.onRelease();
        }
      }
      context.enabled = false;
    }
  }

  registerGlobalBinding(binding: GlobalBinding): void {
    this.globalBindings = this.globalBindings.filter(b => b.code !== binding.code);
    this.globalBindings.push(binding);
  }

  isKeyHeld(code: string): boolean {
    return this.keyStates.get(code) ?? false;
  }

  releaseAllKeys(): void {
    for (const [code, isHeld] of this.keyStates) {
      if (isHeld) this.dispatchRelease(code);
    }
    this.keyStates.clear();
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.isInputElement(event.target) || event.repeat) return;

    const code = event.code;
    this.keyStates.set(code, true);

    // Global bindings first
    for (const binding of this.globalBindings) {
      if (binding.code === code) {
        if (binding.condition && !binding.condition()) continue;
        if (binding.onPress) {
          event.preventDefault();
          binding.onPress();
          return;
        }
      }
    }

    // Then contexts by priority (descending)
    const sorted = this.getSortedContexts();
    for (const context of sorted) {
      if (!context.enabled) continue;
      const binding = context.bindings.get(code);
      if (binding?.onPress) {
        event.preventDefault();
        binding.onPress();
        if (context.blocksPropagation) return;
      }
      if (context.blocksPropagation) return;
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (this.isInputElement(event.target)) return;
    const code = event.code;
    this.keyStates.set(code, false);
    this.dispatchRelease(code);
  };

  private dispatchRelease(code: string): void {
    for (const binding of this.globalBindings) {
      if (binding.code === code && binding.onRelease) {
        binding.onRelease();
      }
    }
    for (const context of this.getSortedContexts()) {
      if (!context.enabled) continue;
      const binding = context.bindings.get(code);
      if (binding?.onRelease) binding.onRelease();
    }
  }

  private getSortedContexts(): InputContext[] {
    return Array.from(this.contexts.values()).sort((a, b) => b.priority - a.priority);
  }

  private isInputElement(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement ||
           target instanceof HTMLTextAreaElement ||
           target instanceof HTMLSelectElement;
  }
}
```

#### 3. EventBus for Cross-System Communication

```typescript
// events/EventBus.ts
export type EventCallback<T = unknown> = (data: T) => void;

export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on<T>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as EventCallback);
    };
  }

  emit<T>(event: string, data: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(data);
      }
    }
  }

  off(event: string, callback?: EventCallback): void {
    if (callback) {
      this.listeners.get(event)?.delete(callback);
    } else {
      this.listeners.delete(event);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

// events/game-events.ts
export const GameEvents = {
  // Resource events
  RESOURCE_CHANGED: 'resource:changed',
  RESOURCE_EARNED: 'resource:earned',

  // Minigame events
  MINIGAME_STARTED: 'minigame:started',
  MINIGAME_COMPLETED: 'minigame:completed',
  SCORE_RECORDED: 'minigame:score-recorded',

  // Scene events
  SCENE_ENTER: 'scene:enter',
  SCENE_EXIT: 'scene:exit',

  // Save events
  SAVE_COMPLETED: 'save:completed',
  SAVE_LOADED: 'save:loaded',

  // Progression events
  UPGRADE_PURCHASED: 'upgrade:purchased',
  OFFLINE_PROGRESS_CALCULATED: 'offline:calculated',
} as const;

export interface ResourceChangedEvent {
  resource: 'money' | 'technique' | 'renown';
  oldValue: string;
  newValue: string;
  delta: string;
}

export interface MinigameCompletedEvent {
  minigameId: string;
  score: number;
  maxCombo: number;
  rewards: { money?: string; technique?: string; renown?: string };
}
```

#### 4. Reactive HUD with Zustand Subscriptions

```typescript
// ui/HUD.ts
import { Container, Text, TextStyle } from 'pixi.js';
import type { GameStore } from '../core/state/game-store';
import { formatDecimal } from '../core/resources/resource-manager';
import { terminalStyle } from '../rendering/styles';

export class HUD {
  private container: Container;
  private moneyText: Text;
  private rateText: Text;
  private unsubscribe: (() => void)[] = [];

  constructor(
    private store: GameStore,
    private root: Container,
    private config: { canvas: { width: number } }
  ) {
    this.container = new Container();
    this.container.label = 'hud';

    // Create text displays
    this.moneyText = new Text({ text: '$ 0', style: terminalStyle });
    this.rateText = new Text({ text: '+0/s', style: terminalStyle });

    this.container.addChild(this.moneyText);
    this.container.addChild(this.rateText);

    // Position
    this.moneyText.x = 10;
    this.moneyText.y = 10;
    this.rateText.x = 10;
    this.rateText.y = 35;

    root.addChild(this.container);

    // Subscribe to state changes (reactive!)
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    // Subscribe to money changes
    const unsubMoney = this.store.subscribe(
      (state) => state.resources.money,
      (money) => {
        this.moneyText.text = `$ ${formatDecimal(money)}`;
      }
    );
    this.unsubscribe.push(unsubMoney);

    // Initial render
    const state = this.store.getState();
    this.moneyText.text = `$ ${formatDecimal(state.resources.money)}`;
  }

  updateAutoRate(rate: string): void {
    this.rateText.text = `+${formatDecimal(rate)}/s`;
  }

  destroy(): void {
    for (const unsub of this.unsubscribe) {
      unsub();
    }
    this.container.destroy({ children: true });
  }
}
```

#### 5. MinigameRegistry

```typescript
// minigames/MinigameRegistry.ts
import type { Scene } from '../scenes/Scene';
import type { Game } from '../game/Game';

export interface MinigameDefinition {
  id: string;
  name: string;
  description: string;
  primaryResource: 'money' | 'technique' | 'renown';
  createScene: (game: Game) => Scene;
}

export class MinigameRegistry {
  private definitions: Map<string, MinigameDefinition> = new Map();

  register(definition: MinigameDefinition): void {
    this.definitions.set(definition.id, definition);
  }

  get(id: string): MinigameDefinition | undefined {
    return this.definitions.get(id);
  }

  getAll(): MinigameDefinition[] {
    return Array.from(this.definitions.values());
  }

  has(id: string): boolean {
    return this.definitions.has(id);
  }
}

// Usage example - registering Code Breaker
// In Game.registerMinigames():
this.minigameRegistry.register({
  id: 'code-breaker',
  name: 'Code Breaker',
  description: 'Match sequences to hack into systems',
  primaryResource: 'money',
  createScene: (game) => createCodeBreakerScene(game),
});
```

#### 6. Unified GameConfig

```typescript
// game/GameConfig.ts
import Decimal from 'break_eternity.js';

export interface CanvasConfig {
  width: number;
  height: number;
  backgroundColor: number;
  containerId: string;
}

export interface StorageConfig {
  type: 'localStorage' | 'indexedDB';
  keyPrefix: string;
  maxSlots: number;
}

export interface GameplayConfig {
  offlineMaxSeconds: number;
  offlineEfficiency: Decimal;
  offlineMinSecondsForModal: number;
  autoSaveIntervalMs: number;
  maxDeltaMs: number;
  hudUpdateIntervalMs: number;
}

export interface AutoGenerationConfig {
  scoreToRateDivisor: number;
  moneyGeneratingMinigames: readonly string[];
}

export interface CodeBreakerConfig {
  sequenceLength: number;
  timeLimitMs: number;
  baseSequencePoints: number;
  pointsPerDigit: number;
  scoreToMoneyRatio: number;
  maxTopScores: number;
}

export interface UpgradeSystemConfig {
  defaultGrowthRate: Decimal;
}

export interface DebugConfig {
  enabled: boolean;
  showFps: boolean;
  showCollisionBoxes: boolean;
}

export interface AnimationConfig {
  flashDurationMs: number;
  fadeDurationMs: number;
}

export interface GameConfig {
  canvas: CanvasConfig;
  storage: StorageConfig;
  gameplay: GameplayConfig;
  autoGeneration: AutoGenerationConfig;
  minigames: {
    codeBreaker: CodeBreakerConfig;
  };
  upgrades: UpgradeSystemConfig;
  debug: DebugConfig;
  animation: AnimationConfig;
}

export const DEFAULT_CONFIG: GameConfig = {
  canvas: {
    width: 800,
    height: 600,
    backgroundColor: 0x0a0a0a,
    containerId: 'game-container',
  },
  storage: {
    type: 'localStorage',
    keyPrefix: 'hacker-incremental',
    maxSlots: 3,
  },
  gameplay: {
    offlineMaxSeconds: 8 * 60 * 60,
    offlineEfficiency: new Decimal(0.5),
    offlineMinSecondsForModal: 60,
    autoSaveIntervalMs: 30_000,
    maxDeltaMs: 1000,
    hudUpdateIntervalMs: 1000,
  },
  autoGeneration: {
    scoreToRateDivisor: 100,
    moneyGeneratingMinigames: ['code-breaker'],
  },
  minigames: {
    codeBreaker: {
      sequenceLength: 5,
      timeLimitMs: 60_000,
      baseSequencePoints: 100,
      pointsPerDigit: 10,
      scoreToMoneyRatio: 1,
      maxTopScores: 5,
    },
  },
  upgrades: {
    defaultGrowthRate: new Decimal(1.15),
  },
  debug: {
    enabled: import.meta.env?.DEV ?? false,
    showFps: true,
    showCollisionBoxes: false,
  },
  animation: {
    flashDurationMs: 200,
    fadeDurationMs: 300,
  },
};

export function createConfig(partial: Partial<GameConfig> = {}): GameConfig {
  return {
    ...DEFAULT_CONFIG,
    ...partial,
    canvas: { ...DEFAULT_CONFIG.canvas, ...partial.canvas },
    storage: { ...DEFAULT_CONFIG.storage, ...partial.storage },
    gameplay: { ...DEFAULT_CONFIG.gameplay, ...partial.gameplay },
    autoGeneration: { ...DEFAULT_CONFIG.autoGeneration, ...partial.autoGeneration },
    minigames: {
      ...DEFAULT_CONFIG.minigames,
      codeBreaker: {
        ...DEFAULT_CONFIG.minigames.codeBreaker,
        ...partial.minigames?.codeBreaker,
      },
    },
    upgrades: { ...DEFAULT_CONFIG.upgrades, ...partial.upgrades },
    debug: { ...DEFAULT_CONFIG.debug, ...partial.debug },
    animation: { ...DEFAULT_CONFIG.animation, ...partial.animation },
  };
}
```

### Data Model

**No changes to save state structure.** Maintain full backward compatibility with v1 saves:

```typescript
interface GameState {
  version: string;           // '1.1.0' - keep same version
  lastSaved: number;
  lastPlayed: number;
  playerName: string;

  resources: {
    money: string;           // Decimal as string
    technique: string;
    renown: string;
  };

  minigames: {
    [id: string]: {
      unlocked: boolean;
      topScores: string[];   // Top 5 as Decimal strings
      playCount: number;
      upgrades: { [upgradeId: string]: number };
    };
  };

  upgrades: {
    equipment: { [id: string]: number };
    apartment: { [id: string]: boolean };
  };

  settings: {
    offlineProgressEnabled: boolean;
  };

  stats: {
    totalPlayTime: number;
    totalOfflineTime: number;
    totalResourcesEarned: { [resource: string]: string };
  };
}
```

### Minimal Entry Point

```typescript
// main.ts
import { Game } from './game/Game';
import { DEFAULT_CONFIG } from './game/GameConfig';

async function main(): Promise<void> {
  try {
    const game = await Game.create(DEFAULT_CONFIG);
    await game.start();

    // HMR support
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        game.destroy();
      });
    }
  } catch (error) {
    console.error('Failed to initialize game:', error);
    const loading = document.getElementById('loading');
    if (loading) {
      loading.textContent = 'Failed to load game. Please refresh.';
    }
  }
}

main();
```

---

## Implementation Notes

### Dependencies

```json
{
  "dependencies": {
    "pixi.js": "^8.0.0",
    "break_eternity.js": "^2.0.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### Migration Strategy

This is a clean-branch rewrite, not an in-place refactor:

1. Work on `clean-slate` branch
2. Implement core systems (Game, InputManager, EventBus)
3. Port existing logic module by module
4. Verify feature parity with manual testing
5. Merge when complete

### Testing Strategy

#### Unit Tests

- InputManager context switching and priority
- EventBus subscribe/emit/unsubscribe
- GameConfig merging
- Resource calculations (existing tests)
- Save/load serialization (existing tests)
- Offline progress calculations (existing tests)

#### Integration Tests

- Game initialization sequence
- Scene transitions with input context switching
- Minigame completion flow (score + rewards + HUD update)
- Save slot selection and loading

#### Manual Test Plan

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Fresh start | Launch game | Main menu with empty slots |
| New game | Create game in slot 1 | Enter apartment with default state |
| Movement | WASD in apartment | Player moves, collides with stations |
| Station interaction | Approach desk, Enter | Code Breaker launches |
| Minigame flow | Complete sequences | Score, combo, money earned |
| HUD reactivity | Earn money | HUD updates automatically (no refresh) |
| Save/Load | Exit, relaunch, continue | State preserved |
| Offline progress | Close 5 min, reopen | Welcome-back modal shows earnings |
| Pause menu | Press Escape | Menu opens, game pauses |
| Input blocking | Open pause menu | Player can't move while menu open |

---

## Feature Parity Checklist

All v1 features must work identically:

- [ ] Save system with 3 slots
- [ ] Player name input
- [ ] Main menu (New Game, Continue, Delete)
- [ ] Apartment overworld
- [ ] 2D movement (WASD/Arrows)
- [ ] Collision detection with stations
- [ ] Station interactions (desk, couch, bed)
- [ ] Code Breaker minigame
- [ ] Combo system
- [ ] Score recording (top 5)
- [ ] Resource rewards
- [ ] Idle progression (tick engine)
- [ ] Auto-generation from top scores
- [ ] Offline progression (8hr cap, 50% efficiency)
- [ ] Welcome-back modal
- [ ] HUD (resources, rate display)
- [ ] Upgrade panel
- [ ] Upgrade purchasing
- [ ] In-game pause menu
- [ ] Exit to main menu
- [ ] Auto-save (30 second interval)
- [ ] Debug controls (dev mode only)

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Feature regression | Medium | High | Comprehensive feature parity checklist |
| Input system bugs | Medium | Medium | Thorough testing of all input scenarios |
| Save compatibility break | Low | High | Keep exact same save structure |
| Performance regression | Low | Medium | Add FPS counter in debug mode |
| Scope creep | Medium | Medium | Strict "no UX changes" rule |

---

## Acceptance Criteria

- [ ] Single `Game.create()` entry point replaces 14-step init
- [ ] All input handled through InputManager
- [ ] EventBus used for cross-system communication
- [ ] HUD updates reactively via Zustand subscriptions (no manual refresh)
- [ ] Configuration in single GameConfig object
- [ ] New minigames addable via MinigameRegistry
- [ ] All 22 existing features working identically
- [ ] v1 save files load correctly
- [ ] HMR works without memory leaks
- [ ] Test coverage for core systems

---

## Resolved Questions

| Question | Decision | Rationale |
|----------|----------|-----------|
| Save format migration | Support v1 saves | Save structure identical, no migration needed |
| Touch input | Defer entirely | Web-only for now, design for extensibility |
| FPS counter | Add in debug mode | Useful for validating performance |
| Service container vs explicit DI | Explicit DI | Better type safety, clearer dependencies |
| Event bus scope | Game-level bus | Cross-system communication, not intra-component |

---

## References

- [Idle Game Design Principles](https://ericguan.substack.com/p/idle-game-design-principles) - Core loop design
- [Game Programming Patterns: Event Queue](https://gameprogrammingpatterns.com/event-queue.html) - Event bus for games
- [PixiJS Architecture](https://pixijs.com/8.x/guides/concepts/architecture) - PixiJS 8.x patterns
- [Zustand GitHub](https://github.com/pmndrs/zustand) - State management with subscriptions
- [Cauldron on Steam](https://store.steampowered.com/app/2619650/Cauldron/) - Minigame-driven incremental inspiration

---

## Next Agent to Invoke

**Agent:** `frd-refiner`

**Context to provide:**
- Feature slug: `hacker-incremental-game-v2`
- Tier: MEDIUM
- FRD location: `.claude_docs/features/hacker-incremental-game-v2/frd.md`
- This FRD incorporates previous refinement feedback and research on best practices
- Key focus areas for refinement: validate EventBus scope, confirm InputManager handles all v1 input scenarios

**After that agent completes:**
The FRD Refiner will validate the updated design, ensure all architectural patterns are properly specified, and confirm readiness for task breakdown. The refined FRD will then proceed to the `breakdown` agent.
