# Task Breakdown: Multiple Save Slots

**FRD:** `/Users/stephen/Projects/hacking-game/.claude_docs/features/save-slots/frd.md`
**Refinement:** `/Users/stephen/Projects/hacking-game/.claude_docs/features/save-slots/refinement.md`
**Created:** 2026-01-19
**Status:** Not Started

---

## Summary

Expand the save system from a single save slot to support 3 independent save slots, with player name input for identification and a slot selection UI for managing multiple saves.

**Total Tasks:** 5
**Estimated Complexity:** Medium (aggregate)

---

## Task Overview

| # | Task | Status | Blocked By | Est. Size |
|---|------|--------|------------|-----------|
| 01 | Type definitions and utility functions | Not Started | - | Small |
| 02 | Save system slot architecture | Not Started | 01 | Medium |
| 03 | Name input dialog component | Not Started | 01 | Medium |
| 04 | Save slot selection UI | Not Started | 02 | Medium |
| 05 | Main menu flow integration | Not Started | 02, 03, 04 | Small |

---

## Dependency Graph

```
task-01 (Types & Utilities)
    |
    +---> task-02 (Save System) ---+
    |                              |
    +---> task-03 (Name Input) ----+---> task-05 (Menu Integration)
                                   |
          task-04 (Slot Selection) +
               ^
               |
               +--- depends on task-02 for listSaveSlots()
```

---

## Critical Path

1. task-01 -> task-02 -> task-04 -> task-05 (longest path)

---

## Parallel Opportunities

- task-02 (Save System) and task-03 (Name Input) can run in parallel after task-01
- task-04 depends on task-02 being complete (needs listSaveSlots)

---

## Progress Log

| Date | Task | Update |
|------|------|--------|
| 2026-01-19 | - | Breakdown created |

---

# Task 01: Type Definitions and Utility Functions

**Status:** Not Started
**Blocked By:** None
**Estimated Size:** Small (hours)

## Objective

Add the foundational type definitions and utility functions needed by subsequent tasks.

## Context

The FRD requires a new `playerName` field on `GameState` and a new `SaveSlotMetadata` type. The refinement notes identify a need for `formatRelativeTime()` utility function for displaying "2 hours ago" style timestamps.

### Relevant FRD Sections
- Technical Approach > types.ts Changes
- Data Model > SaveSlotMetadata

### Relevant Refinement Notes
- Add `formatRelativeTime()` function to offline-progress.ts
- Use existing `formatDuration()` pattern for playtime display

## Scope

### In Scope
- Add `playerName: string` to `GameState` interface
- Add `playerName: ''` to `DEFAULT_GAME_STATE`
- Export `SaveSlotMetadata` interface from types.ts
- Update `SAVE_VERSION` to `'1.1.0'`
- Add `formatRelativeTime()` function to offline-progress.ts
- Update `isValidGameState()` in save-system.ts to handle optional playerName field

### Out of Scope
- Save slot key management (task-02)
- UI components (tasks 03-05)

## Implementation Notes

### Key Files
| File | Action | Notes |
|------|--------|-------|
| `/Users/stephen/Projects/hacking-game/src/core/types.ts` | Modify | Add playerName, SaveSlotMetadata, update version |
| `/Users/stephen/Projects/hacking-game/src/core/offline-progress.ts` | Modify | Add formatRelativeTime() |
| `/Users/stephen/Projects/hacking-game/src/core/save-system.ts` | Modify | Update isValidGameState() and getSerializableState() |

### Patterns to Follow
- Follow existing `formatDuration()` pattern at `/Users/stephen/Projects/hacking-game/src/core/offline-progress.ts:98-114`
- Follow existing type definition patterns in types.ts

### Technical Decisions
- `playerName` is optional in validation for backwards compatibility during migration
- `SaveSlotMetadata` is exported from types.ts to keep types centralized

## Acceptance Criteria

- [ ] `GameState` interface includes `playerName: string`
- [ ] `DEFAULT_GAME_STATE` includes `playerName: ''`
- [ ] `SaveSlotMetadata` interface exported from types.ts
- [ ] `SAVE_VERSION` is `'1.1.0'`
- [ ] `formatRelativeTime(timestamp)` returns strings like "2h ago", "3d ago", "just now"
- [ ] `isValidGameState()` accepts saves with or without playerName
- [ ] `getSerializableState()` includes playerName field
- [ ] TypeScript compiles without errors

## Testing Requirements

- [ ] Unit tests for `formatRelativeTime()` with various time deltas
- [ ] Verify isValidGameState accepts old saves (no playerName)
- [ ] Verify isValidGameState accepts new saves (with playerName)

## Handoff Notes

### For Next Task
- `SaveSlotMetadata` type is now available for use in save-system.ts
- `playerName` field can be set/read from GameState
- `formatRelativeTime()` is available for slot display UI

### Artifacts Produced
- Updated `GameState` interface with `playerName`
- `SaveSlotMetadata` type definition
- `formatRelativeTime()` utility function

---

# Task 02: Save System Slot Architecture

**Status:** Not Started
**Blocked By:** 01
**Estimated Size:** Medium (1-2 days)

## Objective

Refactor the save system to support 3 independent save slots with proper slot management, active slot tracking, and backwards compatibility.

## Context

The current save system uses a single localStorage key (`hacker-incremental-save`). This task changes to slot-indexed keys and adds all the slot management functions specified in the FRD.

### Relevant FRD Sections
- Technical Approach > save-system.ts Changes (all new/modified functions)
- Technical Approach > Migration Strategy

### Relevant Refinement Notes
- Old key is ignored, no automatic migration
- All existing patterns for save/load remain intact

## Scope

### In Scope
- Add constants: `SLOT_KEY_PREFIX`, `MAX_SLOTS`
- Add module state: `activeSlotIndex`
- Add `getSlotKey(index)` function
- Add `listSaveSlots()` function
- Add `loadSlotMetadata(index)` function
- Modify `saveGame()` to use active slot
- Modify `loadGame(slotIndex)` to accept slot index and set active
- Add `setActiveSlot(index)` function
- Add `getActiveSlot()` function
- Add `deleteSlot(index)` function
- Modify `hasSaveData()` to check any slot
- Add `getFirstOccupiedSlot()` function
- Add `getFirstEmptySlot()` function
- Update `exportSave()` and `importSave()` for slot awareness

### Out of Scope
- UI changes (tasks 03-05)
- Player name input (task 03)

## Implementation Notes

### Key Files
| File | Action | Notes |
|------|--------|-------|
| `/Users/stephen/Projects/hacking-game/src/core/save-system.ts` | Major modify | All slot management functions |

### Patterns to Follow
- Follow existing save-system.ts error handling and logging patterns
- Follow existing function documentation style

### Technical Decisions
- `activeSlotIndex` starts as `null`, must be set before saving
- `loadGame()` automatically sets active slot when loading
- Old single-slot key (`hacker-incremental-save`) is completely ignored
- `deleteSlot()` uses `localStorage.removeItem()` like existing `deleteSave()`

## Acceptance Criteria

- [ ] 3 independent localStorage keys: `hacker-incremental-slot-0`, `-1`, `-2`
- [ ] `listSaveSlots()` returns metadata for all 3 slots
- [ ] `loadSlotMetadata()` returns metadata without loading full state
- [ ] `saveGame()` saves to activeSlotIndex (returns false if no active slot)
- [ ] `loadGame(index)` loads specified slot and sets it active
- [ ] `setActiveSlot(index)` and `getActiveSlot()` work correctly
- [ ] `deleteSlot(index)` clears the specified slot
- [ ] `hasSaveData()` returns true if any slot has data
- [ ] `getFirstOccupiedSlot()` returns first non-empty slot index or null
- [ ] `getFirstEmptySlot()` returns first empty slot index or null
- [ ] Auto-save continues to work (saves to active slot)
- [ ] Tab blur and beforeunload save to active slot
- [ ] `exportSave()` exports from active slot
- [ ] `importSave()` imports to specified slot (or first empty)

## Testing Requirements

- [ ] Unit tests for all new functions
- [ ] Integration test: create save in slot 0, load slot 0, verify state
- [ ] Integration test: create saves in multiple slots, verify independence
- [ ] Integration test: delete slot, verify cleared
- [ ] Integration test: auto-save writes to active slot

## Handoff Notes

### For Next Task
- `listSaveSlots()` is available for slot selection UI
- `setActiveSlot()` must be called before game starts
- `loadGame(index)` loads and activates a slot
- `getFirstEmptySlot()` is available for new game flow

### Artifacts Produced
- Complete slot-based save system API
- All slot management functions exported

---

# Task 03: Name Input Dialog Component

**Status:** Not Started
**Blocked By:** 01
**Estimated Size:** Medium (1-2 days)

## Objective

Create a text input dialog component for entering player names when starting a new game.

## Context

The refinement notes identify that text input is a new pattern not currently used in the codebase. The blinking cursor pattern from code-breaker can be adapted. This component will be used in the main menu new game flow.

### Relevant FRD Sections
- User Experience > New Game Flow
- Frontend Changes > New Dialog: Name Input
- Implementation Notes > Name Validation Rules

### Relevant Refinement Notes
- Blinking cursor pattern at `/Users/stephen/Projects/hacking-game/src/minigames/code-breaker/code-breaker-scene.ts:472`
- No existing text input component, must build from scratch

## Scope

### In Scope
- Create `showNameInputDialog()` function in main-menu.ts
- Text display with blinking cursor
- Keyboard handling: typing, backspace, Enter, Escape
- Character limit (1-16 chars) with visual indicator
- Validation: alphanumeric + space/underscore/hyphen
- Auto-trim whitespace
- Error feedback for invalid input
- Mouse click on confirm/cancel buttons

### Out of Scope
- Slot selection UI (task 04)
- Menu flow integration (task 05)
- Save system changes (task 02)

## Implementation Notes

### Key Files
| File | Action | Notes |
|------|--------|-------|
| `/Users/stephen/Projects/hacking-game/src/ui/scenes/main-menu.ts` | Modify | Add showNameInputDialog() and related functions |

### Patterns to Follow
- Existing dialog pattern: `showConfirmDialog()` at `/Users/stephen/Projects/hacking-game/src/ui/scenes/main-menu.ts:298-399`
- Blinking cursor: code-breaker-scene.ts line 472
- Dialog box styling: `createDialogBox()` function

### Technical Decisions
- Use interval-based cursor blink (toggle every 500ms)
- Validate on each keystroke for real-time feedback
- Store input in module-level state like dialog buttons
- Use callback pattern like showConfirmDialog for result handling

## Acceptance Criteria

- [ ] Dialog displays with title "ENTER YOUR HACKER ALIAS"
- [ ] Text input field shows entered text with blinking cursor
- [ ] Keyboard typing adds characters (up to 16)
- [ ] Backspace removes characters
- [ ] Character count displayed: "3/16"
- [ ] Only allowed characters accepted (a-z, A-Z, 0-9, space, _, -)
- [ ] Enter submits if valid (1-16 chars after trim)
- [ ] Escape cancels dialog
- [ ] Error shown if trying to submit with empty/too-short name
- [ ] Confirm/Cancel buttons work with mouse click
- [ ] Focus management: dialog captures keyboard input

## Testing Requirements

- [ ] Manual test: type various valid names
- [ ] Manual test: try invalid characters (symbols, etc.)
- [ ] Manual test: verify character limit enforced
- [ ] Manual test: verify Enter/Escape keyboard shortcuts
- [ ] Manual test: verify mouse click on buttons

## Handoff Notes

### For Next Task
- `showNameInputDialog(onConfirm, onCancel)` is available
- `onConfirm` receives the validated, trimmed player name
- Dialog manages its own state and cleanup

### Artifacts Produced
- `showNameInputDialog()` function in main-menu.ts
- Name validation helper function

---

# Task 04: Save Slot Selection UI

**Status:** Not Started
**Blocked By:** 02
**Estimated Size:** Medium (1-2 days)

## Objective

Create a slot selection UI that displays all 3 save slots with their metadata, allowing keyboard and mouse selection.

## Context

The FRD specifies a terminal-style UI showing slot boxes with player name, last played time, and playtime. The refinement notes confirm existing keyboard navigation patterns can be extended.

### Relevant FRD Sections
- Frontend Changes > New UI: Save Slot Selection
- Frontend Changes > Slot Display Format Example
- User Experience > Continue/Load Flow
- User Experience > Delete Flow

### Relevant Refinement Notes
- Use `formatRelativeTime()` from task 01 for last played
- Use `formatDuration()` for playtime (convert ms to seconds)
- `listSaveSlots()` from task 02 provides slot metadata

## Scope

### In Scope
- Create `showSlotSelectionDialog()` function in main-menu.ts
- Display 3 slot cards in terminal style
- Show for each slot: slot number, player name or "[EMPTY]", last played, playtime
- Keyboard navigation: up/down arrows, Enter to select, Escape to cancel
- Mouse click support for slot selection
- Visual highlight for selected slot
- Support filtering to only occupied slots (for delete flow)
- Back/Cancel button

### Out of Scope
- Name input dialog (task 03)
- Menu flow integration (task 05)
- Save system changes (already in task 02)

## Implementation Notes

### Key Files
| File | Action | Notes |
|------|--------|-------|
| `/Users/stephen/Projects/hacking-game/src/ui/scenes/main-menu.ts` | Modify | Add showSlotSelectionDialog() and slot card rendering |

### Patterns to Follow
- Existing menu keyboard navigation pattern at `/Users/stephen/Projects/hacking-game/src/ui/scenes/main-menu.ts:613-702`
- Dialog styling patterns from existing dialogs
- Terminal box styling using Graphics

### Technical Decisions
- Slot cards rendered using PixiJS Graphics + Text
- Selected slot has bright border, unselected has dim border
- Empty slots still shown (can't select for Continue, can skip for Delete)
- Use callback pattern: `onSelect(slotIndex)` and `onCancel()`

## Acceptance Criteria

- [ ] Displays 3 slot cards vertically
- [ ] Each occupied slot shows: "SLOT N", player name, "LAST PLAYED: Xh ago", "PLAYTIME: Xh Xm"
- [ ] Empty slots show: "SLOT N", "[ EMPTY ]"
- [ ] Arrow up/down navigates between slots
- [ ] Enter selects highlighted slot (if allowed)
- [ ] Escape closes dialog without selection
- [ ] Mouse click on slot selects it
- [ ] Visual highlight (bright border, bright text) for selected slot
- [ ] Can filter to only occupied slots (for delete flow)
- [ ] Cannot select empty slots when loading/continuing

## Testing Requirements

- [ ] Manual test: navigate with keyboard
- [ ] Manual test: click slots with mouse
- [ ] Manual test: verify correct metadata displayed
- [ ] Manual test: verify empty slots displayed correctly
- [ ] Manual test: verify cannot select empty slot for continue

## Handoff Notes

### For Next Task
- `showSlotSelectionDialog(options, onSelect, onCancel)` is available
- `options` includes `filterOccupied: boolean` for delete flow
- `onSelect` receives the selected slot index

### Artifacts Produced
- `showSlotSelectionDialog()` function
- Slot card rendering functions
- Integration with `listSaveSlots()` from save-system

---

# Task 05: Main Menu Flow Integration

**Status:** Not Started
**Blocked By:** 02, 03, 04
**Estimated Size:** Small (hours)

## Objective

Wire up the complete user flows for New Game, Continue, and Delete Save using the components built in previous tasks.

## Context

All the pieces are now in place. This task integrates them into the main menu flow as specified in the FRD User Experience section.

### Relevant FRD Sections
- User Experience > New Game Flow
- User Experience > Continue/Load Flow
- User Experience > Delete Flow
- Implementation Notes > When All Slots Are Full

### Relevant Refinement Notes
- Existing menu item handlers need modification
- hardReset() call moves to after name input

## Scope

### In Scope
- Modify `handleNewGame()` to:
  - Check for empty slots via `getFirstEmptySlot()`
  - If empty exists: show name input dialog, then create save in that slot
  - If all full: show "ALL SAVE SLOTS FULL" message
- Modify `handleContinue()` to:
  - Check slot count via `listSaveSlots()`
  - If single save: load directly (existing behavior)
  - If multiple saves: show slot selection dialog
- Modify `handleDeleteSave()` to:
  - Show slot selection (occupied only)
  - Confirm deletion
  - Delete selected slot
  - Rebuild menu
- Update `buildMenuItems()` to use new `hasSaveData()` logic
- Add `setPlayerName` action to game-state.ts if needed

### Out of Scope
- Save system functions (task 02)
- Dialog components (tasks 03, 04)
- In-game menu changes (minimal, auto-works with active slot)

## Implementation Notes

### Key Files
| File | Action | Notes |
|------|--------|-------|
| `/Users/stephen/Projects/hacking-game/src/ui/scenes/main-menu.ts` | Modify | Update menu action handlers |
| `/Users/stephen/Projects/hacking-game/src/core/game-state.ts` | Minor modify | Add setPlayerName if needed |

### Patterns to Follow
- Existing handler patterns in main-menu.ts
- Async/await for dialog flows

### Technical Decisions
- New Game: hardReset() after name input, set player name, setActiveSlot, saveGame
- Continue single-save shortcut: skip slot selection if only one occupied slot
- Delete confirmation uses existing showConfirmDialog

## Acceptance Criteria

- [ ] New Game with empty slot available: name input -> game starts with name set
- [ ] New Game with all slots full: shows "ALL SAVE SLOTS FULL" message
- [ ] Continue with one save: loads directly (no slot selection)
- [ ] Continue with multiple saves: shows slot selection, loads selected
- [ ] Delete Save: shows slot selection (occupied only) -> confirm -> deletes
- [ ] Menu rebuilds correctly after deletion
- [ ] Player name persists in save and is loaded correctly
- [ ] Active slot is set correctly for all flows

## Testing Requirements

- [ ] Full flow test: fresh start -> new game -> enter name -> play -> save
- [ ] Full flow test: multiple saves -> continue -> select slot -> verify correct save
- [ ] Full flow test: delete one save -> verify deleted -> verify can create new
- [ ] Full flow test: fill all slots -> new game -> see full message
- [ ] Full flow test: return to menu -> continue -> verify correct active slot maintained

## Handoff Notes

### For Next Task
This is the final task. After completion:
- All acceptance criteria from FRD should be met
- Feature is ready for testing and review

### Artifacts Produced
- Fully integrated save slot system
- Complete user flows for New Game, Continue, Delete Save

---

## Next Agent to Invoke

**Agent:** `frontend-implementation`

**Context to provide:**
- Feature slug: `save-slots`
- Task: `task-01-types-and-utilities` (the first unblocked task)
- Task location: `/Users/stephen/Projects/hacking-game/.claude_docs/features/save-slots/tasks.md` (Task 01 section)
- Dependencies: None - this is the first task

**After that agent completes:**
The agent should recommend task-02 (Save System) or task-03 (Name Input) next, as both become unblocked. Task-02 is on the critical path, so it should likely be prioritized. However, task-02 and task-03 can run in parallel if desired.
