# FRD: Hacker Incremental Game v2 - Complete Rewrite

**Created:** 2026-01-20
**Tier:** MEDIUM
**Triage Scores:** Complexity 6/10, Risk 5/10
**Status:** Draft

## Problem Statement

The current hacker incremental game implementation (v1) is functionally complete but has accumulated architectural issues that make it difficult to maintain, test, and extend. A complete rewrite is needed to establish a clean foundation for future development.

### Current Pain Points

1. **Complex 14-step initialization in main.ts** - The init() function has grown to over 200 lines with tightly coupled initialization steps that are difficult to understand and modify.

2. **Too many global singletons** - Multiple systems (HUD, SceneManager, Player, SaveSystem, TickEngine) use module-level singleton patterns with separate init/get/destroy functions, leading to scattered state and unclear ownership.

3. **Duplicated HUD creation** - The HUD is created in main.ts and also has internal state management, with unclear responsibility boundaries.

4. **Scattered configuration** - Configuration constants are spread across multiple files (game-config.ts, renderer.ts, types.ts) without a clear hierarchy.

5. **Multiple input handlers** - Keyboard input is handled in player.ts, in-game-menu.ts, main.ts (debug controls), and code-breaker-scene.ts, with no centralized coordination.

### Goals

1. **Cleaner code organization and testability** (highest priority)
2. **Easier to add new minigames**
3. **Performance**
4. **Mobile readiness** (lowest priority)

## Proposed Solution

### Overview

Rewrite the game from scratch with a centralized `Game` class that acts as the root container for all systems. Use dependency injection to wire systems together, eliminating global singletons. Implement a centralized input manager that dispatches events to the active scene.

### Key Components

1. **Game Class:** Root container managing all systems with clear initialization order
2. **Service Container:** Lightweight DI system for accessing shared services
3. **Input Manager:** Centralized keyboard/pointer input with scene-aware dispatching
4. **Scene System:** Enhanced scene manager with typed scene context
5. **Minigame Registry:** Plugin-like system for registering new minigames
6. **Config System:** Hierarchical configuration with runtime overrides

### User Experience

No changes to user experience. The rewrite is purely architectural - all existing features remain identical:
- Main menu with 3 save slots
- Apartment overworld with 2D movement
- Code Breaker minigame
- Resource display HUD
- Upgrade system
- Offline progression
- In-game pause menu

## Technical Design

### Architecture Overview

```
src/
├── game/
│   ├── Game.ts              # Root game class
│   ├── ServiceContainer.ts  # Dependency injection container
│   └── GameConfig.ts        # Unified configuration
├── core/
│   ├── types.ts             # Shared TypeScript interfaces
│   ├── state/
│   │   ├── GameStore.ts     # Zustand store (vanilla + subscribeWithSelector)
│   │   └── selectors.ts     # State selectors
│   ├── resources/
│   │   └── ResourceManager.ts  # Decimal operations and formatting
│   ├── persistence/
│   │   ├── StorageAdapter.ts   # Async storage interface
│   │   ├── LocalStorageAdapter.ts
│   │   └── SaveManager.ts      # Save/load with slots
│   └── progression/
│       ├── TickEngine.ts       # Idle progression loop
│       ├── AutoGeneration.ts   # Score-based generation rates
│       └── OfflineProgress.ts  # Offline earnings calculation
├── input/
│   ├── InputManager.ts      # Centralized input handling
│   ├── KeyboardHandler.ts   # Keyboard event processing
│   └── InputContext.ts      # Scene-specific input bindings
├── rendering/
│   ├── Renderer.ts          # PixiJS application wrapper
│   ├── Styles.ts            # Text styles
│   └── Effects.ts           # Visual effects (glow, scanlines)
├── scenes/
│   ├── SceneManager.ts      # Scene lifecycle management
│   ├── Scene.ts             # Base scene interface
│   ├── main-menu/
│   │   └── MainMenuScene.ts
│   ├── apartment/
│   │   ├── ApartmentScene.ts
│   │   ├── Player.ts
│   │   ├── Station.ts
│   │   └── CollisionSystem.ts
│   └── minigames/
│       ├── MinigameScene.ts    # Base minigame scene
│       ├── MinigameRegistry.ts # Minigame registration
│       └── code-breaker/
│           ├── CodeBreakerGame.ts
│           └── CodeBreakerScene.ts
├── ui/
│   ├── UIManager.ts         # UI layer management
│   ├── HUD.ts               # Resource display
│   ├── UpgradePanel.ts
│   ├── PauseMenu.ts
│   └── Modal.ts             # Reusable modal component
├── upgrades/
│   ├── UpgradeDefinitions.ts
│   └── UpgradeManager.ts
└── main.ts                  # Entry point (minimal)
```

### Core Design Patterns

#### 1. Game Class (Root Container)

```typescript
// game/Game.ts
export class Game {
  private readonly services: ServiceContainer;
  private readonly renderer: Renderer;
  private readonly sceneManager: SceneManager;
  private readonly inputManager: InputManager;
  private readonly saveManager: SaveManager;
  private readonly tickEngine: TickEngine;
  private readonly uiManager: UIManager;

  private constructor(services: ServiceContainer) {
    this.services = services;
    // Initialize systems in dependency order
  }

  static async create(config: GameConfig): Promise<Game> {
    const services = new ServiceContainer();

    // 1. Register configuration
    services.register('config', config);

    // 2. Initialize storage
    const storage = createStorageAdapter(config.storage);
    services.register('storage', storage);

    // 3. Initialize renderer (async - PixiJS init)
    const renderer = await Renderer.create(config.canvas);
    services.register('renderer', renderer);

    // 4. Initialize game store
    const store = createGameStore();
    services.register('store', store);

    // 5. Create game instance with all dependencies
    return new Game(services);
  }

  start(): void {
    this.tickEngine.start();
    this.sceneManager.switchTo('main-menu');
  }

  destroy(): void {
    this.tickEngine.stop();
    this.inputManager.destroy();
    this.sceneManager.destroy();
    this.renderer.destroy();
  }
}
```

#### 2. Service Container (Lightweight DI)

```typescript
// game/ServiceContainer.ts
export class ServiceContainer {
  private services = new Map<string, unknown>();

  register<T>(key: string, service: T): void {
    this.services.set(key, service);
  }

  get<T>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service '${key}' not registered`);
    }
    return service as T;
  }

  has(key: string): boolean {
    return this.services.has(key);
  }
}
```

#### 3. Centralized Input Manager

```typescript
// input/InputManager.ts
export interface InputContext {
  id: string;
  bindings: Map<string, () => void>;
  enabled: boolean;
}

export class InputManager {
  private contexts: Map<string, InputContext> = new Map();
  private activeContextId: string | null = null;
  private keyboardHandler: KeyboardHandler;

  constructor() {
    this.keyboardHandler = new KeyboardHandler(this.handleKey.bind(this));
  }

  registerContext(context: InputContext): void {
    this.contexts.set(context.id, context);
  }

  setActiveContext(id: string): void {
    this.activeContextId = id;
  }

  private handleKey(code: string, pressed: boolean): void {
    if (!this.activeContextId) return;

    const context = this.contexts.get(this.activeContextId);
    if (!context?.enabled) return;

    const action = context.bindings.get(code);
    if (action && pressed) {
      action();
    }
  }

  // Global bindings that work regardless of context (e.g., Escape for pause)
  registerGlobalBinding(code: string, action: () => void): void {
    // ...
  }
}
```

#### 4. Enhanced Scene Interface

```typescript
// scenes/Scene.ts
export interface Scene {
  readonly id: string;
  readonly container: Container;

  // Lifecycle hooks
  onEnter?(context: SceneContext): void | Promise<void>;
  onExit?(): void | Promise<void>;
  onUpdate?(deltaMs: number): void;
  onDestroy?(): void;

  // Input context for this scene
  getInputContext?(): InputContext;
}

export interface SceneContext {
  services: ServiceContainer;
  previousScene: string | null;
  data?: Record<string, unknown>;
}
```

#### 5. Minigame Registry

```typescript
// scenes/minigames/MinigameRegistry.ts
export interface MinigameDefinition {
  id: string;
  name: string;
  description: string;
  createScene: (services: ServiceContainer) => MinigameScene;
  config: MinigameConfig;
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
}

// Usage - registering Code Breaker
minigameRegistry.register({
  id: 'code-breaker',
  name: 'Code Breaker',
  description: 'Match sequences to hack into systems',
  createScene: (services) => new CodeBreakerScene(services),
  config: CODE_BREAKER_CONFIG,
});
```

#### 6. Unified Configuration

```typescript
// game/GameConfig.ts
export interface GameConfig {
  // Canvas/rendering
  canvas: {
    width: number;
    height: number;
    backgroundColor: number;
  };

  // Storage
  storage: {
    type: 'localStorage' | 'indexedDB';
    keyPrefix: string;
    maxSlots: number;
  };

  // Gameplay
  gameplay: {
    offlineMaxHours: number;
    offlineEfficiency: number;
    autoSaveIntervalMs: number;
  };

  // Minigames (keyed by ID)
  minigames: {
    [id: string]: MinigameConfig;
  };

  // Upgrades
  upgrades: {
    defaultGrowthRate: number;
  };

  // Debug
  debug: {
    enabled: boolean;
    showFps: boolean;
    showCollisionBoxes: boolean;
  };
}

// Default configuration
export const DEFAULT_CONFIG: GameConfig = {
  canvas: {
    width: 1024,
    height: 768,
    backgroundColor: 0x0a0a0a,
  },
  storage: {
    type: 'localStorage',
    keyPrefix: 'hacker-incremental',
    maxSlots: 3,
  },
  gameplay: {
    offlineMaxHours: 8,
    offlineEfficiency: 0.5,
    autoSaveIntervalMs: 30000,
  },
  minigames: {
    'code-breaker': {
      timeLimitMs: 60000,
      sequenceLength: 5,
      basePoints: 100,
      scoreToResourceRatio: 1,
    },
  },
  upgrades: {
    defaultGrowthRate: 1.15,
  },
  debug: {
    enabled: import.meta.env.DEV,
    showFps: false,
    showCollisionBoxes: false,
  },
};
```

### Patterns to Keep (from v1)

These patterns worked well and should be preserved:

1. **Storage adapter abstraction** - Async interface for cross-platform storage
2. **Scene manager lifecycle hooks** - onEnter, onExit, onUpdate, onDestroy
3. **Base minigame abstract class** - Common scoring, timing, and event system
4. **Class-based singletons** - Using classes instead of module-level state
5. **Zustand vanilla store with subscribeWithSelector** - Efficient state subscriptions

### Data Model

No changes to the save state structure. Maintain backward compatibility with v1 saves:

```typescript
interface GameState {
  version: string;
  lastSaved: number;
  lastPlayed: number;
  playerName: string;

  resources: {
    money: string;      // Decimal as string
    technique: string;
    renown: string;
  };

  minigames: {
    [id: string]: {
      unlocked: boolean;
      topScores: string[];
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

### Entry Point (Minimal main.ts)

```typescript
// main.ts
import { Game } from './game/Game';
import { DEFAULT_CONFIG } from './game/GameConfig';

async function main(): Promise<void> {
  try {
    const game = await Game.create(DEFAULT_CONFIG);
    game.start();

    // HMR support
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        game.destroy();
      });
    }
  } catch (error) {
    console.error('Failed to initialize game:', error);
    showErrorScreen(error);
  }
}

main();
```

## Implementation Notes

### Migration Strategy

This is a complete rewrite, not a refactor. The approach:

1. Create new directory structure alongside existing code
2. Implement core systems (Game, ServiceContainer, InputManager)
3. Port existing logic to new architecture
4. Replace main.ts entry point
5. Remove old code

### Testing Strategy

The new architecture is designed for testability:

```typescript
// Example: Testing a scene in isolation
describe('ApartmentScene', () => {
  let services: ServiceContainer;
  let scene: ApartmentScene;

  beforeEach(() => {
    services = new ServiceContainer();
    services.register('store', createMockStore());
    services.register('renderer', createMockRenderer());
    services.register('input', createMockInputManager());

    scene = new ApartmentScene(services);
  });

  it('should handle player movement', () => {
    scene.onEnter({ services, previousScene: null });

    // Simulate input
    scene.getInputContext().bindings.get('KeyD')?.();
    scene.onUpdate(16);

    expect(scene.player.x).toBeGreaterThan(initialX);
  });
});
```

### Feature Parity Checklist

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
- [ ] Debug controls (dev mode)

## Testing Strategy

### Unit Tests

- Service container registration and retrieval
- Input manager context switching
- Scene lifecycle hooks
- Resource calculations
- Save/load serialization
- Offline progress calculations

### Integration Tests

- Game initialization sequence
- Scene transitions
- Input dispatching to active scene
- Save slot selection and loading
- Minigame completion flow

### Manual Testing

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Fresh start | Launch game | Main menu with empty slots |
| New game | Create game in slot 1 | Enter apartment with default state |
| Movement | WASD in apartment | Player moves, collides with stations |
| Minigame | Interact with desk | Code Breaker launches |
| Scoring | Complete sequences | Score increases, combo builds |
| Save/Load | Exit, relaunch, continue | State preserved |
| Offline | Close for 5 min, reopen | Welcome-back modal shows earnings |

## Acceptance Criteria

- [ ] Single Game class as entry point (no scattered singletons)
- [ ] All input handled through InputManager
- [ ] Configuration in single hierarchical object
- [ ] New minigames addable via registry (no main.ts changes)
- [ ] All existing features working identically
- [ ] Test coverage for core systems
- [ ] HMR working without memory leaks
- [ ] v1 save files load correctly

## Open Questions

- [ ] Should we support save format migration, or assume clean slate for v2?
- [ ] Include basic touch input support now, or defer entirely?
- [ ] Add FPS counter in debug mode during rewrite for performance validation?

---

## Next Agent to Invoke

**Agent:** `frd-refiner`

**Context to provide:**
- Feature slug: `hacker-incremental-game-v2`
- Tier: MEDIUM
- FRD location: `.claude_docs/features/hacker-incremental-game-v2/frd.md`
- This is an architectural rewrite - refinement should focus on validating the proposed patterns against the existing codebase

**After that agent completes:**
The FRD Refiner will validate the technical design against the existing implementation, identify any missing details, and ensure the patterns proposed will actually address the identified issues. The refined FRD will then be ready for task breakdown.
