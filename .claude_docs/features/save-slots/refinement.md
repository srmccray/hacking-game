# Refinement Notes: Multiple Save Slots

**Refined:** 2026-01-19
**FRD Location:** `/Users/stephen/Projects/hacking-game/.claude_docs/features/save-slots/frd.md`

## Codebase Alignment

### Verified Assumptions

- **Save system uses single localStorage key** - confirmed at `/Users/stephen/Projects/hacking-game/src/core/save-system.ts:29` (`SAVE_KEY = 'hacker-incremental-save'`)
- **Current SAVE_VERSION is 1.0.0** - confirmed at `/Users/stephen/Projects/hacking-game/src/core/types.ts:248`
- **GameState interface can be extended** - confirmed at `/Users/stephen/Projects/hacking-game/src/core/types.ts:106-119`
- **isValidGameState() exists for validation** - confirmed at `/Users/stephen/Projects/hacking-game/src/core/save-system.ts:113-153`
- **Zustand store has loadState action** - confirmed at `/Users/stephen/Projects/hacking-game/src/core/game-state.ts:335-341`
- **Dialog system exists in main-menu.ts** - confirmed: `showConfirmDialog()` at line 298, `showMessageDialog()` at line 242
- **Main menu has keyboard navigation** - confirmed at `/Users/stephen/Projects/hacking-game/src/ui/scenes/main-menu.ts:613-702`
- **In-game menu calls saveGame()** - confirmed at `/Users/stephen/Projects/hacking-game/src/ui/in-game-menu.ts:145`
- **formatDuration utility exists** - confirmed at `/Users/stephen/Projects/hacking-game/src/core/offline-progress.ts:98-114` (can be reused for playtime display)

### Corrections Needed

- **FRD says "lastPlayed (relative time)"** - The FRD specifies showing "2 hours ago", "3 days ago", but there is no `formatRelativeTime()` utility. Implementation will need to add this or use the existing `formatDuration()` with a calculation.

- **FRD says "Delete Save" on main menu** - Currently, the menu item is already named "Delete Save" at line 114-118, which deletes the single save. This behavior will need to change to show slot selection first.

## Key Files

### Will Modify

- `/Users/stephen/Projects/hacking-game/src/core/save-system.ts` - Core save/load logic:
  - Add slot constants (`SLOT_KEY_PREFIX`, `MAX_SLOTS`)
  - Add module state (`activeSlotIndex`)
  - Add `SaveSlotMetadata` type
  - Modify `saveGame()` to use active slot
  - Modify `loadGame()` to accept slot index
  - Add `listSaveSlots()`, `loadSlotMetadata()`, `setActiveSlot()`, `getActiveSlot()`, `deleteSlot()`, `getFirstOccupiedSlot()`, `getFirstEmptySlot()`
  - Modify `hasSaveData()` to check any slot
  - Modify `exportSave()`/`importSave()` for slot awareness

- `/Users/stephen/Projects/hacking-game/src/core/types.ts` - Type definitions:
  - Add `playerName: string` to `GameState` interface
  - Update `DEFAULT_GAME_STATE` with `playerName: ''`
  - Update `SAVE_VERSION` to `'1.1.0'`

- `/Users/stephen/Projects/hacking-game/src/core/game-state.ts` - Store updates:
  - Add `playerName` to initial state (comes from types.ts automatically)
  - Add `setPlayerName` action if needed for name input flow

- `/Users/stephen/Projects/hacking-game/src/ui/scenes/main-menu.ts` - Main menu UI:
  - Add name input dialog with blinking cursor effect
  - Add save slot selection UI
  - Modify "New Game" flow to check for empty slots, prompt for name
  - Modify "Continue" flow to show slot selection if multiple saves
  - Modify "Delete Save" flow to show slot selection first

- `/Users/stephen/Projects/hacking-game/src/ui/in-game-menu.ts` - In-game menu:
  - Minor change: save feedback could optionally show slot number
  - No functional changes needed (saveGame() auto-saves to active slot)

### Will Create

- None required - all changes fit into existing files

### Reference (read-only)

- `/Users/stephen/Projects/hacking-game/src/core/offline-progress.ts` - `formatDuration()` pattern to follow at line 98
- `/Users/stephen/Projects/hacking-game/src/minigames/code-breaker/code-breaker-scene.ts` - Blinking cursor pattern at line 472
- `/Users/stephen/Projects/hacking-game/src/ui/in-game-menu.ts` - Confirm dialog pattern at lines 256-360
- `/Users/stephen/Projects/hacking-game/src/ui/styles.ts` - Terminal styling patterns

## Blockers / Concerns

### No Blocking Issues Identified

### Minor Concerns

1. **Text input not currently used** - The codebase has no existing text input component. The name input dialog will need to be built from scratch using PixiJS Text with manual keyboard handling. This is doable but adds complexity.

2. **Relative time formatting** - Need to implement `formatRelativeTime()` for "2 hours ago" style strings. Can be added to `offline-progress.ts` or as a new utility.

3. **getSerializableState() needs update** - The function at `/Users/stephen/Projects/hacking-game/src/core/save-system.ts:52-74` extracts serializable state but doesn't include `playerName`. Will need to be updated to include it.

## Implementation Suggestions

### Name Input Dialog Implementation

The code-breaker minigame has a blinking cursor pattern that can be adapted:
```typescript
// From code-breaker-scene.ts line 472
// Current position - blinking cursor
textEl.text = '_';
textEl.style.fill = colorToHex(TERMINAL_GREEN);
```

For the name input, create a text field that:
1. Displays entered text + blinking underscore cursor
2. Handles keydown events for typing, backspace, Enter
3. Validates input (1-16 chars, allowed characters)
4. Shows character count feedback

### Relative Time Formatting

Add to `offline-progress.ts`:
```typescript
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const seconds = Math.floor((now - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
```

### Playtime Formatting

Reuse existing `formatDuration()` from `offline-progress.ts`. For display, convert `totalPlayTime` (ms) to seconds: `formatDuration(totalPlayTime / 1000)`.

## Ready for Implementation

- [x] FRD assumptions validated
- [x] No major blockers identified
- [x] Key files identified and confirmed
- [x] Existing patterns documented for reuse
- [ ] Minor utility functions needed (formatRelativeTime)

---

## Next Agent to Invoke

**Agent:** `frd-task-breakdown`

**Context to provide:**
- Feature slug: `save-slots`
- Tier: MEDIUM
- Refinement summary: All FRD assumptions validated. Core save-system.ts and main-menu.ts are main modification targets. No blocking issues. Need to implement text input dialog (new pattern) and relative time formatting (minor addition).
- Key files:
  - `/Users/stephen/Projects/hacking-game/src/core/save-system.ts` (primary)
  - `/Users/stephen/Projects/hacking-game/src/core/types.ts`
  - `/Users/stephen/Projects/hacking-game/src/ui/scenes/main-menu.ts` (primary)
  - `/Users/stephen/Projects/hacking-game/src/core/game-state.ts`
  - `/Users/stephen/Projects/hacking-game/src/ui/in-game-menu.ts` (minor)

**After that agent completes:**
The Task Breakdown agent will decompose this feature into discrete implementation tasks, ordered by dependency. Each task will be sized appropriately for incremental implementation.
