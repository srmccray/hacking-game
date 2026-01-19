# Task Breakdown: Hacker Incremental Game

**FRD:** `.claude_docs/features/hacker-incremental-game/frd.md`
**Refinement:** `.claude_docs/features/hacker-incremental-game/refinement.md`
**Created:** 2026-01-19
**Status:** In Progress

---

## Summary

Build a hacker-themed incremental game with ASCII-inspired visuals, featuring an apartment overworld, Code Breaker minigame, idle/offline progression, and upgrade system. Web-only MVP using TypeScript, Vite, PixiJS, break_eternity.js, and Zustand.

**Total Tasks:** 10
**Estimated Complexity:** Medium (MEDIUM tier feature)

---

## Task Overview

| # | Task | Agent | Status | Blocked By |
|---|------|-------|--------|------------|
| 01 | Project scaffolding and dependencies | frontend-implementation | Complete | - |
| 02 | Core state management (Zustand store) | frontend-implementation | Complete | 01 |
| 03 | Resource system with break_eternity | frontend-implementation | Complete | 02 |
| 04 | Save/load system with localStorage | frontend-implementation | Complete | 02 |
| 05 | PixiJS renderer setup and HUD | frontend-implementation | Complete | 03 |
| 06 | Apartment overworld and player movement | frontend-implementation | Complete | 05 |
| 07 | Code Breaker minigame | frontend-implementation | Complete | 03, 05 |
| 08 | Tick engine and idle progression | frontend-implementation | Complete | 03, 07 |
| 09 | Upgrade system | frontend-implementation | Complete | 03, 05 |
| 10 | Offline progression and welcome-back modal | frontend-implementation | Complete | 04, 08 |

**Status Legend:**
- Not Started
- In Progress
- Complete
- Blocked
- Cancelled

---

## Dependency Graph

```
task-01 (Project Setup)
    |
    v
task-02 (State Management)
    |
    +-------+-------+
    |               |
    v               v
task-03         task-04
(Resources)     (Save/Load)
    |               |
    v               |
task-05             |
(PixiJS/HUD)        |
    |               |
    +-------+-------+-------+
    |       |               |
    v       v               |
task-06  task-07            |
(Overworld) (Minigame)      |
            |               |
            v               |
         task-08            |
         (Tick Engine)      |
            |               |
            +-------+-------+
                    |
                    v
                task-10
            (Offline Progress)

task-09 (Upgrades) - parallel after task-05
```

---

## Critical Path

1. task-01 -> task-02 -> task-03 -> task-05 -> task-07 -> task-08 -> task-10

This is the longest dependency chain. The minigame and tick engine are prerequisites for offline progression to have something to calculate.

---

## Parallel Opportunities

- **After task-02:** task-03 (Resources) and task-04 (Save/Load) can start in parallel
- **After task-05:** task-06 (Overworld) and task-07 (Minigame) can start in parallel
- **After task-05:** task-09 (Upgrades) can start independently
- **After task-03, task-05:** task-07 (Minigame) can start

---

## Lateral Moves (Prerequisites)

None required - this is a greenfield project with no existing code or dependencies.

---

## Progress Log

| Date | Task | Update |
|------|------|--------|
| 2026-01-19 | - | Breakdown created |
| 2026-01-19 | 01 | Complete - Project scaffolded with Vite, TypeScript (strict), PixiJS v8.x, break_eternity.js, and Zustand |
| 2026-01-19 | 07 | Complete - Code Breaker minigame implemented with base minigame class, game logic, PixiJS scene, keyboard input, combo system, timer, score tracking, and resource rewards |
| 2026-01-19 | 08 | Complete - Tick engine with requestAnimationFrame, auto-generation from top 5 scores, upgrade multipliers, HUD rate display, pause/resume support |
| 2026-01-19 | 10 | Complete - Offline progression system with 8-hour cap, 50% efficiency, welcome-back modal showing earnings, skip for <1 minute absences. MVP complete! |

---

# Task Details

---

## Task 01: Project Scaffolding and Dependencies

**Feature:** hacker-incremental-game
**Agent:** frontend-implementation
**Status:** Complete
**Blocked By:** None

### Objective

Initialize the Vite + TypeScript project with all required dependencies and establish the base directory structure.

### Context

This is a greenfield project. We need to set up the foundation that all other tasks will build upon.

#### Relevant FRD Sections
- Technical Approach > Recommended Tech Stack
- Technical Approach > Architecture Overview
- Implementation Notes > Dependencies

### Scope

#### In Scope
- Initialize Vite project with TypeScript template
- Install dependencies: pixi.js, break_eternity.js, zustand
- Create directory structure matching FRD architecture
- Configure TypeScript (strict mode)
- Create placeholder entry point (main.ts)
- Add index.html with canvas container

#### Out of Scope
- Actual game logic implementation
- PixiJS initialization (task-05)
- Any game features

### Implementation Notes

#### Key Files
| File | Action | Notes |
|------|--------|-------|
| `package.json` | Create | Via `npm create vite@latest` |
| `tsconfig.json` | Modify | Enable strict mode |
| `src/main.ts` | Create | Placeholder entry point |
| `src/core/` | Create | Directory for core systems |
| `src/overworld/` | Create | Directory for apartment/player |
| `src/minigames/` | Create | Directory for minigame modules |
| `src/ui/` | Create | Directory for UI components |
| `src/assets/` | Create | Directory for fonts/sprites |
| `index.html` | Modify | Add game container div |

#### Commands to Run
```bash
npm create vite@latest . -- --template vanilla-ts
npm install pixi.js break_eternity.js zustand
```

### Acceptance Criteria

- [ ] Vite project initializes and runs with `npm run dev`
- [ ] All dependencies installed and importable
- [ ] TypeScript compiles without errors
- [ ] Directory structure matches FRD architecture
- [ ] index.html has a container element for PixiJS canvas

### Testing Requirements

- [ ] `npm run dev` starts development server
- [ ] `npm run build` produces production build without errors
- [ ] TypeScript strict mode enabled and working

### Handoff Notes

#### For Next Task
- Project is ready for Zustand store implementation
- All dependencies available for import
- Directory structure established

#### Artifacts Produced
- Complete Vite + TypeScript project
- All npm dependencies installed
- Empty directory structure

---

## Task 02: Core State Management (Zustand Store)

**Feature:** hacker-incremental-game
**Agent:** frontend-implementation
**Status:** Not Started
**Blocked By:** 01

### Objective

Implement the central Zustand store that manages all game state, following the GameState interface from the FRD.

### Context

The Zustand store is the single source of truth for the entire game. It needs to support serialization for save/load and work with break_eternity Decimals.

#### Relevant FRD Sections
- Technical Approach > Data Model > Save State Structure
- Technical Approach > Core Systems

### Scope

#### In Scope
- Create GameState TypeScript interface
- Implement Zustand store with initial state
- Add actions for state mutations
- Support for break_eternity Decimal types
- Version field for future migrations

#### Out of Scope
- Save/load to localStorage (task-04)
- Resource calculations (task-03)
- UI integration

### Implementation Notes

#### Key Files
| File | Action | Notes |
|------|--------|-------|
| `src/core/game-state.ts` | Create | Zustand store definition |
| `src/core/types.ts` | Create | Shared TypeScript interfaces |

#### Patterns to Follow
- Use Zustand's `create` with TypeScript generics
- Store Decimals as strings in state for serialization
- Use immer middleware for immutable updates (optional but recommended)

#### Technical Decisions
- Store Decimal values as serialized strings to support JSON serialization
- Include `version` field from day one for save migrations

### Acceptance Criteria

- [ ] GameState interface matches FRD specification
- [ ] Zustand store created with typed actions
- [ ] Initial state has sensible defaults
- [ ] State can be read from any component
- [ ] Actions mutate state correctly

### Testing Requirements

- [ ] Unit tests for state initialization
- [ ] Unit tests for state mutations
- [ ] Verify Decimal string serialization works

### Handoff Notes

#### For Next Task
- Store is available via `useGameStore()` hook
- State structure documented in types.ts
- Ready for resource manager to add resource-specific actions

#### Artifacts Produced
- `src/core/game-state.ts` - Zustand store
- `src/core/types.ts` - TypeScript interfaces

---

## Task 03: Resource System with break_eternity

**Feature:** hacker-incremental-game
**Agent:** frontend-implementation
**Status:** Not Started
**Blocked By:** 02

### Objective

Implement the resource management system using break_eternity.js for handling large numbers, with helper functions for common operations.

### Context

Incremental games require handling numbers that exceed JavaScript's native number precision. break_eternity.js handles numbers up to 1e9e15.

#### Relevant FRD Sections
- Technical Approach > Core Systems > Resource System
- Data Model > Save State Structure > resources

### Scope

#### In Scope
- Resource manager module wrapping break_eternity
- Helper functions: add, subtract, multiply, format
- Integration with Zustand store
- Number formatting for display (1.23M, 4.56B, etc.)
- Three resource types: money, technique, renown

#### Out of Scope
- Auto-generation calculations (task-08)
- UI display (task-05)
- Upgrade cost calculations (task-09)

### Implementation Notes

#### Key Files
| File | Action | Notes |
|------|--------|-------|
| `src/core/resource-manager.ts` | Create | break_eternity wrapper and helpers |
| `src/core/game-state.ts` | Modify | Add resource-specific actions |

#### Patterns to Follow
- Always use Decimal for calculations, never native numbers
- Convert to string for storage, Decimal for math
- Format numbers with suffixes for readability

#### Technical Decisions
- MVP only actively uses Money; Technique and Renown are placeholders
- Use break_eternity's built-in formatting as base

### Acceptance Criteria

- [ ] Decimal operations work correctly (add, subtract, multiply, divide)
- [ ] Numbers serialize/deserialize without precision loss
- [ ] Format function produces readable strings (1.23K, 4.56M, etc.)
- [ ] Store actions update resources correctly
- [ ] Cannot subtract more than available (no negative resources)

### Testing Requirements

- [ ] Unit tests for Decimal arithmetic
- [ ] Unit tests for serialization roundtrip
- [ ] Unit tests for number formatting at various scales
- [ ] Edge case tests for very large numbers

### Handoff Notes

#### For Next Task
- `addResource(type, amount)` and `subtractResource(type, amount)` available
- `formatNumber(decimal)` for display
- Resources stored in Zustand and ready for UI

#### Artifacts Produced
- `src/core/resource-manager.ts` - Resource operations
- Updated `src/core/game-state.ts` with resource actions

---

## Task 04: Save/Load System with localStorage

**Feature:** hacker-incremental-game
**Agent:** frontend-implementation
**Status:** Not Started
**Blocked By:** 02

### Objective

Implement game state persistence using localStorage with auto-save, manual save/load, and export/import functionality.

### Context

Players expect their progress to persist. The save system must handle Decimal serialization and track timestamps for offline progression.

#### Relevant FRD Sections
- Data Model > Persistence Strategy
- Technical Approach > Core Systems

### Scope

#### In Scope
- Save state to localStorage as JSON
- Load state from localStorage on startup
- Auto-save every 30 seconds
- Save on tab blur/beforeunload
- Track `lastSaved` and `lastPlayed` timestamps
- Export save as base64 string
- Import save from base64 string
- Version field for future migrations

#### Out of Scope
- Offline progress calculation (task-10)
- Cloud save (post-MVP)
- Save migration logic (handle when needed)

### Implementation Notes

#### Key Files
| File | Action | Notes |
|------|--------|-------|
| `src/core/save-system.ts` | Create | Save/load/export/import functions |
| `src/core/game-state.ts` | Modify | Add save-related actions |
| `src/main.ts` | Modify | Initialize save system on load |

#### Patterns to Follow
- Use `JSON.stringify/parse` for serialization
- `btoa/atob` for base64 encoding
- Set up `beforeunload` listener for exit save

#### Technical Decisions
- localStorage key: `hacker-incremental-save`
- Auto-save interval: 30 seconds
- Update `lastPlayed` on every save (for offline calc)

### Acceptance Criteria

- [ ] Game state saves to localStorage
- [ ] Game state loads on page refresh
- [ ] Auto-save triggers every 30 seconds
- [ ] Save triggers on tab blur and beforeunload
- [ ] Export produces valid base64 string
- [ ] Import restores state from base64 string
- [ ] Timestamps (lastSaved, lastPlayed) update correctly

### Testing Requirements

- [ ] Unit tests for save serialization
- [ ] Unit tests for load deserialization
- [ ] Unit tests for export/import roundtrip
- [ ] Integration test for auto-save timing

### Handoff Notes

#### For Next Task
- `loadGame()` returns saved state or null
- `saveGame()` persists current state
- `lastPlayed` timestamp available for offline calculation

#### Artifacts Produced
- `src/core/save-system.ts` - Persistence layer
- Updated `src/main.ts` with save system initialization

---

## Task 05: PixiJS Renderer Setup and HUD

**Feature:** hacker-incremental-game
**Agent:** frontend-implementation
**Status:** Not Started
**Blocked By:** 03

### Objective

Initialize the PixiJS application with the terminal aesthetic and create the resource display HUD.

### Context

PixiJS replaces rot.js to support ASCII-inspired visuals WITH graphical elements (glow effects, particles). The HUD displays current resources and auto-generation rates.

#### Relevant FRD Sections
- Technical Approach > Frontend Implementation > PixiJS Rendering Setup
- UI > hud.ts
- Visual Style notes throughout FRD

### Scope

#### In Scope
- Initialize PixiJS Application
- Configure dark background and terminal aesthetic
- Create terminal-style TextStyle (green text, glow effect)
- Build HUD container showing resources
- Display auto-generation rate per resource
- Mount canvas to DOM

#### Out of Scope
- Apartment scene (task-06)
- Upgrade panel (task-09)
- Minigame rendering (task-07)

### Implementation Notes

#### Key Files
| File | Action | Notes |
|------|--------|-------|
| `src/ui/renderer.ts` | Create | PixiJS Application setup |
| `src/ui/hud.ts` | Create | Resource display component |
| `src/ui/styles.ts` | Create | Shared TextStyles |
| `src/main.ts` | Modify | Initialize renderer |
| `src/assets/fonts/` | Create | Add monospace font (or use web font) |

#### Patterns to Follow
- Use PixiJS 8.x async initialization (`await app.init()`)
- Create reusable TextStyle objects
- Use Container hierarchy for scene management

#### Technical Decisions
- Resolution: 800x600 (can be responsive later)
- Font: IBM Plex Mono or fallback to Consolas
- Primary color: #00ff00 (terminal green)
- Background: #0a0a0a (near black)

### Acceptance Criteria

- [ ] PixiJS canvas renders in browser
- [ ] Dark background with terminal aesthetic
- [ ] HUD displays Money resource with proper formatting
- [ ] HUD displays auto-generation rate (0/sec initially)
- [ ] Text has glow effect (drop shadow)
- [ ] Canvas is properly sized and centered

### Testing Requirements

- [ ] Visual verification of rendering
- [ ] HUD updates when resources change
- [ ] No console errors on initialization

### Handoff Notes

#### For Next Task
- `getApp()` returns PixiJS Application instance
- `getStage()` returns root container
- TextStyles available for consistent look
- HUD can be updated via exposed functions

#### Artifacts Produced
- `src/ui/renderer.ts` - PixiJS setup
- `src/ui/hud.ts` - Resource display
- `src/ui/styles.ts` - Shared styles
- Updated `src/main.ts`

---

## Task 06: Apartment Overworld and Player Movement

**Feature:** hacker-incremental-game
**Agent:** frontend-implementation
**Status:** Not Started
**Blocked By:** 05

### Objective

Create the apartment overworld scene with player character movement and interactive stations.

### Context

The apartment is the hub where players navigate between different activities. MVP includes one functional station (computer desk) with others as visual placeholders.

#### Relevant FRD Sections
- Proposed Solution > Key Components > Apartment Overworld
- Technical Approach > Frontend Implementation > Apartment Overworld
- Architecture > overworld/

### Scope

#### In Scope
- Apartment scene container
- Player character (ASCII `@` or simple sprite)
- Keyboard input (arrow keys / A,D for movement)
- Collision with scene boundaries
- Computer desk station (interactive)
- Visual placeholder stations (couch, bed)
- Interaction prompt when near station
- Station interaction (Enter/Space to activate)

#### Out of Scope
- Actual minigame launch (task-07 provides the minigame)
- Couch/bed functionality (post-MVP)
- CRT vignette effect (polish, optional)

### Implementation Notes

#### Key Files
| File | Action | Notes |
|------|--------|-------|
| `src/overworld/apartment.ts` | Create | Scene container and layout |
| `src/overworld/player.ts` | Create | Character sprite and movement |
| `src/overworld/stations.ts` | Create | Station definitions and interaction |
| `src/main.ts` | Modify | Add keyboard listeners, scene switching |

#### Patterns to Follow
- Use PixiJS Container for scene hierarchy
- DOM event listeners for keyboard input
- Station interaction zone detection (proximity check)

#### Technical Decisions
- Player rendered as Text('@') for ASCII feel
- Movement: simple left/right, fixed Y position
- Interaction range: ~50 pixels from station center

### Acceptance Criteria

- [ ] Apartment scene renders with visible boundaries
- [ ] Player character visible and controllable
- [ ] Arrow keys / A,D move player left/right
- [ ] Player cannot move outside scene bounds
- [ ] Computer station visible with label
- [ ] Interaction prompt appears when near station
- [ ] Enter/Space near station triggers callback
- [ ] Placeholder stations (couch, bed) visible but non-functional

### Testing Requirements

- [ ] Manual test of movement controls
- [ ] Manual test of station interaction
- [ ] Verify player stops at boundaries

### Handoff Notes

#### For Next Task
- Station interaction emits event/callback for minigame launch
- Scene can be shown/hidden for minigame transitions
- Player position persists during minigame

#### Artifacts Produced
- `src/overworld/apartment.ts`
- `src/overworld/player.ts`
- `src/overworld/stations.ts`

---

## Task 07: Code Breaker Minigame

**Feature:** hacker-incremental-game
**Agent:** frontend-implementation
**Status:** Not Started
**Blocked By:** 03, 05

### Objective

Implement the Code Breaker minigame - a sequence matching game that generates Money based on performance.

### Context

This is the core active gameplay loop. Players match number sequences under time pressure, building combos for higher scores. Top 5 scores contribute to idle generation.

#### Relevant FRD Sections
- Proposed Solution > Key Components > Minigame System
- Technical Approach > Core Systems > Minigame Framework
- Appendix > Minigame Design Sketches > Code Breaker Concept

### Scope

#### In Scope
- Base minigame interface/class
- Code Breaker game logic
- Sequence generation and display
- Player input handling (number keys)
- Combo system (faster matches = higher multiplier)
- Timer countdown
- Score calculation
- End game screen with results
- Top 5 score tracking
- Resource award based on score
- ASCII-inspired visuals with glow effects

#### Out of Scope
- Additional minigames (post-MVP)
- Minigame upgrades UI (task-09)
- Idle generation from scores (task-08)

### Implementation Notes

#### Key Files
| File | Action | Notes |
|------|--------|-------|
| `src/minigames/base-minigame.ts` | Create | Abstract interface |
| `src/minigames/code-breaker/index.ts` | Create | Minigame entry point |
| `src/minigames/code-breaker/game-logic.ts` | Create | Core game mechanics |
| `src/minigames/code-breaker/renderer.ts` | Create | PixiJS visuals |
| `src/core/game-state.ts` | Modify | Add minigame state tracking |

#### Patterns to Follow
- Separate game logic from rendering
- Use state machine for game phases (ready, playing, ended)
- Store scores as Decimal strings

#### Technical Decisions
- Sequence length: 5 digits (can increase with upgrades post-MVP)
- Base time limit: 60 seconds
- Combo multiplier: 1x base, +0.5x per consecutive correct
- Score = sum of (base points * combo multiplier)

### Acceptance Criteria

- [ ] Minigame launches from station interaction
- [ ] Target sequence displays clearly
- [ ] Number key input captured correctly
- [ ] Correct inputs advance sequence
- [ ] Combo counter increases on consecutive correct matches
- [ ] Timer counts down from 60 seconds
- [ ] Game ends when timer expires
- [ ] Final score calculated and displayed
- [ ] Score saved to top 5 if qualifying
- [ ] Money awarded based on score
- [ ] Player can return to apartment after game
- [ ] Visual style matches terminal aesthetic

### Testing Requirements

- [ ] Unit tests for score calculation
- [ ] Unit tests for combo multiplier
- [ ] Unit tests for top 5 score tracking
- [ ] Manual playtest of full game loop

### Handoff Notes

#### For Next Task
- `getTopScores(minigameId)` returns top 5 scores
- Minigame emits completion event with final score
- Scores stored in Zustand state

#### Artifacts Produced
- `src/minigames/base-minigame.ts`
- `src/minigames/code-breaker/` directory with all files
- Updated game state for minigame tracking

---

## Task 08: Tick Engine and Idle Progression

**Feature:** hacker-incremental-game
**Agent:** frontend-implementation
**Status:** Not Started
**Blocked By:** 03, 07

### Objective

Implement the game loop tick engine that calculates and awards auto-generated resources based on top minigame scores.

### Context

This is the "idle" part of the incremental game. Top 5 scores from minigames contribute to a per-second generation rate. The tick engine uses requestAnimationFrame with delta time.

#### Relevant FRD Sections
- Proposed Solution > Key Components > Idle Progression
- Technical Approach > Core Systems > Idle Progression System
- Architecture > core/tick-engine.ts

### Scope

#### In Scope
- Tick engine using requestAnimationFrame
- Delta time calculation for frame-independent updates
- Auto-generation rate calculation from top 5 scores
- Fractional resource accumulation
- Rate display in HUD
- Pause/resume functionality

#### Out of Scope
- Offline progression (task-10)
- Multiplier upgrades (task-09 adds these)

### Implementation Notes

#### Key Files
| File | Action | Notes |
|------|--------|-------|
| `src/core/tick-engine.ts` | Create | Game loop with delta time |
| `src/core/auto-generation.ts` | Create | Rate calculation from scores |
| `src/ui/hud.ts` | Modify | Display generation rate |
| `src/main.ts` | Modify | Start tick engine |

#### Patterns to Follow
- Use requestAnimationFrame for smooth updates
- Calculate delta time between frames
- Accumulate fractional resources before adding to total
- Cap frame delta to prevent huge jumps on tab focus

#### Technical Decisions
- Base rate: sum of top 5 scores / 100 per second (tunable)
- Update rate: every frame (60fps)
- Delta cap: 1 second max (to prevent burst on tab return)
- Pause stops tick engine entirely

### Acceptance Criteria

- [ ] Tick engine runs continuously while game active
- [ ] Resources increment automatically based on scores
- [ ] Generation rate displays in HUD (X/sec)
- [ ] Rate increases as higher scores are achieved
- [ ] Game can be paused (tick engine stops)
- [ ] Game can be resumed (tick engine restarts)
- [ ] No resource jumps on tab focus/blur
- [ ] Fractional resources accumulate correctly

### Testing Requirements

- [ ] Unit tests for rate calculation
- [ ] Unit tests for delta time capping
- [ ] Manual verification of smooth resource growth
- [ ] Test pause/resume functionality

### Handoff Notes

#### For Next Task
- `getAutoGenerationRate()` returns current rate per second
- Rate is used by offline progression calculation
- Tick engine can be paused/resumed externally

#### Artifacts Produced
- `src/core/tick-engine.ts`
- `src/core/auto-generation.ts`
- Updated HUD with rate display

---

## Task 09: Upgrade System

**Feature:** hacker-incremental-game
**Agent:** frontend-implementation
**Status:** Not Started
**Blocked By:** 03, 05

### Objective

Implement the upgrade system with purchasable upgrades that improve minigame performance and resource generation.

### Context

Upgrades provide the "spend resources to earn more resources" loop. MVP includes 3-5 upgrades with exponential cost scaling.

#### Relevant FRD Sections
- Proposed Solution > Key Components > Upgrade System
- Technical Approach > Core Systems > Upgrade System
- Acceptance Criteria (3 upgrades minimum)

### Scope

#### In Scope
- Upgrade data structure and definitions
- 3-5 MVP upgrades with effects
- Exponential cost scaling formula
- Upgrade purchase logic
- Upgrade panel UI
- Apply upgrade effects to relevant systems

#### Out of Scope
- Apartment upgrades (post-MVP)
- Offline efficiency upgrades (post-MVP)
- Prestige/reset mechanics (post-MVP)

### Implementation Notes

#### Key Files
| File | Action | Notes |
|------|--------|-------|
| `src/core/upgrades.ts` | Create | Upgrade definitions and logic |
| `src/ui/upgrade-panel.ts` | Create | Upgrade purchasing UI |
| `src/core/game-state.ts` | Modify | Track purchased upgrades |
| `src/core/auto-generation.ts` | Modify | Apply multiplier upgrades |

#### Patterns to Follow
- Define upgrades as data objects, not classes
- Calculate cost dynamically based on level
- Apply effects via multipliers in relevant systems

#### MVP Upgrade Ideas
1. **Better Algorithms** - Increase base score in Code Breaker (+10% per level)
2. **Faster Processor** - Increase auto-generation rate (+5% per level)
3. **Memory Upgrade** - Increase combo multiplier cap (+0.1x per level)
4. **Network Optimization** - Flat bonus to Money earned per game
5. **Overclock** - Increase time limit in minigames (+5 sec per level)

#### Technical Decisions
- Cost formula: `baseCost * (growthRate ^ level)` where growthRate ~1.15
- Effects are multiplicative where sensible
- Upgrade levels stored in Zustand state

### Acceptance Criteria

- [ ] At least 3 upgrades defined and purchasable
- [ ] Upgrade costs scale exponentially
- [ ] Upgrades deduct correct resource amount
- [ ] Cannot purchase if insufficient resources
- [ ] Upgrade effects apply correctly
- [ ] Upgrade panel displays available upgrades
- [ ] Current level and next cost visible
- [ ] Affordable upgrades visually distinct

### Testing Requirements

- [ ] Unit tests for cost calculation
- [ ] Unit tests for effect application
- [ ] Manual test of purchase flow
- [ ] Verify effects impact gameplay

### Handoff Notes

#### For Next Task
- Upgrades affect auto-generation rate via multipliers
- Upgrade state persists via save system
- Effects are applied automatically when loading saved game

#### Artifacts Produced
- `src/core/upgrades.ts`
- `src/ui/upgrade-panel.ts`
- Updated game state and auto-generation

---

## Task 10: Offline Progression and Welcome-Back Modal

**Feature:** hacker-incremental-game
**Agent:** frontend-implementation
**Status:** Not Started
**Blocked By:** 04, 08

### Objective

Implement offline progression that calculates and awards resources earned while the player was away, with a welcome-back modal displaying earnings.

### Context

Offline progression is essential for incremental games. It uses the auto-generation rate at 50% efficiency, capped at 8 hours maximum offline time.

#### Relevant FRD Sections
- Proposed Solution > Key Components > Offline Progression
- Technical Approach > Core Systems > Offline Progression System
- Appendix > Offline Progression Design Notes

### Scope

#### In Scope
- Calculate elapsed time since lastPlayed
- Cap offline time at 8 hours
- Apply 50% efficiency multiplier
- Calculate offline earnings for Money
- Welcome-back modal UI
- Display time away and earnings
- Award resources on modal dismiss
- Skip modal for <1 minute absences
- Handle first-time players (no lastPlayed)

#### Out of Scope
- Offline efficiency upgrades (post-MVP)
- Server-side time validation (post-MVP)
- Technique/Renown offline earnings (Money only for MVP)

### Implementation Notes

#### Key Files
| File | Action | Notes |
|------|--------|-------|
| `src/core/offline-progress.ts` | Create | Offline calculation logic |
| `src/ui/offline-modal.ts` | Create | Welcome-back UI |
| `src/main.ts` | Modify | Check offline on load |
| `src/core/save-system.ts` | Modify | Ensure lastPlayed updates |

#### Patterns to Follow
- Calculate immediately on page load, before game starts
- Show modal as overlay on PixiJS canvas
- Format time away as "Xh Ym" for readability

#### Technical Decisions
- Max offline hours: 8
- Efficiency: 50% (0.5 multiplier)
- Skip modal threshold: 60 seconds
- Use same number formatting as HUD

### Acceptance Criteria

- [ ] Offline time calculated correctly from lastPlayed
- [ ] Time capped at 8 hours maximum
- [ ] Earnings = rate * time * 0.5 efficiency
- [ ] Modal displays time away (formatted)
- [ ] Modal displays Money earned (formatted)
- [ ] Modal shows "time capped" indicator if exceeded 8 hours
- [ ] Resources awarded when modal dismissed
- [ ] Modal skipped for <1 minute absence
- [ ] No modal on first play (no lastPlayed)
- [ ] Game resumes normally after modal

### Testing Requirements

- [ ] Unit tests for time calculation
- [ ] Unit tests for earnings calculation
- [ ] Unit tests for time capping
- [ ] Manual test with various offline durations (mock timestamps)

### Handoff Notes

#### For Next Task
This is the final MVP task. After completion:
- Full game loop is playable
- All MVP acceptance criteria from FRD should be met
- Ready for polish, testing, and release

#### Artifacts Produced
- `src/core/offline-progress.ts`
- `src/ui/offline-modal.ts`
- Updated main.ts with offline check

---

## Implementation Order Summary

1. **Task 01** - Project setup (foundation)
2. **Task 02** - State management (data layer)
3. **Task 03** - Resources (game economy) | **Task 04** - Save system (persistence) [parallel]
4. **Task 05** - PixiJS/HUD (rendering foundation)
5. **Task 06** - Overworld (navigation) | **Task 07** - Minigame (core gameplay) | **Task 09** - Upgrades (progression) [parallel after 05]
6. **Task 08** - Tick engine (idle mechanics, needs minigame scores)
7. **Task 10** - Offline progression (needs tick engine rate)

---

## Next Agent to Invoke

**Agent:** `frontend-implementation`

**Context to provide:**
- Feature slug: `hacker-incremental-game`
- Task: `task-01` (Project scaffolding and dependencies)
- Task location: `/Users/stephen/Projects/hacking-game/.claude_docs/features/hacker-incremental-game/tasks.md` (see Task 01 section)
- Dependencies: None - this is the first task

**After that agent completes:**
The agent should recommend task-02 (Core state management) as the next task, since it's the only task that depends solely on task-01.
