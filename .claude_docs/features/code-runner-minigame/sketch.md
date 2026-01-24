# Quick Sketch: Code Runner Minigame

**Created:** 2026-01-23
**Tier:** SMALL
**Triage Scores:** Complexity 4/10, Risk 2/10
**Feature ID:** hacking-game-q0e

## What

Add a "Code Runner" minigame - a vertical scrolling game where the player moves upward at a fixed speed, navigates horizontally to avoid falling obstacles (themed as lines of code/data), and earns money based on distance traveled before collision.

## Why

Expands the minigame variety to keep gameplay fresh and provide an alternative playstyle to the existing Code Breaker minigame. A reflex-based game adds diversity to the minigame portfolio and gives players another way to earn money.

## Approach

1. **Create CodeRunnerGame class** - Extends BaseMinigame, manages game state (player position, obstacles, distance, collision detection)
2. **Create CodeRunnerScene class** - PixiJS scene rendering player, obstacles, HUD, and results overlay
3. **Register minigame** - Add definition to MinigameRegistry and scene to Game.ts
4. **Add configuration** - CodeRunnerConfig in GameConfig.ts with tunable parameters
5. **Update initial state** - Add 'code-runner' to createInitialGameState minigames

## Files Likely Affected

- `src/minigames/code-runner/CodeRunnerGame.ts` - **NEW** Game logic class extending BaseMinigame
- `src/minigames/code-runner/CodeRunnerScene.ts` - **NEW** PixiJS scene for rendering
- `src/minigames/code-runner/index.ts` - **NEW** Module exports and registration helper
- `src/minigames/index.ts` - Add code-runner exports
- `src/game/GameConfig.ts` - Add CodeRunnerConfig interface and defaults
- `src/game/Game.ts` - Register code-runner scene
- `src/core/types.ts` - Add 'code-runner' to createInitialGameState

## Technical Details

### Game Mechanics
- **Player Movement:** Fixed upward velocity (simulated by obstacles moving down), horizontal movement via A/D or arrow keys
- **Obstacles:** Lines of "code" (horizontal bars with text) that spawn at the top and move downward
- **Collision:** Simple AABB collision detection between player hitbox and obstacle rectangles
- **Scoring:** Distance-based (1 point per pixel traveled, or per time unit)
- **Difficulty:** Obstacle density/speed could increase over time (optional for v1)

### Key Patterns from CodeBreaker to Follow
- Extend `BaseMinigame` for lifecycle, scoring, and event emission
- Implement `onStart()`, `onEnd()`, `onUpdate(deltaMs)` methods
- Create scene with `InputContext` for keyboard handling
- Use `INPUT_PRIORITY.SCENE` for input context
- Emit `GameEvents.MINIGAME_STARTED` and `GameEvents.MINIGAME_COMPLETED`
- Calculate reward with `calculateMoneyReward()` method
- Show results overlay on game end with play-again/exit options

### Configuration (CodeRunnerConfig)
```typescript
interface CodeRunnerConfig {
  playerSpeed: number;        // Horizontal movement speed (pixels/sec)
  scrollSpeed: number;        // Vertical scroll speed (pixels/sec)
  obstacleSpawnRate: number;  // Obstacles per second
  playerWidth: number;        // Player hitbox width
  playerHeight: number;       // Player hitbox height
  distanceToMoneyRatio: number; // Distance to money conversion
}
```

## Considerations

- **Collision Detection:** Keep it simple with AABB rectangles; no need for pixel-perfect collision
- **Performance:** Object pooling for obstacles to avoid GC spikes (optional for v1, can optimize later)
- **Visual Theme:** Use terminal-style text for obstacles (random code snippets, hex values, binary)
- **Boundary Handling:** Player cannot move off-screen horizontally
- **Difficulty Tuning:** Start with fixed difficulty; progression can be added later

## Acceptance Criteria

- [ ] Player can move left/right using A/D or arrow keys
- [ ] Obstacles spawn at top and move downward at configurable speed
- [ ] Game ends when player collides with an obstacle
- [ ] Distance traveled is tracked and displayed
- [ ] Money reward is calculated based on distance
- [ ] Score is recorded to minigames state (topScores)
- [ ] Results overlay shows distance, money earned, and play-again/exit options
- [ ] Minigame appears in minigame selection menu
- [ ] ESC exits the minigame

---

## Next Agent to Invoke

**Agent:** `frontend-implementation`

**Context to provide:**
- Feature slug: `code-runner-minigame`
- Tier: SMALL
- Sketch location: `.claude_docs/features/code-runner-minigame/sketch.md`
- Reference implementation: `src/minigames/code-breaker/` (follow same patterns)
- This is a PixiJS-based minigame with game logic + scene rendering

**After that agent completes:**
The minigame will be playable from the minigame selection menu. Testing should verify gameplay mechanics, input handling, collision detection, and reward calculation.
