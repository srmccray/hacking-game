# Minigame Selection Menu - Quick Sketch

## Overview
Add a menu that displays when interacting with the Desk, allowing players to choose which minigame to play instead of launching Code Breaker directly.

## User Flow
1. Player approaches Desk in apartment
2. Player presses Enter/Space to interact
3. **NEW:** Minigame Selection Menu appears
4. Menu shows list of unlocked minigames with:
   - Name (e.g., "Code Breaker")
   - Description
   - Primary resource icon/indicator
5. Player uses Up/Down arrows to select
6. Player presses Enter to launch selected minigame
7. Player presses Escape to return to apartment

## UI Layout (ASCII mockup)
```
┌──────────────────────────────────────┐
│        SELECT MINIGAME               │
├──────────────────────────────────────┤
│                                      │
│  > [Code Breaker]         [$$$]      │
│    Break codes, earn money           │
│                                      │
│    [???]                  [Locked]   │
│    Complete upgrades to unlock       │
│                                      │
│    [???]                  [Locked]   │
│    Complete upgrades to unlock       │
│                                      │
├──────────────────────────────────────┤
│  [Enter] Play   [Esc] Back           │
└──────────────────────────────────────┘
```

## Implementation Approach

### New File: `src/scenes/minigame-selection/MinigameSelectionScene.ts`
- Extends Scene base class
- Uses `minigameRegistry.getSummaries()` to get minigame list
- Uses `gameStore.minigames[id].unlocked` to check unlock status
- Renders list with highlight on selected item
- Handles keyboard input (Up/Down/Enter/Escape)

### Modify: `src/scenes/apartment/Station.ts`
- Change Desk's `onInteract` to call `game.switchScene('minigame-selection')`

### Modify: `src/game/Game.ts`
- Register 'minigame-selection' scene in `registerScenes()`

## Dependencies
- MinigameRegistry (already exists, has `getSummaries()`)
- SceneManager (already exists, handles transitions)
- GameStore minigame state (already tracks unlocked status)

## Out of Scope
- Minigame unlocking logic (already exists)
- New minigames (separate feature)
- Animations/transitions (can be added later)
