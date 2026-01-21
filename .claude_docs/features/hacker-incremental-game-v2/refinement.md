# Refinement Notes: Hacker Incremental Game v2

**Refined:** 2026-01-20
**FRD Location:** `/Users/stephen/Projects/hacking-game/.claude_docs/features/hacker-incremental-game-v2/frd.md`

---

## Executive Summary

The FRD proposes a solid architectural improvement over the current codebase. After validating against the existing implementation, the core patterns (Game class, ServiceContainer, InputManager) are viable but need some adjustments. The current codebase already uses good patterns (class-based managers with singleton exports, Zustand vanilla store) that the v2 architecture preserves. The main refinement needed is ensuring the InputManager properly handles the existing input complexity and that the migration preserves feature parity.

---

## Codebase Alignment

### Verified Assumptions

| FRD Claim | Validation | Evidence |
|-----------|------------|----------|
| "14-step initialization in main.ts" | Confirmed | `/Users/stephen/Projects/hacking-game/src/main.ts` lines 256-481 - actually 14 well-documented steps |
| "Too many global singletons" | Confirmed | HUD, SceneManager, Player, SaveSystem, TickEngine all use module-level singleton pattern |
| "Duplicated HUD creation" | Partially Confirmed | HUD is created in main.ts, but it's a clean pattern - HUD manages its own state well |
| "Scattered configuration" | Confirmed | Config in `game-config.ts`, `renderer.ts` (canvas size), `types.ts` (version) |
| "Multiple input handlers" | Confirmed | Input in `player.ts` (lines 328-373), `in-game-menu.ts` (lines 551-626), `code-breaker-scene.ts` (lines 585-644), `main.ts` (debug controls lines 177-236) |
| "Zustand vanilla with subscribeWithSelector" | Confirmed | `/Users/stephen/Projects/hacking-game/src/core/game-state.ts` lines 114-115 |
| "Storage adapter abstraction exists" | Confirmed | `/Users/stephen/Projects/hacking-game/src/core/storage.ts` provides async StorageAdapter interface |

### Corrections Needed

1. **FRD says:** "HUD is created in main.ts and also has internal state management"
   - **Reality:** The HUD pattern is actually good - `HUDManager` class encapsulates state, singleton pattern provides access. The issue is the _multiple_ singletons, not the pattern itself.

2. **FRD says:** Scene lifecycle hooks "onEnter, onExit, onUpdate, onDestroy"
   - **Reality:** Confirmed exact match at `/Users/stephen/Projects/hacking-game/src/ui/scenes/scene-manager.ts` lines 34-60

3. **FRD says:** Base minigame abstract class
   - **Reality:** It's an interface + abstract class at `/Users/stephen/Projects/hacking-game/src/minigames/base-minigame.ts` - excellent pattern with event emitter, scoring, timing already built in

---

## Key Files Analysis

### Core Systems (Will Modify/Replace)

| File | Lines | Purpose | Notes |
|------|-------|---------|-------|
| `/Users/stephen/Projects/hacking-game/src/main.ts` | 522 | Entry point with 14-step init | Replace entirely with minimal entry |
| `/Users/stephen/Projects/hacking-game/src/core/game-state.ts` | 455 | Zustand store | Keep as-is, good pattern |
| `/Users/stephen/Projects/hacking-game/src/core/types.ts` | 321 | TypeScript interfaces | Keep, extend for new types |
| `/Users/stephen/Projects/hacking-game/src/core/save-system.ts` | 695 | Save/load with slots | Keep, wrap in SaveManager |
| `/Users/stephen/Projects/hacking-game/src/core/tick-engine.ts` | 468 | Idle progression | Keep class, remove singleton wrapper |
| `/Users/stephen/Projects/hacking-game/src/core/game-config.ts` | 178 | Configuration constants | Consolidate into GameConfig |

### UI Systems (Will Modify)

| File | Lines | Purpose | Notes |
|------|-------|---------|-------|
| `/Users/stephen/Projects/hacking-game/src/ui/renderer.ts` | 248 | PixiJS setup | Keep, wrap in Renderer class |
| `/Users/stephen/Projects/hacking-game/src/ui/hud.ts` | 506 | Resource display | Keep HUDManager, inject via services |
| `/Users/stephen/Projects/hacking-game/src/ui/scenes/scene-manager.ts` | 355 | Scene management | Keep SceneManager class, good pattern |
| `/Users/stephen/Projects/hacking-game/src/ui/in-game-menu.ts` | 821 | Pause menu | Needs input handling extracted |

### Input Handling (Major Refactor Target)

| File | Lines | Input Type | Notes |
|------|-------|------------|-------|
| `/Users/stephen/Projects/hacking-game/src/overworld/player.ts` | 404 | Movement (WASD/Arrows) + Interact | `setupPlayerInput()` at line 328 |
| `/Users/stephen/Projects/hacking-game/src/ui/in-game-menu.ts` | 821 | Escape, navigation | `handleKeydown()` at line 551 |
| `/Users/stephen/Projects/hacking-game/src/minigames/code-breaker/code-breaker-scene.ts` | 753 | Numbers 0-9, Escape, Enter | `setupInputHandler()` at line 585 |
| `/Users/stephen/Projects/hacking-game/src/main.ts` | 522 | Debug keys (M, R, T, N, U) | `setupDebugControls()` at line 177 |

---

## FRD Proposal Validation

### 1. Root Game Class with Game.create() Factory

**Status:** Viable

**Analysis:**
- The proposed async factory pattern `Game.create()` aligns well with PixiJS 8.x's async init
- Current `init()` in main.ts already handles async flow
- The constructor-registers-services pattern is clean

**Recommendation:** Keep as proposed, but add explicit dependency ordering in comments.

### 2. ServiceContainer for Lightweight DI

**Status:** Viable with caveats

**Analysis:**
- Simple Map-based container is appropriate for this codebase size
- Type safety concern: `get<T>(key: string): T` loses compile-time type checking
- Current pattern uses module-level exports which provides better type safety

**Recommendations:**
1. Add typed service keys:
```typescript
interface ServiceMap {
  config: GameConfig;
  store: GameStore;
  renderer: Renderer;
  // ...
}

class ServiceContainer {
  get<K extends keyof ServiceMap>(key: K): ServiceMap[K];
}
```

2. Or use a simpler approach - pass dependencies explicitly through constructor injection instead of a container. The current codebase is small enough that explicit DI is cleaner.

### 3. InputManager with Context-Based Dispatching

**Status:** Needs enhancement

**Analysis of current input complexity:**
- **Player movement:** Continuous key states (held keys), uses keydown AND keyup
- **Minigame input:** Single key presses (digit input)
- **Menu navigation:** Single key presses with preventDefault
- **Global bindings:** Escape works across multiple contexts
- **Overlap handling:** WASD used for both player movement AND menu navigation

**Current Issues the FRD correctly identifies:**
1. Each system adds its own window event listeners
2. No coordination when multiple listeners exist
3. No way to disable player input during dialogs

**FRD proposal gaps:**
1. The `InputContext` interface only handles `pressed` (keydown), not `released` (keyup)
2. Player movement requires tracking held keys, not just reacting to presses
3. No handling of continuous input states

**Enhanced InputManager Recommendation:**

```typescript
interface InputBinding {
  onPress?: () => void;
  onRelease?: () => void;
  // For continuous checking (movement)
  isHeld?: boolean;
}

interface InputContext {
  id: string;
  priority: number; // Higher = checked first (dialogs > scenes)
  bindings: Map<string, InputBinding>;
  enabled: boolean;
  blocksPropagation: boolean; // Stop checking lower priority contexts
}

class InputManager {
  // Track key states for continuous input
  private keyStates: Map<string, boolean> = new Map();

  // Check if key is currently held (for movement)
  isKeyHeld(code: string): boolean;

  // Register context with priority (dialogs = 100, scenes = 50, global = 0)
  registerContext(context: InputContext): void;
}
```

### 4. MinigameRegistry for Plugin-Like Registration

**Status:** Viable but may be overengineered

**Analysis:**
- Current codebase has ONE minigame (Code Breaker)
- The proposed MinigameDefinition structure is good
- However, minigames are already cleanly modular via the Scene + BaseMinigame pattern

**Recommendation:** Implement a lightweight version:
- Keep MinigameRegistry but simplify to just a Map of minigame IDs to scene factories
- The existing `BaseMinigame` abstract class + `Scene` interface already provides the plugin structure
- Defer complex configuration until a second minigame is actually added

### 5. Consolidated GameConfig Object

**Status:** Viable with minor changes

**Analysis:**
- Current `/Users/stephen/Projects/hacking-game/src/core/game-config.ts` already has a `GAME_CONFIG` master object
- FRD proposes similar structure
- Minor discrepancy: FRD has `canvas.width/height` but current has `UI_CONFIG.canvas.width/height`

**Recommendation:** Merge proposed structure with existing. Key additions:
- Add `debug.showFps` and `debug.showCollisionBoxes` (FRD addition)
- Keep existing config structure names for backward compatibility

---

## Testability Validation

### Current Test Coverage

Existing tests at:
- `/Users/stephen/Projects/hacking-game/src/core/game-state.test.ts` - Selectors and insertScore
- `/Users/stephen/Projects/hacking-game/src/core/resource-manager.test.ts`
- `/Users/stephen/Projects/hacking-game/src/core/auto-generation.test.ts`
- `/Users/stephen/Projects/hacking-game/src/core/save-system.test.ts`
- `/Users/stephen/Projects/hacking-game/src/core/offline-progress.test.ts`
- `/Users/stephen/Projects/hacking-game/src/core/upgrades.test.ts`
- `/Users/stephen/Projects/hacking-game/src/ui/scenes/main-menu.test.ts`

**Testing Pattern:** Tests use Vitest with mock state factories (`createMockGameState()`).

### FRD Testing Claims Validation

**Claim:** "The new architecture is designed for testability"

**Analysis:**
The proposed ServiceContainer + DI pattern DOES improve testability:
1. Scenes can be tested with mock services
2. InputManager can be tested in isolation
3. Game class can be tested with mock dependencies

**BUT:** The current codebase already achieves testability via:
1. Pure functions extracted from classes (selectors, insertScore)
2. Class instances that can be instantiated directly in tests
3. Mock state factories

**Verdict:** The v2 architecture will be marginally more testable, but the current architecture is already reasonably testable. The bigger win is organizational clarity.

---

## Lateral Moves / Simpler Alternatives

### Alternative 1: Incremental Refactor Instead of Rewrite

Instead of a complete rewrite, consider:
1. Create `Game` class that wraps existing singletons
2. Add `InputManager` as a new system
3. Gradually migrate singletons to be owned by Game

**Pros:** Lower risk, can be done incrementally
**Cons:** May result in awkward hybrid patterns

**Recommendation:** Given the codebase size (~5k lines of src), a rewrite is reasonable. The incremental approach would likely take similar effort.

### Alternative 2: Skip ServiceContainer, Use Explicit DI

Instead of:
```typescript
services.get<Renderer>('renderer')
```

Use:
```typescript
new ApartmentScene({
  renderer,
  store,
  inputManager
})
```

**Pros:** Better type safety, clearer dependencies, no container boilerplate
**Cons:** More constructor parameters

**Recommendation:** For this codebase size, explicit DI may be cleaner. Consider a hybrid where Game owns services and passes them explicitly.

### Alternative 3: Keep Functional Singletons

The current pattern of:
```typescript
// Module exports singleton functions
export function startTickEngine(): void { tickEngine.start(); }
```

Is actually not bad for this size project. The issue is the _global state_, not the pattern.

**Recommendation:** Keep this pattern but make the underlying classes injectable for testing.

---

## Feature Parity Checklist Review

The FRD lists 24 features. Verified against codebase:

| Feature | Verified | Location |
|---------|----------|----------|
| Save system with 3 slots | Yes | `save-system.ts` MAX_SLOTS = 3 |
| Player name input | Yes | `main-menu.ts` name input flow |
| Main menu (New/Continue/Delete) | Yes | `main-menu.ts` buildMenuItems() |
| Apartment overworld | Yes | `apartment.ts` |
| 2D movement (WASD/Arrows) | Yes | `player.ts` MOVE_*_KEYS |
| Collision detection | Yes | `apartment.ts` collision system |
| Station interactions | Yes | `stations.ts` desk/couch/bed |
| Code Breaker minigame | Yes | `code-breaker/` directory |
| Combo system | Yes | `base-minigame.ts` incrementCombo() |
| Score recording (top 5) | Yes | `game-state.ts` insertScore() |
| Resource rewards | Yes | `code-breaker-scene.ts` handleGameComplete() |
| Idle progression | Yes | `tick-engine.ts` |
| Auto-generation from scores | Yes | `auto-generation.ts` |
| Offline progression | Yes | `offline-progress.ts` |
| Welcome-back modal | Yes | `welcome-back-modal.ts` |
| HUD (resources, rates) | Yes | `hud.ts` |
| Upgrade panel | Yes | `upgrade-panel.ts` |
| Upgrade purchasing | Yes | `upgrades.ts` |
| In-game pause menu | Yes | `in-game-menu.ts` |
| Exit to main menu | Yes | `in-game-menu.ts` handleExitToMainMenu() |
| Auto-save (30s) | Yes | `save-system.ts` AUTO_SAVE_INTERVAL_MS |
| Debug controls | Yes | `main.ts` setupDebugControls() |

All 22 unique features verified present.

---

## Open Questions Resolution

### Q1: "Should we support save format migration, or assume clean slate for v2?"

**Answer:** Support migration.

**Rationale:**
- Current `save-system.ts` already has `migrateState()` function (lines 355-371)
- Version tracking exists: `SAVE_VERSION = '1.1.0'`
- Migration from 1.0.0 to 1.1.0 (adding playerName) is already implemented
- Save structure in FRD matches current structure exactly

**Recommendation:** Keep save format identical. v2 should be a transparent upgrade.

### Q2: "Include basic touch input support now, or defer entirely?"

**Answer:** Defer.

**Rationale:**
- FRD correctly lists mobile as lowest priority
- Adding touch now would complicate InputManager design
- Better to get the architecture right first

**Recommendation:** Design InputManager to be extensible for touch later (separate handler class for touch/pointer), but don't implement.

### Q3: "Add FPS counter in debug mode during rewrite for performance validation?"

**Answer:** Yes, add it.

**Rationale:**
- PixiJS provides `app.ticker.FPS`
- Easy to add to HUD conditionally
- Useful for validating the rewrite doesn't regress performance

**Recommendation:** Add to debug config and HUD.

---

## FRD Updates Recommended

1. **Enhance InputContext interface** to support key release events and held key checking for movement systems

2. **Simplify or remove ServiceContainer** in favor of explicit dependency injection - cleaner for this codebase size

3. **Add typed service registry** if keeping ServiceContainer

4. **Clarify MinigameRegistry scope** - keep lightweight, don't overengineer for one minigame

5. **Add FPS counter** to debug features

6. **Confirm save format backward compatibility** - explicitly state v1 saves will work

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Feature regression | Medium | High | Comprehensive feature parity checklist in FRD |
| Input system bugs | Medium | Medium | Thorough manual testing of all input scenarios |
| Save compatibility break | Low | High | Keep exact same save structure, test migration |
| Performance regression | Low | Medium | Add FPS counter for validation |
| Scope creep | Medium | Medium | Strict adherence to "no UX changes" rule |

---

## Readiness Checklist

- [x] All FRD assumptions validated
- [x] Lateral moves considered (incremental refactor vs rewrite)
- [x] Implementation risks assessed
- [x] Feature parity verified (22 features)
- [x] Open questions answered
- [x] Testability claims validated
- [ ] FRD updates applied (recommended changes above)
- [x] Ready for task breakdown

---

## Next Agent to Invoke

**Agent:** `backend-implementation` (or `frontend-implementation` since this is purely frontend)

**Context to provide:**
- Feature slug: `hacker-incremental-game-v2`
- Tier: MEDIUM
- Refinement summary: FRD validated against codebase, core architecture is viable with minor adjustments to InputManager design. All 22 features verified present in current codebase. Save format backward compatible. Ready for implementation.
- Key files to modify:
  - Create: `/Users/stephen/Projects/hacking-game/src/game/Game.ts`
  - Create: `/Users/stephen/Projects/hacking-game/src/input/InputManager.ts`
  - Replace: `/Users/stephen/Projects/hacking-game/src/main.ts`
  - Modify: Existing systems to accept injected dependencies

**After that agent completes:**
Implementation of the core Game class, InputManager, and migration of existing systems to the new architecture. All existing features should continue working identically.
