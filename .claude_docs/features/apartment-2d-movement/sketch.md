# Quick Sketch: Apartment 2D Movement and Collision

**Created:** 2026-01-19
**Tier:** SMALL
**Triage Scores:** Complexity 4/10, Risk 3/10

## What

Upgrade the apartment scene from 1D horizontal-only movement to full 2D movement with AABB collision detection and collision-based interaction.

## Why

Current 1D movement limits gameplay immersion. 2D movement with collision creates a more engaging overworld experience where players can explore the apartment space and physically interact with furniture stations.

## Approach

### 1. Player 2D Movement (`/Users/stephen/Projects/hacking-game/src/overworld/player.ts`)

- Add `up` and `down` to `PlayerInput` interface
- Change `y` from constant `FLOOR_Y` to mutable position
- Add `MIN_Y` and `MAX_Y` boundary constants (room bounds ~100 to ~400)
- Update `MoveDirection` type to `'up' | 'down' | 'left' | 'right' | 'none'` or track X/Y velocity independently
- Modify `update()` to handle Y movement with same speed as X
- Update `setBounds()` signature to accept `(minX, maxX, minY, maxY)`

### 2. Station Collision Boxes (`/Users/stephen/Projects/hacking-game/src/overworld/stations.ts`)

- Add `y` and `height` to `Station` interface (height already in `StationVisual`, expose on Station)
- Add `getCollisionRect()` method returning `{x, y, width, height}` for AABB
- Create collision detection utility function:
  ```typescript
  function checkAABBCollision(rect1, rect2): boolean
  ```
- Modify `StationManager.updatePlayerPosition(playerX, playerY, playerWidth, playerHeight)` to:
  - Check collision overlap for interaction (replaces 60px radius)
  - Return which station (if any) player is colliding with

### 3. Collision-Based Movement Blocking (`/Users/stephen/Projects/hacking-game/src/overworld/apartment.ts`)

- Before applying movement in update loop, calculate proposed new position
- Check if proposed position would collide with any station
- If collision, don't apply that axis of movement (slide along walls)
- Pass player bounding box (approximate from font size ~32x32) to collision checks

### 4. Input Handling Updates (`/Users/stephen/Projects/hacking-game/src/overworld/player.ts`)

- Add `KeyW` and `ArrowUp` to `MOVE_UP_KEYS`
- Add `KeyS` and `ArrowDown` to `MOVE_DOWN_KEYS`
- Update `setupPlayerInput()` to handle up/down directions
- Modify `InputHandler.onMove` to accept all 4 directions

### 5. HUD Integration (`/Users/stephen/Projects/hacking-game/src/overworld/apartment.ts`)

- Import `createHUD`, `destroyHUD` from `../ui/hud`
- In `createApartmentScene()`, call `createHUD()` and add container to scene
- In `destroyApartmentScene()`, call `destroyHUD()` for cleanup
- HUD positioned at top-left (already configured in hud.ts with padding)

## Files Likely Affected

- `/Users/stephen/Projects/hacking-game/src/overworld/player.ts` - Add up/down input, Y position, Y boundaries, 2D movement logic
- `/Users/stephen/Projects/hacking-game/src/overworld/stations.ts` - Add collision rect helpers, 2D proximity detection
- `/Users/stephen/Projects/hacking-game/src/overworld/apartment.ts` - Wire 2D input, collision blocking logic, HUD integration

## Considerations

- **Player bounding box:** Use approximate 24x32 based on `@` character at 32px font (anchor at bottom-center)
- **Station collision rects:** Stations are anchored at bottom-center; need to compute collision rect from `x - width/2`, `y - height`, `width`, `height`
- **Diagonal movement:** When both X and Y pressed, normalize velocity to prevent faster diagonal speed
- **Interaction vs collision:** Collision blocks movement; interaction prompt appears when colliding with an enabled station
- **Movement feel:** May need to tune speed or add slight collision "push-back" to prevent getting stuck on corners
- **Y boundaries:** Keep player within room walls (top wall at y=80, floor at FLOOR_Y=420, with some margin)

## Acceptance Criteria

- [ ] Player moves in all 4 directions using WASD or arrow keys
- [ ] Player cannot walk through furniture (desk, couch, bed block movement)
- [ ] Interaction prompt appears when player collides with a station
- [ ] Player cannot move outside room boundaries
- [ ] HUD displays in the apartment scene showing resources
- [ ] Diagonal movement speed is normalized (not faster than cardinal)

---

## Next Agent to Invoke

**Agent:** `implement`

**Context to provide:**
- Feature slug: `apartment-2d-movement`
- Tier: SMALL
- Quick Sketch location: `/Users/stephen/Projects/hacking-game/.claude_docs/features/apartment-2d-movement/sketch.md`
- This is a self-contained UI/gameplay change with no backend or data model changes
- Key files are well-documented with clear patterns to follow

**After that agent completes:**
The implementation agent will modify the three overworld files to enable 2D movement, AABB collision, and HUD integration. Manual testing should verify all acceptance criteria.
