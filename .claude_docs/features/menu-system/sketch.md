# Quick Sketch: Menu System

**Created:** 2026-01-19
**Tier:** SMALL
**Triage Scores:** Complexity 3/10, Risk 2/10

## What

Add a start menu scene and an in-game pause menu overlay to the hacker incremental game, providing standard game navigation (New Game, Load/Save, Options placeholder, Exit).

## Why

Players currently have no way to start a fresh game, manage saves manually, or return to a main menu. This is fundamental UX for any game and provides the foundation for future options/settings.

## Approach

1. **Create `MainMenuScene`** (`/Users/stephen/Projects/hacking-game/src/ui/scenes/main-menu.ts`)
   - Implement `Scene` interface (same pattern as apartment.ts)
   - Display ASCII-art title banner
   - Menu options as selectable text items with keyboard navigation
   - Conditionally show "Load Game" and "Delete Save" based on `hasSaveData()`
   - "Options" shows placeholder/disabled state
   - "Exit" attempts `window.close()` (graceful fallback message if blocked)

2. **Create `InGameMenu`** (`/Users/stephen/Projects/hacking-game/src/ui/in-game-menu.ts`)
   - Follow `welcome-back-modal.ts` overlay pattern (semi-transparent background, centered modal box)
   - Toggle with Escape key
   - Options: Save Game, Options (placeholder), Exit to Main Menu
   - "Save Game" calls `saveGame()` and shows confirmation feedback
   - "Exit to Main Menu" switches scene via `sceneManager.switchTo('main-menu')`

3. **Modify `main.ts` initialization**
   - Register `MainMenuScene` with scene manager
   - On startup: if `hasSaveData()`, go directly to apartment (existing behavior); if no save, show main menu
   - Actually, simpler: always start at main menu, let user choose

4. **Wire up Escape key** globally to toggle in-game menu (when not on main menu scene)

## Files Likely Affected

- `src/ui/scenes/main-menu.ts` - NEW: Main menu scene implementation
- `src/ui/in-game-menu.ts` - NEW: In-game pause menu overlay
- `src/main.ts` - Modify startup flow to show main menu first, register new scene, wire Escape key
- `src/ui/styles.ts` - May add menu-specific styles (optional, can reuse existing)

## Considerations

- **window.close() limitation**: Browsers block `window.close()` for tabs not opened by script. Show a message like "Please close this tab manually" as fallback.
- **Save state on Exit to Main Menu**: Should auto-save before returning to main menu to avoid losing progress.
- **Escape key conflicts**: Ensure Escape doesn't trigger menu during minigames or when modals are open. Check `welcomeBackModalVisible` and current scene before toggling.
- **Menu navigation**: Support both mouse clicks and keyboard (arrow keys + Enter) for accessibility.
- **Offline progress on load**: When "Load Game" is selected, the existing offline progress flow should still trigger (welcome-back modal if applicable).

## Acceptance Criteria

- [ ] Game starts on Main Menu screen instead of directly entering apartment
- [ ] Main Menu displays: New Game, Load Game (if save exists), Delete Save (if save exists), Options (disabled), Exit
- [ ] "New Game" clears any existing save via `hardReset()` and enters apartment scene
- [ ] "Load Game" loads existing save and enters apartment (with offline progress modal if applicable)
- [ ] "Delete Save" prompts for confirmation, then calls `deleteSave()`
- [ ] Pressing Escape during gameplay opens In-Game Menu overlay
- [ ] In-Game Menu shows: Save Game, Options (disabled), Exit to Main Menu
- [ ] "Save Game" saves and shows brief confirmation feedback
- [ ] "Exit to Main Menu" saves game and returns to main menu scene
- [ ] Pressing Escape while In-Game Menu is open closes the menu
- [ ] In-Game Menu does not open during minigames or when other modals are active
