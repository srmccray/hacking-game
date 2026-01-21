# Refinement Notes: Hacker Incremental Game v2 Architecture Rebuild

**Refined:** 2026-01-20 (Updated)
**FRD Location:** `.claude_docs/features/hacker-incremental-game-v2/frd.md`

---

## Executive Summary

After thorough codebase analysis, the v1 implementation is **significantly more mature than the FRD problem statement suggests**. The v1 already has:

- A `Game.create()` factory pattern with proper async initialization
- A functional `InputManager` class with context-based priority dispatching
- A `SceneManager` with lifecycle hooks (`onEnter`, `onExit`, `onUpdate`, `onDestroy`)
- A `BaseMinigame` abstract class with event emitter pattern
- Zustand vanilla store with `subscribeWithSelector`
- HUD with reactive Zustand subscriptions

The v2 rebuild should focus on **refinement rather than rewrite**:
1. Unifying ALL input handling through InputManager (eliminating raw `keydown` listeners)
2. Removing manual `refreshHUD()` / `refreshUpgradePanel()` calls for pure reactivity
3. Adding EventBus for cross-system events
4. Adding MinigameRegistry for extensibility

---

## Codebase Alignment

### Verified Assumptions

| FRD Claim | Validation | Evidence |
|-----------|------------|----------|
| Game factory method exists | Confirmed | `src/game/Game.ts` - `Game.create()` already implemented |
| InputManager with priority | Confirmed | `src/input/InputManager.ts` - contexts, global bindings, held keys all implemented |
| SceneManager lifecycle hooks | Confirmed | `src/ui/scenes/scene-manager.ts` - `onEnter`, `onExit`, `onUpdate`, `onDestroy` |
| BaseMinigame event emitter | Confirmed | `src/minigames/base-minigame.ts` - `on()`, `emit()` methods, scoring, timing |
| Zustand with subscriptions | Confirmed | `src/core/game-state.ts` - `subscribeWithSelector` middleware |
| Storage adapter abstraction | Confirmed | `src/core/storage/` - async interface with local storage implementation |

### Corrections Needed to FRD

1. **FRD overstates initialization complexity**
   - FRD claims: "14-step async init in main.ts (~200+ lines)"
   - Reality: `main.ts` is ~50 lines, all complexity already in `Game.create()`
   - **Update needed:** Acknowledge v1 already achieved this goal

2. **FRD overstates input handling scatter**
   - FRD claims: "Scattered across 4+ files with no coordination"
   - Reality: `InputManager` exists with context priority, global bindings, held keys
   - **Actual issue:** Some components still use raw `window.addEventListener` alongside InputManager:
     - `in-game-menu.ts` - has its own `handleKeydown` function
     - `code-breaker-scene.ts` - has its own `setupInputHandler` function

3. **EventBus is a net-new addition**
   - FRD presents EventBus as replacement for something
   - Reality: v1 doesn't have an EventBus at all
   - **Update needed:** Frame EventBus as an addition for cross-system events, not a replacement

4. **MinigameRegistry doesn't exist in v1**
   - FRD correctly proposes this as new
   - v1 hardcodes minigame registration in `Game.registerScenes()`
   - This is a valid improvement

---

## Key Files

### Will Modify

| File | Changes |
|------|---------|
| `src/game/Game.ts` | Add EventBus creation, MinigameRegistry integration |
| `src/ui/in-game-menu.ts` | **Refactor to use InputManager context** instead of raw `keydown` listener |
| `src/minigames/code-breaker/code-breaker-scene.ts` | **Refactor to use InputManager context** instead of raw `keydown` listener |
| `src/ui/hud.ts` | Remove `refreshHUD()` export, ensure purely reactive |
| `src/ui/upgrade-panel.ts` | Remove `refreshUpgradePanel()`, add Zustand subscriptions |
| `src/ui/welcome-back-modal.ts` | Refactor one-time keydown listener to InputManager context |

### Will Create

| File | Purpose |
|------|---------|
| `src/events/EventBus.ts` | Typed event emitter for cross-system communication |
| `src/events/game-events.ts` | Event type definitions (`minigame:completed`, `upgrade:purchased`, etc.) |
| `src/events/index.ts` | Public exports |
| `src/minigames/MinigameRegistry.ts` | Plugin-like minigame registration system |

### Reference (Keep As-Is)

| File | Pattern to Follow |
|------|-------------------|
| `src/input/InputManager.ts` | Already well-designed - use as-is |
| `src/minigames/base-minigame.ts` | Event emitter pattern |
| `src/ui/scenes/scene-manager.ts` | Scene lifecycle pattern |
| `src/core/tick-engine.ts` | Singleton class with exported functions pattern |
| `src/core/game-state.ts` | Zustand store pattern |

---

## Input Handling Analysis

### Current v1 Input Architecture

The v1 has a **hybrid approach** that needs consolidation:

1. **InputManager (centralized):**
   - Global bindings (Escape key in `Game.ts`)
   - Context registration with priority
   - Held key tracking
   - Release callbacks

2. **Raw listeners (scattered):**
   - `in-game-menu.ts` - `window.addEventListener('keydown', handleKeydown)`
   - `code-breaker-scene.ts` - `window.addEventListener('keydown', keydownHandler)`
   - `welcome-back-modal.ts` - one-time listener for dismissal

### Input Scenarios to Preserve

| Scenario | Current Handler | v2 Handler |
|----------|----------------|------------|
| Player movement (WASD/Arrows held) | `setupPlayerInput()` in `apartment.ts` | InputManager context `apartment` (already works) |
| Station interaction (Enter/Space) | Same callback | Same (already works) |
| **Pause menu open (Escape)** | Global binding in `Game.ts` | Keep as global binding |
| **Pause menu close (Escape)** | Raw listener in `in-game-menu.ts` | InputManager context `in-game-menu` |
| **Menu navigation (Up/Down/Enter)** | Raw listener in `in-game-menu.ts` | InputManager context `in-game-menu` |
| **Confirm dialog (Y/N/Arrows)** | Raw listener checking `confirmContainer` | InputManager context `confirm-dialog` at DIALOG priority |
| **Minigame input (0-9)** | Raw listener in `code-breaker-scene.ts` | InputManager context `code-breaker` |
| **Minigame exit (Escape)** | Raw listener in `code-breaker-scene.ts` | Same context or global condition |
| Debug controls (M/T/N/R/U) | Global bindings in `Game.ts` | Keep as global bindings |

### InputManager Priority Levels (Already Defined)

```typescript
export const INPUT_PRIORITY = {
  GLOBAL: 0,      // Always active
  SCENE: 50,      // Apartment, minigames
  MENU: 75,       // In-game pause menu
  DIALOG: 100,    // Confirm dialogs, modals
} as const;
```

---

## EventBus Scope Analysis

### FRD Proposed Events (Validated)

| Event | Keep? | Justification |
|-------|-------|---------------|
| `RESOURCE_CHANGED` | No | HUD already uses Zustand subscriptions |
| `RESOURCE_EARNED` | No | Zustand subscriptions sufficient |
| `MINIGAME_STARTED` | Yes | Useful for pausing tick engine, analytics |
| `MINIGAME_COMPLETED` | Yes | Useful for recording score, achievements |
| `SCORE_RECORDED` | No | Redundant with direct store call |
| `SCENE_ENTER` | No | SceneManager already has `onEnter` hook |
| `SCENE_EXIT` | No | SceneManager already has `onExit` hook |
| `SAVE_COMPLETED` | No | Direct callback sufficient |
| `SAVE_LOADED` | Yes | Useful for UI refresh after slot switch |
| `UPGRADE_PURCHASED` | Yes | Useful for effects, recalculating rates |
| `OFFLINE_PROGRESS_CALCULATED` | No | Direct callback to modal sufficient |

### Recommended Minimal EventBus Events

```typescript
export const GameEvents = {
  MINIGAME_STARTED: 'minigame:started',
  MINIGAME_COMPLETED: 'minigame:completed',
  UPGRADE_PURCHASED: 'upgrade:purchased',
  SAVE_LOADED: 'save:loaded',
} as const;
```

---

## Manual Refresh Calls to Remove

The following manual refresh calls should be replaced with Zustand subscriptions:

| File | Call | Line(s) | Replacement |
|------|------|---------|-------------|
| `src/game/Game.ts` | `refreshHUD()` | ~186, ~188 | Remove - HUD should subscribe |
| `src/game/Game.ts` | `refreshUpgradePanel()` | ~186, ~188 | Remove - panel should subscribe |
| `src/minigames/code-breaker/code-breaker-scene.ts` | n/a | | Already uses state correctly |
| `src/ui/upgrade-panel.ts` | Internal refresh | | Convert to subscriptions |

---

## FRD Updates Recommended

### 1. Correct Problem Statement

Update to acknowledge v1 progress:

```markdown
### Current State (Corrected)

The v1 implementation has a good foundation with:
- Game.create() factory pattern
- InputManager with context priority
- SceneManager with lifecycle hooks
- BaseMinigame abstract class

However, some input handling still bypasses InputManager, manual refresh
calls exist, and there's no EventBus for cross-system events.
```

### 2. Simplify Technical Changes

Focus the v2 work on:

1. **Input unification** - Migrate all raw `keydown` listeners to InputManager contexts
2. **Pure reactivity** - Remove `refreshHUD()` and `refreshUpgradePanel()` calls
3. **EventBus addition** - Add lightweight typed event system (4 events)
4. **MinigameRegistry** - Add plugin-like minigame registration

### 3. Remove ServiceContainer

The FRD initially proposed a ServiceContainer but the v1 already uses explicit constructor injection in `Game.ts`. This pattern is cleaner for the codebase size. Keep the explicit approach.

---

## Blockers / Concerns

### 1. Race Condition in Menu Input

**Issue:** The `in-game-menu.ts` has a workaround for race conditions between InputManager's global Escape binding and its own handler:

```typescript
// Prevent the same Escape keypress that opened the menu from also closing it
if (event.key === 'Escape') {
  const timeSinceOpen = performance.now() - menuOpenedTime;
  if (timeSinceOpen < 50) {
    return;
  }
}
```

**Solution:** When migrating to InputManager context, use `blocksPropagation: true` on the menu context. The InputManager already supports this.

### 2. Minigame Input Priority

**Issue:** Code Breaker needs to handle Escape differently than other scenes (exit minigame vs open pause menu).

**Current solution:** Raw listener checks game phase before handling Escape.

**v2 solution:** Register minigame at SCENE priority with its own Escape binding. The global Escape binding should check if a minigame is active before opening pause menu.

---

## Ready for Implementation

- [x] FRD assumptions validated against actual codebase
- [x] Key files identified for modification
- [x] Input scenarios documented
- [x] EventBus scope clarified (4 events)
- [x] Manual refresh calls identified for removal
- [x] No major blockers - just refactoring work
- [ ] FRD updates to be applied (recommendations above)

---

## Summary

The v2 rebuild is **less extensive than originally scoped**. The v1 codebase already has:
- Good architecture (Game factory, InputManager, SceneManager, BaseMinigame)
- Good patterns (Zustand subscriptions, async initialization)

The real v2 work is:
1. **Unify input** - 3 components need to migrate from raw listeners to InputManager contexts
2. **Pure reactivity** - Remove ~4-6 manual refresh calls
3. **EventBus** - Add new system with 4 events
4. **MinigameRegistry** - Add new system for extensibility

Estimated effort is reduced from "medium rewrite" to "medium refactoring."

---

## Next Agent to Invoke

**Agent:** `breakdown`

**Context to provide:**
- Feature slug: `hacker-incremental-game-v2`
- Tier: MEDIUM
- Refinement summary: v1 already has good foundation (Game factory, InputManager, SceneManager, BaseMinigame). Main work is: (1) migrate 3 components from raw keydown listeners to InputManager contexts, (2) remove manual refresh calls for pure reactivity, (3) add EventBus with 4 events, (4) add MinigameRegistry for extensibility.
- Key files to modify: `in-game-menu.ts`, `code-breaker-scene.ts`, `welcome-back-modal.ts`, `hud.ts`, `upgrade-panel.ts`, `Game.ts`
- Key files to create: `EventBus.ts`, `game-events.ts`, `MinigameRegistry.ts`

**After that agent completes:**
The breakdown agent will create a detailed task list. Recommended order:
1. Add EventBus and MinigameRegistry (new systems, no changes to existing)
2. Migrate input handlers one at a time (in-game-menu first, then code-breaker, then welcome-back)
3. Remove manual refresh calls and verify reactivity
4. Update FRD with corrected problem statement
