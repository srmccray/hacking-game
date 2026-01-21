# Task Breakdown: Hacker Incremental Game v2

**FRD:** `.claude_docs/features/hacker-incremental-game-v2/frd.md`
**Refinement:** `.claude_docs/features/hacker-incremental-game-v2/refinement.md`
**Created:** 2026-01-20
**Status:** Completed

---

## Summary

Fresh implementation of the hacker incremental game with v2 architecture patterns from scratch on the clean-slate branch. This is NOT a migration - we are building from the ground up while using v1 patterns from the main branch as reference.

**Total Tasks:** 16
**Estimated Complexity:** Medium (5-7 days)

---

## Task Overview

| # | Task | Status | Blocked By | Est. Time |
|---|------|--------|------------|-----------|
| 01 | Project scaffolding and configuration | Not Started | - | 2h |
| 02 | Core types and interfaces | Not Started | 01 | 2h |
| 03 | GameConfig unified configuration | Not Started | 02 | 1h |
| 04 | EventBus typed event system | Not Started | 02 | 1h |
| 05 | Zustand game store with subscriptions | Not Started | 02 | 2h |
| 06 | Resource manager (Decimal operations) | Not Started | 02, 05 | 1h |
| 07 | InputManager with context priority | Not Started | 02 | 2h |
| 08 | PixiJS Renderer setup | Not Started | 03 | 1h |
| 09 | SceneManager with lifecycle hooks | Not Started | 02, 08 | 2h |
| 10 | Storage adapter and SaveManager | Not Started | 05, 06 | 2h |
| 11 | Game class with factory method | Not Started | 03-10 | 3h |
| 12 | Main menu scene | Not Started | 09, 10, 11 | 2h |
| 13 | HUD with reactive subscriptions | Not Started | 05, 06, 08, 11 | 2h |
| 14 | MinigameRegistry and BaseMinigame | Not Started | 02, 04, 11 | 2h |
| 15 | Code Breaker minigame | Not Started | 07, 14 | 4h |
| 16 | Apartment scene with player movement | Not Started | 07, 09, 11 | 3h |
| 17 | Progression systems (tick engine, offline, upgrades) | Not Started | 04, 05, 06, 11 | 4h |
| 18 | UI systems (upgrade panel, pause menu, modals) | Not Started | 05, 07, 13 | 4h |
| 19 | Integration, polish, and testing | Not Started | All above | 4h |

---

## Dependency Graph

```
01 (Scaffolding)
│
└──► 02 (Types)
      │
      ├──► 03 (GameConfig)
      │         │
      │         ├──► 08 (Renderer) ──► 09 (SceneManager) ──┐
      │         │                                          │
      │         └──► 11 (Game) ◄───────────────────────────┘
      │              │
      ├──► 04 (EventBus) ──► 14 (Minigame infra) ──► 15 (Code Breaker)
      │                       │
      ├──► 05 (Store) ────────┼──► 06 (Resources) ──► 10 (Save) ──► 11
      │         │             │
      │         └─────────────┼──► 13 (HUD)
      │                       │
      └──► 07 (InputManager) ─┴──► 16 (Apartment)
                              │
                              └──► 18 (UI systems)
                                    │
                                    └──► 17 (Progression)
                                          │
                                          └──► 19 (Integration)
```

---

## Critical Path

01 -> 02 -> 05 -> 06 -> 10 -> 11 -> 12 -> 16 -> 19

---

## Parallel Opportunities

After task 02 (Types) completes:
- Tasks 03, 04, 05, 07 can run in parallel

After task 11 (Game) completes:
- Tasks 12, 13, 14, 16, 17 can run in parallel

---

## Phase Overview

### Phase 1: Foundation (Tasks 01-04)
Core infrastructure that everything else builds on.

### Phase 2: State Management (Tasks 05-06)
Zustand store and resource handling.

### Phase 3: Input and Rendering (Tasks 07-09)
InputManager, PixiJS setup, scene management.

### Phase 4: Persistence (Task 10)
Save/load system with storage adapter.

### Phase 5: Game Bootstrap (Tasks 11-12)
Game class and main menu to get something running.

### Phase 6: Core UI (Task 13)
HUD with reactive updates.

### Phase 7: Minigame Infrastructure (Tasks 14-15)
Registry, base class, and Code Breaker implementation.

### Phase 8: Gameplay (Tasks 16-17)
Apartment scene, progression systems.

### Phase 9: Polish (Tasks 18-19)
Remaining UI, integration, testing.

---

## Detailed Task Specifications

---

### Task 01: Project Scaffolding and Configuration

**Status:** Not Started
**Blocked By:** None
**Est. Time:** 2 hours

#### Objective

Set up the fresh src/ directory structure and build configuration for v2.

#### Scope

**In Scope:**
- Create directory structure matching FRD architecture
- Ensure Vite, TypeScript, ESLint configs are ready
- Verify dependencies in package.json
- Create minimal main.ts entry point

**Out of Scope:**
- Actual implementation code (just structure)
- Tests (added per-task)

#### Implementation Notes

**Directory Structure to Create:**
```
src/
├── core/
│   ├── state/
│   ├── resources/
│   ├── persistence/
│   └── progression/
├── events/
├── game/
├── input/
├── minigames/
│   └── code-breaker/
├── rendering/
├── scenes/
│   ├── main-menu/
│   └── apartment/
├── ui/
├── upgrades/
└── main.ts
```

**Files to Create:**
| File | Content |
|------|---------|
| `src/main.ts` | Placeholder with TODO comment |
| `src/vite-env.d.ts` | Vite type reference |
| Each directory | `index.ts` for exports |

#### Acceptance Criteria

- [ ] All directories from FRD architecture exist
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` completes without errors
- [ ] TypeScript compiles with no errors
- [ ] ESLint passes

---

### Task 02: Core Types and Interfaces

**Status:** Not Started
**Blocked By:** 01
**Est. Time:** 2 hours

#### Objective

Define all shared TypeScript interfaces and types used across the codebase.

#### Context

These types form the contract between all systems. Getting them right early prevents refactoring later.

#### Scope

**In Scope:**
- Resource types (money, technique, renown)
- Game state interface (for Zustand store)
- Scene interface and lifecycle hooks
- Minigame interfaces
- Event payload interfaces
- Input context types

**Out of Scope:**
- Implementation of types (just definitions)
- Config types (separate task)

#### Key Interfaces

```typescript
// core/types.ts

// Resources
export type ResourceId = 'money' | 'technique' | 'renown';

export interface Resources {
  money: string;      // Decimal as string for JSON
  technique: string;
  renown: string;
}

// Minigame state
export interface MinigameState {
  unlocked: boolean;
  topScores: string[];  // Decimal strings
  playCount: number;
  upgrades: Record<string, number>;
}

// Full game state (store shape)
export interface GameState {
  version: string;
  lastSaved: number;
  lastPlayed: number;
  playerName: string;

  resources: Resources;

  minigames: Record<string, MinigameState>;

  upgrades: {
    equipment: Record<string, number>;
    apartment: Record<string, boolean>;
  };

  settings: {
    offlineProgressEnabled: boolean;
  };

  stats: {
    totalPlayTime: number;
    totalOfflineTime: number;
    totalResourcesEarned: Record<string, string>;
  };
}

// Store actions
export interface GameActions {
  addResource: (resource: ResourceId, amount: string) => void;
  setResource: (resource: ResourceId, amount: string) => void;
  recordScore: (minigameId: string, score: string) => void;
  purchaseUpgrade: (category: string, upgradeId: string) => boolean;
  resetState: () => void;
  loadState: (state: Partial<GameState>) => void;
  updateLastPlayed: () => void;
}

// Scene lifecycle
export interface Scene {
  readonly id: string;
  onEnter(): void | Promise<void>;
  onExit(): void;
  onUpdate?(deltaMs: number): void;
  onDestroy(): void;
  getContainer(): Container;
}

// Minigame definition
export interface MinigameDefinition {
  id: string;
  name: string;
  description: string;
  primaryResource: ResourceId;
  createScene: (game: Game) => Scene;
}
```

#### Acceptance Criteria

- [ ] All interfaces compile without errors
- [ ] Interfaces match FRD data model specification
- [ ] Exported from `src/core/types.ts`
- [ ] JSDoc comments on all public interfaces

---

### Task 03: GameConfig Unified Configuration

**Status:** Not Started
**Blocked By:** 02
**Est. Time:** 1 hour

#### Objective

Create the unified GameConfig object that serves as single source of truth for all configuration.

#### Scope

**In Scope:**
- Canvas configuration (dimensions, background)
- Storage configuration (type, prefix, slots)
- Gameplay configuration (offline caps, auto-save interval)
- Auto-generation configuration
- Minigame-specific configuration (Code Breaker)
- Debug configuration
- Animation configuration
- `createConfig()` merge function

**Out of Scope:**
- Runtime config modification (immutable after creation)

#### Implementation Notes

**File:** `src/game/GameConfig.ts`

Follow the FRD specification exactly. Key patterns:
- Use `Decimal` from break_eternity.js for numeric values that need big number support
- Make config deeply readonly with `as const` assertions where appropriate
- `createConfig(partial)` does shallow merge at each level

#### Acceptance Criteria

- [ ] `GameConfig` interface defined with all sub-configs
- [ ] `DEFAULT_CONFIG` constant with sensible defaults
- [ ] `createConfig(partial)` properly merges overrides
- [ ] All numeric values use appropriate types (number vs Decimal)
- [ ] Export from `src/game/index.ts`

---

### Task 04: EventBus Typed Event System

**Status:** Not Started
**Blocked By:** 02
**Est. Time:** 1 hour

#### Objective

Create a lightweight typed event bus for cross-system communication.

#### Context

Based on refinement notes, we need only 4 core events:
- `minigame:started`
- `minigame:completed`
- `upgrade:purchased`
- `save:loaded`

#### Scope

**In Scope:**
- Generic EventBus class with `on`, `emit`, `off`, `clear`
- Type-safe event definitions
- Unsubscribe function returned from `on()`
- Event payload interfaces

**Out of Scope:**
- Event queuing/buffering
- Async event handling
- Event replay

#### Implementation Notes

**Files:**
- `src/events/EventBus.ts` - Generic event bus class
- `src/events/game-events.ts` - Event type definitions and payloads
- `src/events/index.ts` - Public exports

```typescript
// events/game-events.ts
export const GameEvents = {
  MINIGAME_STARTED: 'minigame:started',
  MINIGAME_COMPLETED: 'minigame:completed',
  UPGRADE_PURCHASED: 'upgrade:purchased',
  SAVE_LOADED: 'save:loaded',
} as const;

export interface MinigameStartedEvent {
  minigameId: string;
}

export interface MinigameCompletedEvent {
  minigameId: string;
  score: number;
  maxCombo: number;
  rewards: { money?: string; technique?: string; renown?: string };
}

export interface UpgradePurchasedEvent {
  category: string;
  upgradeId: string;
  newLevel: number;
}

export interface SaveLoadedEvent {
  slotId: number;
}
```

#### Acceptance Criteria

- [ ] EventBus class with generic typing
- [ ] `on()` returns unsubscribe function
- [ ] `emit()` calls all registered callbacks
- [ ] `off()` removes specific callback or all for event
- [ ] `clear()` removes all listeners
- [ ] Unit tests for EventBus
- [ ] GameEvents constant and payload interfaces defined

---

### Task 05: Zustand Game Store with Subscriptions

**Status:** Not Started
**Blocked By:** 02
**Est. Time:** 2 hours

#### Objective

Create the Zustand vanilla store with `subscribeWithSelector` for reactive UI updates.

#### Context

This is the single source of truth for game state. Must support:
- Direct state access via `getState()`
- Selective subscriptions via `subscribe(selector, callback)`
- All state mutations through actions

#### Scope

**In Scope:**
- Zustand vanilla store (no React)
- subscribeWithSelector middleware
- All GameActions from types
- Initial state factory
- State selectors

**Out of Scope:**
- Persistence (separate task)
- Computed values (those go in selectors)

#### Implementation Notes

**Files:**
- `src/core/state/game-store.ts` - Store creation and actions
- `src/core/state/selectors.ts` - Reusable selectors
- `src/core/state/index.ts` - Public exports

**Pattern from v1:**
```typescript
import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';

export const createGameStore = () => {
  return createStore<GameState & GameActions>()(
    subscribeWithSelector((set, get) => ({
      // Initial state
      ...createInitialState(),

      // Actions
      addResource: (resource, amount) => {
        set((state) => ({
          resources: {
            ...state.resources,
            [resource]: new Decimal(state.resources[resource]).add(amount).toString(),
          },
        }));
      },
      // ... other actions
    }))
  );
};

export type GameStore = ReturnType<typeof createGameStore>;
```

#### Acceptance Criteria

- [ ] Store creates with initial state
- [ ] All actions mutate state correctly
- [ ] `subscribeWithSelector` enables selective subscriptions
- [ ] State is serializable (Decimal as strings)
- [ ] Unit tests for all actions
- [ ] Selectors for common queries (e.g., `selectResources`, `selectTopScores`)

---

### Task 06: Resource Manager (Decimal Operations)

**Status:** Not Started
**Blocked By:** 02, 05
**Est. Time:** 1 hour

#### Objective

Create utilities for Decimal operations and formatting.

#### Scope

**In Scope:**
- Decimal creation and conversion helpers
- Formatting for display (abbreviations: K, M, B, etc.)
- Comparison utilities
- Arithmetic helpers that handle string conversion

**Out of Scope:**
- Store mutations (that's in game-store)
- Auto-generation rates (that's in progression)

#### Implementation Notes

**File:** `src/core/resources/resource-manager.ts`

```typescript
import Decimal from 'break_eternity.js';

export function toDecimal(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export function formatDecimal(value: string | Decimal, precision = 2): string {
  const d = toDecimal(value);
  // Handle abbreviations: K, M, B, T, etc.
  // ...
}

export function addDecimals(a: string, b: string): string {
  return toDecimal(a).add(b).toString();
}

export function multiplyDecimals(a: string, b: string): string {
  return toDecimal(a).mul(b).toString();
}

export function isGreaterOrEqual(a: string, b: string): boolean {
  return toDecimal(a).gte(b);
}
```

#### Acceptance Criteria

- [ ] `formatDecimal` displays large numbers with abbreviations
- [ ] `formatDecimal` handles small numbers with appropriate precision
- [ ] All arithmetic helpers return string (for store compatibility)
- [ ] Unit tests for formatting edge cases
- [ ] Unit tests for arithmetic operations

---

### Task 07: InputManager with Context Priority

**Status:** Not Started
**Blocked By:** 02
**Est. Time:** 2 hours

#### Objective

Create the centralized InputManager for all keyboard input handling.

#### Context

This is a critical system that enables clean input handling across scenes, menus, and dialogs. Features:
- Context-based dispatching with priority levels
- Held key tracking for continuous input (player movement)
- Global bindings (Escape key works everywhere)
- Automatic cleanup when contexts are disabled

#### Scope

**In Scope:**
- InputManager class with full lifecycle
- InputContext registration and enable/disable
- GlobalBinding registration
- Priority-based dispatching
- Held key tracking
- Block propagation support

**Out of Scope:**
- Touch input (web-only for now)
- Gamepad support

#### Implementation Notes

**Files:**
- `src/input/InputManager.ts` - Main class
- `src/input/InputContext.ts` - Interface and priority constants
- `src/input/index.ts` - Public exports

**Priority Levels:**
```typescript
export const INPUT_PRIORITY = {
  GLOBAL: 0,      // Always active
  SCENE: 50,      // Apartment, minigames
  MENU: 75,       // In-game pause menu
  DIALOG: 100,    // Confirm dialogs, modals
} as const;
```

**Key Implementation Details:**
- `handleKeyDown` checks global bindings first, then contexts by descending priority
- `handleKeyUp` dispatches release to all registered handlers
- `disableContext()` must call `onRelease` for any held keys
- `releaseAllKeys()` for scene transitions

#### Acceptance Criteria

- [ ] InputManager initializes with keyboard listeners
- [ ] Contexts registered and enabled/disabled correctly
- [ ] Priority ordering works (higher priority first)
- [ ] Global bindings fire regardless of context
- [ ] Held key tracking works for movement
- [ ] `blocksPropagation` prevents lower contexts from receiving input
- [ ] `destroy()` cleans up all listeners
- [ ] Unit tests for priority dispatch
- [ ] Unit tests for held key tracking

---

### Task 08: PixiJS Renderer Setup

**Status:** Not Started
**Blocked By:** 03
**Est. Time:** 1 hour

#### Objective

Create the PixiJS application wrapper with proper async initialization.

#### Context

PixiJS 8.x requires async initialization via `await app.init()`. This task creates a clean wrapper that handles:
- Application creation and configuration
- Canvas mounting to DOM
- Root container setup
- Cleanup on destroy

#### Scope

**In Scope:**
- Renderer class wrapping PixiJS Application
- Async initialization with config
- DOM mounting
- Container hierarchy setup
- HMR-safe cleanup

**Out of Scope:**
- Scene management (separate task)
- Specific visual components

#### Implementation Notes

**Files:**
- `src/rendering/Renderer.ts` - Main class
- `src/rendering/styles.ts` - TextStyle presets
- `src/rendering/index.ts` - Public exports

```typescript
// rendering/Renderer.ts
import { Application, Container } from 'pixi.js';
import type { CanvasConfig } from '../game/GameConfig';

export class Renderer {
  readonly app: Application;
  readonly root: Container;

  private constructor(app: Application, root: Container) {
    this.app = app;
    this.root = root;
  }

  static async create(config: CanvasConfig): Promise<Renderer> {
    const app = new Application();
    await app.init({
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: false,
    });

    // Mount to DOM
    const container = document.getElementById(config.containerId);
    if (!container) {
      throw new Error(`Container #${config.containerId} not found`);
    }
    container.querySelector('canvas')?.remove(); // HMR cleanup
    container.appendChild(app.canvas);

    // Create root container
    const root = new Container();
    root.label = 'root';
    app.stage.addChild(root);

    return new Renderer(app, root);
  }

  destroy(): void {
    this.app.destroy(true, { children: true, texture: true });
  }
}
```

**Text Styles:**
```typescript
// rendering/styles.ts
import { TextStyle } from 'pixi.js';

export const terminalStyle = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 16,
  fill: 0x00ff00,
  dropShadow: {
    alpha: 0.5,
    blur: 2,
    color: 0x00ff00,
    distance: 0,
  },
});

export const titleStyle = new TextStyle({
  fontFamily: 'monospace',
  fontSize: 32,
  fill: 0x00ff00,
  fontWeight: 'bold',
});
```

#### Acceptance Criteria

- [ ] `Renderer.create()` initializes PixiJS application
- [ ] Canvas mounts to specified container
- [ ] Root container accessible via `renderer.root`
- [ ] `destroy()` cleans up PixiJS resources
- [ ] TextStyle presets match v1 visual style
- [ ] No console errors on creation or destroy

---

### Task 09: SceneManager with Lifecycle Hooks

**Status:** Not Started
**Blocked By:** 02, 08
**Est. Time:** 2 hours

#### Objective

Create the SceneManager that handles scene registration, transitions, and lifecycle.

#### Context

Scenes are the top-level containers for different game states (main menu, apartment, minigames). The SceneManager:
- Registers scene factories
- Handles transitions between scenes
- Calls lifecycle hooks in correct order
- Manages scene containers in the display hierarchy

#### Scope

**In Scope:**
- SceneManager class
- Scene interface with lifecycle hooks
- Scene registration by ID
- Scene transitions with proper cleanup
- Current scene tracking

**Out of Scope:**
- Transition animations (can add later)
- Scene stacking (one active scene at a time)

#### Implementation Notes

**Files:**
- `src/scenes/SceneManager.ts` - Main class
- `src/scenes/Scene.ts` - Interface definition
- `src/scenes/index.ts` - Public exports

```typescript
// scenes/Scene.ts
import { Container } from 'pixi.js';

export interface Scene {
  readonly id: string;
  onEnter(): void | Promise<void>;
  onExit(): void;
  onUpdate?(deltaMs: number): void;
  onDestroy(): void;
  getContainer(): Container;
}

// scenes/SceneManager.ts
export class SceneManager {
  private scenes: Map<string, () => Scene> = new Map();
  private currentScene: Scene | null = null;
  private root: Container;

  constructor(root: Container) {
    this.root = root;
  }

  register(id: string, factory: () => Scene): void {
    this.scenes.set(id, factory);
  }

  async switchTo(id: string): Promise<void> {
    // Exit current scene
    if (this.currentScene) {
      this.currentScene.onExit();
      this.root.removeChild(this.currentScene.getContainer());
      this.currentScene.onDestroy();
    }

    // Create and enter new scene
    const factory = this.scenes.get(id);
    if (!factory) {
      throw new Error(`Scene '${id}' not registered`);
    }

    const scene = factory();
    this.root.addChild(scene.getContainer());
    await scene.onEnter();
    this.currentScene = scene;
  }

  update(deltaMs: number): void {
    this.currentScene?.onUpdate?.(deltaMs);
  }

  getCurrentScene(): Scene | null {
    return this.currentScene;
  }

  destroy(): void {
    if (this.currentScene) {
      this.currentScene.onExit();
      this.currentScene.onDestroy();
      this.currentScene = null;
    }
    this.scenes.clear();
  }
}
```

#### Acceptance Criteria

- [ ] Scenes register by ID with factory function
- [ ] `switchTo()` calls lifecycle hooks in order: exit old -> destroy old -> enter new
- [ ] `update()` forwards to current scene's `onUpdate`
- [ ] `getCurrentScene()` returns active scene
- [ ] `destroy()` cleans up current scene
- [ ] Unit tests for lifecycle ordering

---

### Task 10: Storage Adapter and SaveManager

**Status:** Not Started
**Blocked By:** 05, 06
**Est. Time:** 2 hours

#### Objective

Create the storage abstraction layer and SaveManager for game persistence.

#### Context

The storage adapter provides an async interface for persistence, allowing future expansion to IndexedDB or cloud saves. The SaveManager handles:
- Multiple save slots
- Auto-save intervals
- Load/save with state serialization
- Slot metadata

#### Scope

**In Scope:**
- StorageAdapter interface (async get/set/remove)
- LocalStorageAdapter implementation
- SaveManager class
- Save slot metadata tracking
- Auto-save timer

**Out of Scope:**
- IndexedDB adapter (future)
- Cloud sync (future)
- Save file import/export

#### Implementation Notes

**Files:**
- `src/core/persistence/storage-adapter.ts` - Interface
- `src/core/persistence/local-storage-adapter.ts` - Implementation
- `src/core/persistence/save-manager.ts` - Main class
- `src/core/persistence/index.ts` - Public exports

```typescript
// persistence/storage-adapter.ts
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

// persistence/save-manager.ts
export class SaveManager {
  private adapter: StorageAdapter;
  private store: GameStore;
  private autoSaveTimer: number | null = null;
  private keyPrefix: string;

  constructor(store: GameStore, config: StorageConfig) {
    this.store = store;
    this.keyPrefix = config.keyPrefix;
    this.adapter = new LocalStorageAdapter();
  }

  async init(): Promise<void> {
    // Load slot metadata
  }

  async save(slotId: number): Promise<void> {
    const state = this.store.getState();
    const key = `${this.keyPrefix}-slot-${slotId}`;
    await this.adapter.set(key, JSON.stringify(state));
  }

  async load(slotId: number): Promise<boolean> {
    const key = `${this.keyPrefix}-slot-${slotId}`;
    const data = await this.adapter.get(key);
    if (!data) return false;

    const state = JSON.parse(data);
    this.store.getState().loadState(state);
    return true;
  }

  startAutoSave(intervalMs: number): void {
    this.autoSaveTimer = window.setInterval(() => {
      this.save(this.currentSlot);
    }, intervalMs);
  }

  destroy(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
  }
}
```

#### Acceptance Criteria

- [ ] StorageAdapter interface defined
- [ ] LocalStorageAdapter implements interface
- [ ] SaveManager saves/loads game state
- [ ] Multiple save slots supported
- [ ] Auto-save timer works
- [ ] `destroy()` cleans up timers
- [ ] Unit tests for save/load serialization

---

### Task 11: Game Class with Factory Method

**Status:** Not Started
**Blocked By:** 03, 04, 05, 06, 07, 08, 09, 10
**Est. Time:** 3 hours

#### Objective

Create the root Game class that owns all systems and provides the single entry point.

#### Context

This is the culmination of all previous tasks. The Game class:
- Uses `Game.create()` factory for async initialization
- Owns all major systems explicitly (no service container)
- Manages game loop
- Handles HMR cleanup

#### Scope

**In Scope:**
- Game class with all system ownership
- `Game.create()` async factory
- `start()` method to begin game
- `destroy()` method for cleanup
- Game loop (requestAnimationFrame)
- Scene registration
- Global input bindings

**Out of Scope:**
- Actual scene implementations (separate tasks)
- Minigame registration (separate task)

#### Implementation Notes

**Files:**
- `src/game/Game.ts` - Main class
- `src/game/index.ts` - Public exports
- `src/main.ts` - Entry point

**Game Class Structure:**
```typescript
export class Game {
  readonly config: GameConfig;
  readonly renderer: Renderer;
  readonly store: GameStore;
  readonly eventBus: EventBus;
  readonly inputManager: InputManager;
  readonly sceneManager: SceneManager;
  readonly saveManager: SaveManager;
  readonly minigameRegistry: MinigameRegistry;

  private running = false;
  private lastFrameTime = 0;

  private constructor(/* all dependencies */) { }

  static async create(partialConfig?: Partial<GameConfig>): Promise<Game> {
    const config = createConfig(partialConfig);

    // Initialize in dependency order
    const renderer = await Renderer.create(config.canvas);
    const eventBus = new EventBus();
    const store = createGameStore();
    const inputManager = new InputManager();
    const sceneManager = new SceneManager(renderer.root);
    const saveManager = new SaveManager(store, config.storage);
    const minigameRegistry = new MinigameRegistry();

    // Initialize managers
    inputManager.init();
    await saveManager.init();

    const game = new Game(/* dependencies */);

    // Register scenes and bindings
    game.registerScenes();
    game.setupGlobalBindings();

    return game;
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.startGameLoop();
    await this.sceneManager.switchTo('main-menu');

    document.getElementById('loading')?.classList.add('hidden');
    this.running = true;
  }

  destroy(): void {
    this.stopGameLoop();
    this.saveManager.destroy();
    this.sceneManager.destroy();
    this.inputManager.destroy();
    this.renderer.destroy();
    this.running = false;
  }
}
```

**Entry Point:**
```typescript
// main.ts
import { Game } from './game/Game';

async function main(): Promise<void> {
  try {
    const game = await Game.create();
    await game.start();

    if (import.meta.hot) {
      import.meta.hot.dispose(() => game.destroy());
    }
  } catch (error) {
    console.error('Failed to initialize game:', error);
    document.getElementById('loading')!.textContent = 'Failed to load. Please refresh.';
  }
}

main();
```

#### Acceptance Criteria

- [ ] `Game.create()` initializes all systems
- [ ] Dependencies injected in correct order
- [ ] `start()` transitions to main menu
- [ ] Game loop runs with consistent delta time
- [ ] `destroy()` cleans up all resources
- [ ] HMR works without memory leaks
- [ ] Loading element hidden on successful start

---

### Task 12: Main Menu Scene

**Status:** Not Started
**Blocked By:** 09, 10, 11
**Est. Time:** 2 hours

#### Objective

Create the main menu scene with save slot selection.

#### Context

The main menu is the first scene players see. It allows:
- Starting a new game (with name input)
- Continuing from a save slot
- Deleting save slots

#### Scope

**In Scope:**
- MainMenuScene implementing Scene interface
- Save slot display (empty/used)
- New game with player name input
- Continue from existing save
- Delete save confirmation
- Input context registration

**Out of Scope:**
- Settings menu
- Credits

#### Implementation Notes

**Files:**
- `src/scenes/main-menu/MainMenuScene.ts`
- `src/scenes/main-menu/index.ts`

**Input Context:**
```typescript
const mainMenuContext: InputContext = {
  id: 'main-menu',
  priority: INPUT_PRIORITY.SCENE,
  enabled: false,
  blocksPropagation: true,
  bindings: new Map([
    ['ArrowUp', { onPress: () => this.selectPrevious() }],
    ['ArrowDown', { onPress: () => this.selectNext() }],
    ['Enter', { onPress: () => this.confirm() }],
    ['Escape', { onPress: () => this.cancel() }],
  ]),
};
```

#### Acceptance Criteria

- [ ] Scene displays title and save slots
- [ ] Arrow keys navigate between slots
- [ ] Enter starts new game or continues
- [ ] New game prompts for player name
- [ ] Delete shows confirmation
- [ ] Input context enabled on enter, disabled on exit
- [ ] Visual feedback for selected slot

---

### Task 13: HUD with Reactive Subscriptions

**Status:** Not Started
**Blocked By:** 05, 06, 08, 11
**Est. Time:** 2 hours

#### Objective

Create the HUD that displays resources and auto-generation rate using reactive Zustand subscriptions.

#### Context

The HUD must update automatically when resources change - NO manual refresh calls. This is a key architectural goal of v2.

#### Scope

**In Scope:**
- HUD class displaying money, technique, renown
- Auto-generation rate display
- Zustand subscriptions for reactive updates
- Show/hide based on scene
- Proper cleanup of subscriptions

**Out of Scope:**
- Upgrade panel (separate task)
- Detailed stats display

#### Implementation Notes

**File:** `src/ui/HUD.ts`

```typescript
export class HUD {
  private container: Container;
  private moneyText: Text;
  private rateText: Text;
  private unsubscribers: (() => void)[] = [];

  constructor(
    private store: GameStore,
    private root: Container,
    private config: GameConfig
  ) {
    this.container = new Container();
    this.container.label = 'hud';

    this.createUI();
    this.setupSubscriptions();

    root.addChild(this.container);
  }

  private setupSubscriptions(): void {
    // Subscribe to money changes
    const unsubMoney = this.store.subscribe(
      (state) => state.resources.money,
      (money) => {
        this.moneyText.text = `$ ${formatDecimal(money)}`;
      }
    );
    this.unsubscribers.push(unsubMoney);

    // Initial render
    this.updateFromState();
  }

  private updateFromState(): void {
    const state = this.store.getState();
    this.moneyText.text = `$ ${formatDecimal(state.resources.money)}`;
  }

  updateRate(rate: string): void {
    this.rateText.text = `+${formatDecimal(rate)}/s`;
  }

  show(): void {
    this.container.visible = true;
  }

  hide(): void {
    this.container.visible = false;
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.container.destroy({ children: true });
  }
}
```

#### Acceptance Criteria

- [ ] HUD displays all three resources
- [ ] Money updates automatically when state changes (no refresh call)
- [ ] Rate display updates via method call from tick engine
- [ ] `show()` and `hide()` work correctly
- [ ] `destroy()` unsubscribes all listeners
- [ ] Matches v1 visual layout

---

### Task 14: MinigameRegistry and BaseMinigame

**Status:** Not Started
**Blocked By:** 02, 04, 11
**Est. Time:** 2 hours

#### Objective

Create the minigame infrastructure: registry for adding minigames and base class for shared functionality.

#### Context

This enables a plugin-like system for minigames:
- Registry holds minigame definitions and factories
- BaseMinigame provides common functionality (event emitter, timing, scoring)

#### Scope

**In Scope:**
- MinigameRegistry class
- MinigameDefinition interface
- BaseMinigame abstract class
- Scoring system
- Timing utilities
- Event emitter for completion/score events

**Out of Scope:**
- Specific minigame implementations
- UI for minigame selection

#### Implementation Notes

**Files:**
- `src/minigames/MinigameRegistry.ts`
- `src/minigames/BaseMinigame.ts`
- `src/minigames/index.ts`

```typescript
// MinigameRegistry.ts
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

// BaseMinigame.ts
export abstract class BaseMinigame {
  protected score = 0;
  protected maxCombo = 0;
  protected currentCombo = 0;
  protected startTime = 0;
  protected listeners: Map<string, Set<Function>> = new Map();

  abstract readonly id: string;

  start(): void {
    this.score = 0;
    this.maxCombo = 0;
    this.currentCombo = 0;
    this.startTime = performance.now();
    this.onStart();
  }

  protected abstract onStart(): void;
  protected abstract onEnd(): void;

  protected addScore(points: number): void {
    this.score += points;
    this.emit('score', this.score);
  }

  protected incrementCombo(): void {
    this.currentCombo++;
    if (this.currentCombo > this.maxCombo) {
      this.maxCombo = this.currentCombo;
    }
    this.emit('combo', this.currentCombo);
  }

  protected resetCombo(): void {
    this.currentCombo = 0;
    this.emit('combo', 0);
  }

  end(): void {
    this.onEnd();
    this.emit('complete', {
      score: this.score,
      maxCombo: this.maxCombo,
      duration: performance.now() - this.startTime,
    });
  }

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  protected emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  getScore(): number { return this.score; }
  getMaxCombo(): number { return this.maxCombo; }
  getCurrentCombo(): number { return this.currentCombo; }
}
```

#### Acceptance Criteria

- [ ] MinigameRegistry registers and retrieves definitions
- [ ] BaseMinigame provides scoring and timing
- [ ] Event emitter pattern works
- [ ] Combo tracking works
- [ ] Unit tests for BaseMinigame methods

---

### Task 15: Code Breaker Minigame

**Status:** Not Started
**Blocked By:** 07, 14
**Est. Time:** 4 hours

#### Objective

Implement the Code Breaker minigame with v2 patterns.

#### Context

Code Breaker is the primary money-earning minigame. Player matches numeric sequences under time pressure. Features:
- Random sequence generation
- Digit input (0-9 keys)
- Combo system for consecutive matches
- Score-to-money conversion
- Timer with visual countdown

#### Scope

**In Scope:**
- CodeBreakerGame class extending BaseMinigame
- CodeBreakerScene implementing Scene
- Sequence generation and matching logic
- Input handling via InputManager context
- Visual feedback (match/miss)
- Score display and timer
- Reward calculation

**Out of Scope:**
- Difficulty progression (v1 has static difficulty)
- Power-ups

#### Implementation Notes

**Files:**
- `src/minigames/code-breaker/CodeBreakerGame.ts` - Game logic
- `src/minigames/code-breaker/CodeBreakerScene.ts` - PixiJS rendering
- `src/minigames/code-breaker/index.ts` - Factory and registration

**Input Context:**
```typescript
const codeBreakerContext: InputContext = {
  id: 'code-breaker',
  priority: INPUT_PRIORITY.SCENE,
  enabled: false,
  blocksPropagation: true,
  bindings: new Map([
    ['Digit0', { onPress: () => this.handleDigit(0) }],
    ['Digit1', { onPress: () => this.handleDigit(1) }],
    // ... 2-9
    ['Escape', { onPress: () => this.exitMinigame() }],
  ]),
};
```

**Registration:**
```typescript
// In Game.registerMinigames()
this.minigameRegistry.register({
  id: 'code-breaker',
  name: 'Code Breaker',
  description: 'Match sequences to hack into systems',
  primaryResource: 'money',
  createScene: (game) => new CodeBreakerScene(game),
});
```

#### Acceptance Criteria

- [ ] Sequences generate correctly
- [ ] Digit input matches/misses sequences
- [ ] Combo system works (increment on match, reset on miss)
- [ ] Timer counts down
- [ ] Score updates in real-time
- [ ] Visual feedback for match/miss
- [ ] Escape exits to apartment
- [ ] Rewards calculated and applied on completion
- [ ] Top scores recorded in store
- [ ] All input through InputManager (no raw listeners)

---

### Task 16: Apartment Scene with Player Movement

**Status:** Not Started
**Blocked By:** 07, 09, 11
**Est. Time:** 3 hours

#### Objective

Create the apartment overworld scene with player movement and station interactions.

#### Context

The apartment is the hub scene where players access minigame stations. Features:
- 2D side-scrolling movement
- Collision detection with stations
- Station interaction prompts
- Transitions to minigames

#### Scope

**In Scope:**
- ApartmentScene implementing Scene
- Player class with movement
- Station class (desk, couch, bed)
- Collision detection
- Interaction prompts
- Movement via InputManager (held keys)
- Scene transitions to minigames

**Out of Scope:**
- Multiple rooms
- Decorations/animations

#### Implementation Notes

**Files:**
- `src/scenes/apartment/ApartmentScene.ts`
- `src/scenes/apartment/Player.ts`
- `src/scenes/apartment/Station.ts`
- `src/scenes/apartment/index.ts`

**Input Context (movement with held keys):**
```typescript
const apartmentContext: InputContext = {
  id: 'apartment',
  priority: INPUT_PRIORITY.SCENE,
  enabled: false,
  blocksPropagation: false, // Allow global bindings
  bindings: new Map([
    ['KeyA', {
      onPress: () => this.player.setInput({ left: true }),
      onRelease: () => this.player.setInput({ left: false })
    }],
    ['KeyD', {
      onPress: () => this.player.setInput({ right: true }),
      onRelease: () => this.player.setInput({ right: false })
    }],
    ['ArrowLeft', {
      onPress: () => this.player.setInput({ left: true }),
      onRelease: () => this.player.setInput({ left: false })
    }],
    ['ArrowRight', {
      onPress: () => this.player.setInput({ right: true }),
      onRelease: () => this.player.setInput({ right: false })
    }],
    ['Enter', { onPress: () => this.tryInteract() }],
    ['Space', { onPress: () => this.tryInteract() }],
  ]),
};
```

#### Acceptance Criteria

- [ ] Player renders and moves with WASD/Arrows
- [ ] Movement is continuous while key held
- [ ] Stations render at correct positions
- [ ] Collision detection works
- [ ] Interaction prompt shows when near station
- [ ] Enter/Space interacts with nearby station
- [ ] Station interaction transitions to minigame
- [ ] Input context enabled/disabled on scene enter/exit

---

### Task 17: Progression Systems

**Status:** Not Started
**Blocked By:** 04, 05, 06, 11
**Est. Time:** 4 hours

#### Objective

Implement the idle progression systems: tick engine, auto-generation, and offline progress.

#### Context

These systems drive the incremental aspect of the game:
- Tick engine runs every frame and applies auto-generation
- Auto-generation rate based on top minigame scores
- Offline progress calculated when returning to game

#### Scope

**In Scope:**
- TickEngine class
- Auto-generation rate calculation
- Offline progress calculation
- Offline progress application
- EventBus integration for events

**Out of Scope:**
- Prestige system
- Achievements

#### Implementation Notes

**Files:**
- `src/core/progression/tick-engine.ts`
- `src/core/progression/auto-generation.ts`
- `src/core/progression/offline-progress.ts`
- `src/core/progression/index.ts`

**Tick Engine:**
```typescript
export class TickEngine {
  private running = false;
  private lastTick = 0;
  private tickId: number | null = null;

  constructor(
    private store: GameStore,
    private eventBus: EventBus,
    private config: GameplayConfig
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTick = performance.now();
    this.tick();
  }

  private tick = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const deltaMs = Math.min(now - this.lastTick, this.config.maxDeltaMs);
    this.lastTick = now;

    this.applyAutoGeneration(deltaMs);

    this.tickId = requestAnimationFrame(this.tick);
  };

  private applyAutoGeneration(deltaMs: number): void {
    const rate = calculateAutoRate(this.store.getState());
    const amount = new Decimal(rate).mul(deltaMs / 1000);
    this.store.getState().addResource('money', amount.toString());
  }

  stop(): void {
    this.running = false;
    if (this.tickId) {
      cancelAnimationFrame(this.tickId);
    }
  }
}
```

**Offline Progress:**
```typescript
export interface OfflineProgressResult {
  secondsAway: number;
  moneyEarned: string;
  efficiency: number;
}

export function calculateOfflineProgress(
  state: GameState,
  config: GameplayConfig
): OfflineProgressResult {
  const now = Date.now();
  const lastPlayed = state.lastPlayed;
  const secondsAway = Math.min(
    (now - lastPlayed) / 1000,
    config.offlineMaxSeconds
  );

  const rate = calculateAutoRate(state);
  const earned = new Decimal(rate)
    .mul(secondsAway)
    .mul(config.offlineEfficiency);

  return {
    secondsAway,
    moneyEarned: earned.toString(),
    efficiency: config.offlineEfficiency.toNumber(),
  };
}
```

#### Acceptance Criteria

- [ ] Tick engine runs at frame rate
- [ ] Auto-generation applies based on top scores
- [ ] Offline progress calculated correctly
- [ ] 8-hour cap enforced
- [ ] 50% efficiency applied
- [ ] EventBus events emitted for progression
- [ ] Unit tests for calculations

---

### Task 18: UI Systems (Upgrade Panel, Pause Menu, Modals)

**Status:** Not Started
**Blocked By:** 05, 07, 13
**Est. Time:** 4 hours

#### Objective

Implement remaining UI systems: upgrade panel, pause menu, welcome back modal.

#### Context

These UI elements overlay the game and require proper input handling:
- Upgrade panel toggled with U key
- Pause menu toggled with Escape
- Welcome back modal shown on return from offline

#### Scope

**In Scope:**
- UpgradePanel with reactive updates
- PauseMenu with navigation
- WelcomeBackModal for offline earnings
- Input contexts for each
- Proper z-ordering

**Out of Scope:**
- Settings menu
- Detailed statistics

#### Implementation Notes

**Files:**
- `src/ui/UpgradePanel.ts`
- `src/ui/PauseMenu.ts`
- `src/ui/WelcomeBackModal.ts`

**Pause Menu Input Context:**
```typescript
const pauseMenuContext: InputContext = {
  id: 'pause-menu',
  priority: INPUT_PRIORITY.MENU,
  enabled: false,
  blocksPropagation: true,
  bindings: new Map([
    ['ArrowUp', { onPress: () => this.selectPrevious() }],
    ['ArrowDown', { onPress: () => this.selectNext() }],
    ['Enter', { onPress: () => this.confirm() }],
    ['Escape', { onPress: () => this.close() }],
  ]),
};
```

**Welcome Back Modal:**
- Shows time away, earnings, efficiency
- Dismiss with any key
- Uses DIALOG priority to block all input

#### Acceptance Criteria

- [ ] Upgrade panel opens/closes with U key
- [ ] Upgrade panel shows purchasable upgrades
- [ ] Purchasing upgrades updates state (reactive)
- [ ] Pause menu opens with Escape
- [ ] Pause menu has Resume, Main Menu options
- [ ] Welcome back modal displays offline earnings
- [ ] Modal dismisses on any key press
- [ ] All input through InputManager contexts
- [ ] Proper z-ordering (modals on top)

---

### Task 19: Integration, Polish, and Testing

**Status:** Not Started
**Blocked By:** All above
**Est. Time:** 4 hours

#### Objective

Final integration, polish, and comprehensive testing to ensure feature parity with v1.

#### Scope

**In Scope:**
- Integration testing of full game flow
- Feature parity verification against checklist
- Bug fixes discovered during integration
- Performance verification
- Code cleanup and documentation

**Out of Scope:**
- New features not in v1
- Visual redesign

#### Feature Parity Checklist

From FRD, all must work identically:

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

#### Manual Test Plan

| Scenario | Steps | Expected |
|----------|-------|----------|
| Fresh start | Launch game | Main menu with empty slots |
| New game | Create in slot 1 | Enter apartment |
| Movement | WASD in apartment | Player moves smoothly |
| Collision | Walk into station | Player stops |
| Interaction | Approach desk, Enter | Code Breaker launches |
| Minigame | Complete sequences | Score, combo, money |
| HUD reactivity | Earn money | HUD updates automatically |
| Save/Load | Exit, relaunch, continue | State preserved |
| Offline | Close 5 min, reopen | Modal shows earnings |
| Pause | Press Escape | Menu opens |
| Input blocking | Open pause menu | Player can't move |

#### Acceptance Criteria

- [ ] All feature parity items checked off
- [ ] All manual test scenarios pass
- [ ] No console errors during normal play
- [ ] HMR works without leaks
- [ ] Performance stable (60 FPS)
- [ ] v1 saves load correctly (if any exist)

---

## Progress Log

| Date | Task | Update |
|------|------|--------|
| 2026-01-20 | - | Task breakdown created |

---

## Notes

### v1 Reference Patterns

The following v1 files on `main` branch can be referenced for implementation patterns:
- `src/game/Game.ts` - Factory pattern, system ownership
- `src/input/InputManager.ts` - Context priority, held keys
- `src/ui/scenes/scene-manager.ts` - Lifecycle hooks
- `src/minigames/base-minigame.ts` - Event emitter, scoring
- `src/core/game-state.ts` - Zustand store pattern
- `src/core/storage/` - Storage adapter pattern

### Key Architectural Principles

1. **Single entry point** - `Game.create()` initializes everything
2. **Explicit dependencies** - Constructor injection, no service locator
3. **Reactive UI** - Zustand subscriptions, no manual refresh
4. **Centralized input** - All keyboard handling through InputManager
5. **Event-driven communication** - EventBus for cross-system events
6. **Clean lifecycle** - Every `create()` has matching `destroy()`
