# FRD: Multiple Save Slots

**Created:** 2026-01-19
**Tier:** MEDIUM
**Triage Scores:** Complexity 5/10, Risk 4/10
**Status:** Draft

## Problem Statement

Currently, the game supports only a single save slot using the localStorage key `hacker-incremental-save`. This limits players who want to:

- Maintain multiple playthroughs with different strategies
- Let multiple household members play on the same device
- Experiment with different builds without losing their main progress

Players have no way to distinguish between saves or manage multiple game states, which is a common expectation for incremental/idle games.

## Proposed Solution

### Overview

Expand the save system to support 3 save slots, each with its own localStorage key and metadata. When starting a new game, players will be prompted to enter a name (e.g., their hacker alias) to identify the save. The main menu will display save slot selection UI showing slot metadata (name, last played, playtime).

### Key Components

1. **Save Slot Architecture:** Change from single key to slot-indexed keys (`hacker-incremental-slot-0`, `hacker-incremental-slot-1`, `hacker-incremental-slot-2`)

2. **Save Slot Metadata:** Lightweight data structure for listing slots without loading full game state

3. **Player Name:** New field in GameState to identify saves and personalize the experience

4. **Active Slot Tracking:** Module-level state in save-system.ts to track which slot is currently active

5. **Name Input Dialog:** New dialog type for entering player name when starting a new game

6. **Save Slot Selection UI:** UI for selecting which slot to continue/load or delete

### User Experience

**New Game Flow:**
1. Player selects "New Game" from main menu
2. If empty slot exists, show name input dialog
3. Player enters their hacker alias (1-16 characters)
4. Game initializes with new state including playerName
5. If all slots full, show message directing player to delete a slot first

**Continue/Load Flow:**
1. Player selects "Continue" from main menu
2. Show save slot selection UI listing all occupied slots
3. Each slot displays: playerName, last played (relative time), total playtime
4. Player selects a slot to load
5. Game loads selected slot and sets it as active

**Delete Flow:**
1. From main menu, player selects "Delete Save"
2. Show save slot selection UI (only occupied slots)
3. Player selects slot to delete
4. Confirmation dialog appears
5. On confirm, slot is cleared

## Technical Approach

### Backend Changes

#### save-system.ts Changes

**New Constants:**
```typescript
const SLOT_KEY_PREFIX = 'hacker-incremental-slot-';
const MAX_SLOTS = 3;
```

**New Module State:**
```typescript
let activeSlotIndex: number | null = null;
```

**New Types:**
```typescript
interface SaveSlotMetadata {
  slotIndex: number;
  playerName: string;
  lastPlayed: number;
  totalPlayTime: number;
  version: string;
  isEmpty: boolean;
}
```

**New/Modified Functions:**
- `getSlotKey(index: number): string` - Returns localStorage key for slot
- `listSaveSlots(): SaveSlotMetadata[]` - Returns metadata for all 3 slots
- `loadSlotMetadata(index: number): SaveSlotMetadata | null` - Load metadata without full state
- `saveGame(): boolean` - Modified to save to activeSlotIndex
- `loadGame(slotIndex: number): GameState | null` - Modified to accept slot index
- `setActiveSlot(index: number): void` - Set the active slot for subsequent saves
- `getActiveSlot(): number | null` - Get current active slot
- `deleteSlot(index: number): void` - Delete a specific slot
- `hasSaveData(): boolean` - Modified to check if any slot has data
- `getFirstOccupiedSlot(): number | null` - For quick continue functionality
- `getFirstEmptySlot(): number | null` - For new game functionality

**Export/Import Changes:**
- `exportSave()` - Export from active slot
- `importSave()` - Import to a specified slot (or first empty)

#### types.ts Changes

**GameState Interface Addition:**
```typescript
export interface GameState {
  // ... existing fields ...

  /** Player's chosen name/alias for this save */
  playerName: string;
}
```

**DEFAULT_GAME_STATE Update:**
```typescript
export const DEFAULT_GAME_STATE: GameState = {
  // ... existing fields ...
  playerName: '',  // Empty until set during new game flow
};
```

**Version Bump:**
```typescript
export const SAVE_VERSION = '1.1.0';
```

#### Validation Update

**isValidGameState() Addition:**
```typescript
// playerName is optional for backwards compatibility during migration
if (obj['playerName'] !== undefined && typeof obj['playerName'] !== 'string') {
  return false;
}
```

### Frontend Changes

#### main-menu.ts Changes

**New Dialog: Name Input**
- Text input field with blinking cursor
- Character limit indicator (1-16 chars)
- Validation feedback (min length, allowed characters)
- Keyboard support: typing, backspace, Enter to confirm, Escape to cancel

**New UI: Save Slot Selection**
- List of 3 slots in terminal style
- Each slot shows:
  - Slot number indicator (SLOT 1, SLOT 2, SLOT 3)
  - Player name or "[EMPTY]"
  - Last played as relative time ("2 hours ago", "3 days ago")
  - Total playtime formatted ("12h 34m")
- Keyboard navigation (up/down arrows)
- Mouse click support
- Visual highlight for selected slot
- Back/Cancel option

**Modified Menu Items:**
- "New Game" - Check for empty slots, show name input or "all full" message
- "Continue" - If multiple saves exist, show slot selection; if one, load it directly
- "Delete Save" - Show slot selection for deletion

**Slot Display Format Example:**
```
+--[ SLOT 1 ]------------------+
|  PLAYER: ShadowHacker        |
|  LAST PLAYED: 2 hours ago    |
|  PLAYTIME: 12h 34m           |
+------------------------------+

+--[ SLOT 2 ]------------------+
|  [ EMPTY ]                   |
|                              |
|                              |
+------------------------------+

+--[ SLOT 3 ]------------------+
|  PLAYER: TestRun             |
|  LAST PLAYED: 5 days ago     |
|  PLAYTIME: 1h 02m            |
+------------------------------+
```

#### in-game-menu.ts Changes

**"Save Game" Action:**
- Modified to save to active slot (no change to user interaction)
- Feedback message could optionally show "Saved to Slot X"

### Data Model

**SaveSlotMetadata (new type):**
```typescript
interface SaveSlotMetadata {
  slotIndex: number;      // 0, 1, or 2
  playerName: string;     // From GameState
  lastPlayed: number;     // Timestamp from GameState
  totalPlayTime: number;  // From GameState.stats
  version: string;        // Save format version
  isEmpty: boolean;       // True if slot has no data
}
```

**Storage Keys:**
- `hacker-incremental-slot-0` - Full GameState JSON
- `hacker-incremental-slot-1` - Full GameState JSON
- `hacker-incremental-slot-2` - Full GameState JSON

## Implementation Notes

### Dependencies

- Existing dialog system in main-menu.ts (showConfirmDialog, showMessageDialog)
- Existing keyboard handling infrastructure
- PixiJS Text and Graphics for UI elements

### Integration Points

- `save-system.ts` - Core save/load logic modifications
- `types.ts` - GameState interface and default state
- `game-state.ts` - Zustand store (minimal changes, just needs to handle playerName field)
- `main-menu.ts` - Menu actions and new UI components
- `in-game-menu.ts` - Save action (minimal change)

### Migration Strategy

**Decision: No automatic migration of existing saves**

Rationale:
- The game is early in development with few real players
- Migration adds complexity for minimal benefit
- Clean slate approach is simpler and less error-prone
- Users can manually export/import if they want to preserve progress

Implementation:
- Old key (`hacker-incremental-save`) is ignored
- All 3 new slots start empty
- Optional: Add one-time check to detect old save and show informational message

### Name Validation Rules

**Allowed:**
- 1-16 characters
- Letters (a-z, A-Z)
- Numbers (0-9)
- Spaces (but not leading/trailing)
- Underscore (_) and hyphen (-)

**Disallowed:**
- Empty names
- Names with only whitespace
- Special characters beyond _ and -
- Leading/trailing whitespace (auto-trimmed)

**Validation Feedback:**
- Show character count: "3/16"
- Show error if too short after attempted submit
- Auto-trim on submit

### When All Slots Are Full

When player selects "New Game" but all 3 slots are occupied:
1. Show message dialog: "ALL SAVE SLOTS FULL"
2. Body text: "Delete an existing save to start a new game."
3. Single "OK" button to dismiss
4. Player can then use "Delete Save" option

### Feature Flags

Not applicable - this is a core feature change, not a toggleable feature.

## Testing Strategy

**Unit Tests:**
- `getSlotKey()` returns correct keys
- `listSaveSlots()` returns correct metadata for mixed empty/full states
- `loadSlotMetadata()` handles missing/corrupted data gracefully
- `saveGame()` saves to correct active slot
- `loadGame()` loads correct slot and sets it active
- `deleteSlot()` clears correct slot
- Name validation function accepts/rejects correctly

**Integration Tests:**
- Full new game flow: name input -> slot creation -> game start
- Full continue flow: slot selection -> load -> correct state
- Full delete flow: slot selection -> confirm -> slot cleared
- Auto-save writes to active slot
- Tab blur/beforeunload saves to active slot

**Manual Test Plan:**
1. Fresh install shows 3 empty slots
2. Create save in slot 1 with name "TestPlayer"
3. Play for a bit, verify auto-save works
4. Return to main menu, verify slot 1 shows correct metadata
5. Create second save in slot 2
6. Continue slot 1, verify correct data loaded
7. Continue slot 2, verify correct data loaded
8. Delete slot 1, verify it becomes empty
9. Try to create new game when all slots full, verify message shown
10. Export/import works correctly with slot system

## Rollback Plan

If issues arise:
1. The old `hacker-incremental-save` key is untouched, so reverting code will restore old behavior
2. New slot keys can be cleared via browser dev tools if needed
3. No database migrations to reverse

## Acceptance Criteria

- [ ] Save system supports 3 independent save slots
- [ ] Each slot has its own localStorage key (`hacker-incremental-slot-{0,1,2}`)
- [ ] New Game prompts for player name (1-16 chars, alphanumeric + spaces/underscores/hyphens)
- [ ] Player name is stored in GameState and persisted
- [ ] Main menu shows save slot selection when multiple saves exist
- [ ] Each slot displays: player name, last played (relative), total playtime
- [ ] Empty slots are clearly indicated
- [ ] Delete confirmation works per-slot
- [ ] Auto-save writes to the currently active slot
- [ ] In-game menu "Save Game" writes to active slot
- [ ] All slots full shows informative message with instruction to delete
- [ ] Keyboard navigation works for slot selection (arrows + Enter)
- [ ] Mouse/click support works for slot selection
- [ ] SAVE_VERSION updated to 1.1.0
- [ ] isValidGameState() updated to handle playerName field

## Open Questions

All open questions have been resolved with the following decisions:

- **Migration strategy:** No automatic migration; old saves ignored, clean slate for new slot system
- **Name validation rules:** 1-16 chars, alphanumeric + space/underscore/hyphen, trimmed
- **When all slots full:** Show message dialog directing user to delete a save first
- **Slot display info:** Player name, last played (relative time), total playtime

---

## Next Agent to Invoke

**Agent:** `frd-refiner`

**Context to provide:**
- Feature slug: `save-slots`
- Tier: MEDIUM
- FRD location: `/Users/stephen/Projects/hacking-game/.claude_docs/features/save-slots/frd.md`
- Key files already identified in technical approach section
- All open questions resolved with reasonable defaults

**After that agent completes:**
The FRD Refiner will validate the FRD against the actual codebase, identify any gaps or inconsistencies, and produce a refinement document. After refinement, the feature will be ready for task breakdown and implementation.
