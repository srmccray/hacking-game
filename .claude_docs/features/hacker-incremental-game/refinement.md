# Refinement Notes: Hacker Incremental Game

**Refined:** 2026-01-19
**FRD Location:** `/Users/stephen/Projects/hacking-game/.claude_docs/features/hacker-incremental-game/frd.md`
**Tier:** MEDIUM

## Codebase Alignment

This is a **greenfield project** - no existing codebase to validate against. Refinement focused on:

1. Validating user decisions against technical requirements
2. Updating tech stack based on art direction decision
3. Adding offline progression to MVP scope with implementation details

### Key Decision Impact: Art Direction

**User Decision:** ASCII-inspired with graphical elements (not pure rot.js ASCII)

**Technical Impact:**
- **Changed:** rot.js -> PixiJS for rendering
- **Rationale:** rot.js is designed for pure character-cell ASCII displays. Mixing graphical elements (glow effects, particles, sprites) would fight against its design. PixiJS provides:
  - WebGL-accelerated rendering for smooth 60fps
  - Native support for both Text objects AND sprites
  - Built-in effects (drop shadows, filters) for the "glow" aesthetic
  - Better performance for mixed content
  - Easier to extend with visual polish later

### Key Decision Impact: Offline Progression

**User Decision:** Include in MVP (essential for incremental game feel)

**Scope Change:**
- Moved from "Deferred Post-MVP" to "Included in MVP"
- Added `offline-progress.ts` module to architecture
- Added `offline-modal.ts` UI component
- Added `lastPlayed` timestamp tracking to save system
- Added 3 new acceptance criteria for offline functionality

**Implementation Parameters:**
- 8-hour cap on offline time
- 50% efficiency multiplier (vs online idle rate)
- Welcome-back modal for earnings display
- Silent application for <1 minute absences

## Key Files (Will Create)

This is greenfield, so all files are new. Priority implementation order:

### Core Infrastructure
- `src/main.ts` - Entry point, PixiJS initialization
- `src/core/game-state.ts` - Zustand store
- `src/core/save-system.ts` - localStorage persistence
- `src/core/resource-manager.ts` - break_eternity integration
- `src/core/tick-engine.ts` - requestAnimationFrame game loop
- `src/core/offline-progress.ts` - Offline earnings calculation

### Overworld
- `src/overworld/apartment.ts` - Scene container
- `src/overworld/player.ts` - Character movement
- `src/overworld/stations.ts` - Interactive objects

### Minigame
- `src/minigames/base-minigame.ts` - Abstract interface
- `src/minigames/code-breaker/index.ts` - MVP minigame entry
- `src/minigames/code-breaker/game-logic.ts` - Scoring, combos
- `src/minigames/code-breaker/renderer.ts` - PixiJS visuals

### UI
- `src/ui/renderer.ts` - PixiJS Application setup
- `src/ui/hud.ts` - Resource display
- `src/ui/upgrade-panel.ts` - Upgrade purchasing
- `src/ui/offline-modal.ts` - Welcome-back screen

## Tech Stack Summary

| Original | Updated | Reason |
|----------|---------|--------|
| rot.js | PixiJS | Art direction requires graphical elements |
| Capacitor | Removed | Mobile deferred entirely |

**Final Stack:**
- TypeScript + Vite
- PixiJS 8.x (rendering)
- break_eternity.js (big numbers)
- Zustand (state management)

## Blockers / Concerns

None identified. The decisions simplify the implementation:
- Single minigame reduces initial scope
- Web-only removes cross-platform concerns
- PixiJS is well-documented with active community

## Potential Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| PixiJS learning curve | Low | Medium | Well-documented, many game examples |
| break_eternity serialization edge cases | Low | Low | Established library, test serialization early |
| Offline progression clock manipulation | Low | Low | Defer server validation to post-MVP |

## Ready for Implementation

- [x] FRD assumptions validated
- [x] No major blockers identified
- [x] Tech stack finalized
- [x] Offline progression scoped with implementation details
- [x] All open questions resolved
- [x] Acceptance criteria updated

---

## Next Agent to Invoke

**Agent:** `breakdown`

**Context to provide:**
- Feature slug: `hacker-incremental-game`
- Tier: MEDIUM
- Refinement summary: FRD refined with all user decisions incorporated. Key changes: rot.js replaced with PixiJS for ASCII-inspired+graphical art direction, offline progression added to MVP scope with 8-hour cap and 50% efficiency. Single minigame (Code Breaker) only.
- Key files: All new (greenfield) - start with `src/core/` infrastructure, then `src/ui/renderer.ts`, then overworld, then minigame

**After that agent completes:**
The breakdown agent will decompose this MEDIUM-tier feature into implementation tasks. Since this is a greenfield project with both rendering setup and game logic, expect tasks organized by dependency order: core systems first, then UI/rendering, then game-specific features.
