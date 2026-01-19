# FRD: Hacker Incremental Game

**Created:** 2026-01-19
**Refined:** 2026-01-19
**Tier:** MEDIUM
**Triage Scores:** Complexity 6/10, Risk 4/10
**Status:** Refined - Ready for Implementation

## Problem Statement

Players enjoy incremental/idle games that combine active gameplay with passive progression. The market lacks a well-executed hacker-themed incremental game that combines engaging minigames with the satisfying progression loops of games like Cauldron. This project aims to create a unique entry in the genre with ASCII-inspired aesthetics (with graphical elements) and a cyberpunk hacker narrative.

**Target Audience:** Fans of incremental games, cyberpunk aesthetics, and casual gaming who enjoy both active and idle gameplay mechanics.

## Proposed Solution

### Overview

A hacker-themed incremental game where players take on the role of a netrunner operating from their apartment. Players engage in hacking minigames to earn resources (Money, Technique, Renown), upgrade their skills and equipment, and progress through increasingly challenging corporate targets.

### Key Components

1. **Apartment Overworld:** 2D side-scrolling environment with interactive stations (computer desk, couch/TV, bed)
2. **Minigame System:** Hacker-themed active games that generate resources based on performance
3. **Resource Economy:** Three core currencies with distinct purposes
4. **Upgrade System:** Infinite scaling upgrades for minigames, equipment, and abilities
5. **Idle Progression:** Auto-generation based on best minigame scores (Cauldron-style)
6. **Offline Progression:** Calculate and award resources earned while away (MVP feature)

### User Experience

**Core Loop:**
1. Player navigates apartment to interact with stations
2. Station launches associated minigame
3. Minigame performance generates resources and records high scores
4. Best 5 scores contribute to auto-generation rate
5. Resources spent on upgrades that improve minigame performance and unlock content
6. Cycle repeats with increasing scale and complexity

**Offline Experience:**
1. Player closes browser/tab
2. On return, game calculates elapsed time (capped)
3. Offline earnings displayed in welcome-back modal
4. Resources awarded and game resumes

**Progression Feel:** Early game is active-focused; late game shifts to idle-focused with occasional active play to push new high scores.

## Technical Approach

### Recommended Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Language | TypeScript | Type safety, excellent tooling |
| Build | Vite | Fast HMR, native TS support |
| Rendering | PixiJS | High-performance 2D, supports both text and sprites for ASCII-inspired look with graphical elements |
| Big Numbers | break_eternity.js | Handles incremental scale (1e9e15) |
| State | Zustand | Simple, performant, TS-friendly |

**Rendering Decision Rationale:**

The original consideration was rot.js for pure ASCII rendering. However, with the art direction decision to use "ASCII-inspired with graphical elements," PixiJS is the better choice because:

1. **Flexibility:** PixiJS handles both text rendering (for ASCII elements) AND sprite-based graphics seamlessly
2. **Performance:** WebGL-accelerated rendering handles mixed content at 60fps
3. **Future-proofing:** Easy to add visual effects, particle systems, or more elaborate graphics later
4. **Text Support:** PixiJS Text and BitmapText classes can render monospace fonts for the terminal aesthetic
5. **No Limitations:** rot.js is specialized for pure character-cell displays; mixing in graphical elements would fight against its design

### Architecture Overview

```
src/
├── core/
│   ├── game-state.ts        # Central state management (Zustand store)
│   ├── save-system.ts       # Persistence layer
│   ├── resource-manager.ts  # Currency handling with break_eternity
│   ├── tick-engine.ts       # Idle progression loop (requestAnimationFrame)
│   └── offline-progress.ts  # Offline calculation on load
├── overworld/
│   ├── apartment.ts         # Scene management
│   ├── player.ts            # Character movement
│   └── stations.ts          # Interactive objects
├── minigames/
│   ├── base-minigame.ts     # Abstract minigame class
│   └── code-breaker/        # MVP minigame implementation
│       ├── index.ts
│       ├── game-logic.ts
│       └── renderer.ts
├── ui/
│   ├── hud.ts               # Resource display, nav
│   ├── upgrade-panel.ts     # Upgrade purchasing UI
│   ├── offline-modal.ts     # Welcome-back earnings display
│   └── renderer.ts          # PixiJS application setup
├── assets/
│   ├── fonts/               # Monospace fonts for terminal look
│   └── sprites/             # Graphical elements (glow effects, icons, etc.)
└── main.ts                  # Entry point
```

### Core Systems

#### Resource System

```typescript
interface Resources {
  money: Decimal;      // Primary currency, buys equipment
  technique: Decimal;  // Skill currency, improves minigame abilities
  renown: Decimal;     // Fame currency, unlocks new targets/content
}
```

**Resource Sources:**
- **Money:** Code Breaker minigame, passive contracts, offline generation
- **Technique:** Future minigames (post-MVP), training simulations
- **Renown:** Future high-profile hacks (post-MVP)

#### Minigame Framework

Each minigame:
- Has defined win/lose conditions and scoring
- Records top 5 scores that contribute to auto-generation
- Can be upgraded to increase score potential and resource multipliers
- Uses ASCII-inspired visuals with graphical accents (glow effects, color gradients)

**MVP Minigame:**

1. **Code Breaker** (Computer Station)
   - Match/decode sequences under time pressure
   - Higher combos = higher scores
   - Generates: Money
   - Visual style: Terminal-like with scan-line effects, glowing text

#### Idle Progression System

```typescript
interface AutoGeneration {
  calculateRate(minigame: Minigame): Decimal {
    const topScores = minigame.getTopScores(5);
    const baseRate = topScores.reduce((sum, s) => sum.add(s), new Decimal(0));
    const multipliers = this.getActiveMultipliers(minigame);
    return baseRate.mul(multipliers);
  }
}
```

- Tick-based system using requestAnimationFrame with delta time
- Accumulates fractional resources for smooth display
- Auto-generation rate displayed per resource in HUD

#### Offline Progression System (MVP)

```typescript
interface OfflineProgress {
  maxOfflineHours: number;        // Cap at 8 hours for MVP
  offlineEfficiency: number;      // 50% of online rate initially

  calculateOfflineEarnings(lastPlayedTimestamp: number): OfflineReport {
    const now = Date.now();
    const elapsedMs = now - lastPlayedTimestamp;
    const cappedMs = Math.min(elapsedMs, this.maxOfflineHours * 60 * 60 * 1000);

    const onlineRate = this.getAutoGenerationRate();
    const offlineRate = onlineRate.mul(this.offlineEfficiency);
    const secondsOffline = cappedMs / 1000;

    return {
      timeAway: cappedMs,
      timeCapped: elapsedMs > cappedMs,
      earnings: {
        money: offlineRate.mul(secondsOffline)
      }
    };
  }
}

interface OfflineReport {
  timeAway: number;           // ms actually counted
  timeCapped: boolean;        // true if exceeded max
  earnings: {
    money: Decimal;
    // Future: technique, renown
  };
}
```

**Offline Progression Flow:**
1. On page load, check `lastPlayed` timestamp from save
2. Calculate elapsed time (cap at 8 hours)
3. Apply offline efficiency multiplier (50% base, upgradeable post-MVP)
4. Show welcome-back modal with earnings summary
5. Award resources and update `lastPlayed`

**Welcome-Back Modal Example:**
```
+------------------------------------------+
|           WELCOME BACK, NETRUNNER        |
+------------------------------------------+
|                                          |
|  You were away for: 4h 23m               |
|                                          |
|  While you were gone, your bots earned:  |
|                                          |
|    $ 1,234,567                           |
|                                          |
|            [ COLLECT ]                   |
+------------------------------------------+
```

#### Upgrade System

Categories:
1. **Minigame Upgrades:** Improve scoring potential, add mechanics
2. **Equipment Upgrades:** Passive bonuses, new abilities
3. **Apartment Upgrades:** Unlock new stations, aesthetic improvements (post-MVP)

Scaling: Costs increase exponentially; benefits scale but slower than costs (maintaining progression challenge).

### Frontend Implementation

#### PixiJS Rendering Setup

```typescript
import { Application, Text, TextStyle, Container, Graphics } from 'pixi.js';

// Create application
const app = new Application();
await app.init({
  width: 800,
  height: 600,
  backgroundColor: 0x0a0a0a,
  antialias: true,
});

// Terminal-style text
const terminalStyle = new TextStyle({
  fontFamily: 'IBM Plex Mono, Consolas, monospace',
  fontSize: 16,
  fill: '#00ff00',  // Classic terminal green
  dropShadow: {
    color: '#00ff00',
    blur: 4,
    alpha: 0.5,
  }
});

// Create ASCII-inspired text with glow effect
const text = new Text({ text: '> INITIALIZING...', style: terminalStyle });
```

#### Apartment Overworld

- PixiJS Container for scene management
- Player sprite (can be ASCII `@` rendered as text or simple sprite)
- Stations as interactive containers with hover/click states
- Keyboard input via standard DOM events
- Simple left/right movement with arrow keys or A/D
- Interaction with Enter/Space when near station

**Visual Style:**
- Dark background with CRT-style vignette effect
- Green/cyan terminal text with subtle glow
- Stations have graphical icons with ASCII labels
- Ambient "data stream" particle effects in background (optional polish)

### Data Model

#### Save State Structure

```typescript
interface GameState {
  version: string;
  lastSaved: number;
  lastPlayed: number;  // Critical for offline calculation

  resources: {
    money: string;      // Decimal serialized
    technique: string;
    renown: string;
  };

  minigames: {
    [id: string]: {
      unlocked: boolean;
      topScores: string[];  // Top 5 as Decimal strings
      playCount: number;
      upgrades: { [upgradeId: string]: number };
    };
  };

  upgrades: {
    equipment: { [id: string]: number };
    apartment: { [id: string]: boolean };
  };

  settings: {
    offlineProgressEnabled: boolean;  // Allow player to disable
  };

  stats: {
    totalPlayTime: number;
    totalOfflineTime: number;
    totalResourcesEarned: { [resource: string]: string };
  };
}
```

#### Persistence Strategy

- **Primary:** localStorage (works offline, no backend needed)
- **Format:** JSON with version field for migrations
- **Auto-save:** Every 30 seconds + on tab blur/close
- **Offline Trigger:** `beforeunload` event updates `lastPlayed`
- **Export/Import:** Base64 encoded save string for manual backup

## Implementation Notes

### MVP Scope Definition

**Included in MVP:**
- Apartment overworld with player movement
- Computer station interaction
- One playable minigame (Code Breaker)
- Basic resource display HUD
- 3-5 purchasable upgrades
- Local save/load system
- Idle progression (auto-generation from top scores)
- Offline progression with welcome-back modal
- Start/pause game functionality
- ASCII-inspired visual style with graphical elements (PixiJS)

**Deferred Post-MVP:**
- Additional minigames (Network Router, etc.)
- Couch and bed station functionality
- Mobile packaging (Capacitor)
- Sound effects/music
- Achievement system
- Prestige/reset mechanics
- Offline efficiency upgrades (keep base 50% for MVP)

### Dependencies

```json
{
  "dependencies": {
    "pixi.js": "^8.0.0",
    "break_eternity.js": "^2.0.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

### Integration Points

- **PixiJS Application:** Main rendering target, handles both text and sprites
- **Zustand Store:** Single source of truth for game state
- **break_eternity:** All numeric calculations for resources/upgrades
- **Vite:** Development server and production bundling

### Migration from rot.js Consideration

If any prototype work was done with rot.js, migration to PixiJS involves:
1. Replace `Display` with PixiJS `Application`
2. Convert character drawing to PixiJS `Text` objects
3. Add graphical containers for enhanced visuals
4. Input handling remains the same (DOM events)

## Testing Strategy

### Unit Tests
- Resource calculations (especially big number math)
- Upgrade cost/benefit formulas
- Save/load serialization
- Auto-generation rate calculations
- **Offline progression calculations** (time capping, efficiency multiplier)

### Integration Tests
- Minigame score recording and top-5 tracking
- Upgrade purchase flow (resources deducted, effects applied)
- State persistence across page reloads
- **Offline earnings on page load** (mock timestamps)

### Manual Testing

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| Basic Navigation | Arrow keys in apartment | Player moves, stops at walls |
| Station Interaction | Approach desk, press Enter | Code Breaker minigame launches |
| Minigame Scoring | Complete Code Breaker | Score recorded, resources awarded |
| Upgrade Purchase | Buy upgrade with sufficient resources | Resources deducted, effect visible |
| Save/Load | Play, refresh page | State restored correctly |
| **Offline Progress** | Play, close tab, wait 5 min, reopen | Welcome-back modal shows earnings |
| **Offline Cap** | Close for 12 hours | Earnings capped at 8 hours |

## Rollback Plan

As a greenfield project with no production deployment:
- Git-based rollback to previous commits
- No database migrations to reverse
- localStorage can be cleared for fresh start during development

## Acceptance Criteria

- [ ] Player can navigate apartment overworld using keyboard
- [ ] Player can interact with computer station to launch minigame
- [ ] Code Breaker minigame is playable with scoring system
- [ ] Resources (Money) are awarded based on minigame performance
- [ ] Top 5 scores are tracked and displayed
- [ ] At least 3 upgrades are purchasable with resources
- [ ] Game state persists across browser sessions
- [ ] Basic HUD displays current resources and auto-generation rate
- [ ] Game can be paused and resumed
- [ ] ASCII-inspired visual style with graphical elements (glow, effects)
- [ ] **Offline progression calculates earnings while away**
- [ ] **Welcome-back modal displays time away and resources earned**
- [ ] **Offline time is capped at 8 hours**

## Resolved Questions

| Question | Decision | Rationale |
|----------|----------|-----------|
| MVP Minigame Count | Single minigame (Code Breaker) only | Reduces scope, validates core loop faster |
| Mobile Input | Defer mobile packaging entirely | Web-only for MVP, no touch considerations |
| Art Direction | ASCII-inspired with graphical elements | Led to PixiJS over rot.js for flexibility |
| Offline Progression | Include in MVP | Essential for incremental game feel |
| Target Platforms | Web-only (local development) | No Electron/Capacitor for MVP |

---

## Appendix

### Glossary

- **Incremental Game:** Genre where numbers grow over time, often featuring idle/offline progression
- **Netrunner:** Cyberpunk term for a hacker who interfaces directly with computer networks
- **PixiJS:** High-performance 2D WebGL rendering library for games and interactive graphics
- **Decimal/break_eternity:** Libraries for handling very large numbers beyond JavaScript's native precision

### References

- [Cauldron on Steam](https://store.steampowered.com/app/2619650/Cauldron/) - Primary inspiration
- [PixiJS Documentation](https://pixijs.com/) - 2D rendering library
- [break_eternity.js](https://github.com/Patashu/break_eternity.js) - Big number library
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [Vite](https://vitejs.dev/) - Build tooling

### Minigame Design Sketches

**Code Breaker Concept (ASCII-inspired with PixiJS):**
```
+------------------------------------------+
|  TARGET: 7 3 9 2 4                       |  <- Glowing green text
|  INPUT:  _ _ _ _ _                       |  <- Cursor blinks
|                                          |
|  [1] [2] [3] [4] [5] [6] [7] [8] [9] [0] |  <- Keys with hover glow
|                                          |
|  TIME: 00:45    COMBO: x3    SCORE: 1250 |
+------------------------------------------+
     ^                                  ^
     CRT scanline effect          Particle effects on combo
```
Player matches sequences; faster matches = higher combos = more points.

### Offline Progression Design Notes

**Why 50% efficiency for offline:**
- Rewards active play while still providing meaningful passive gains
- Common pattern in successful incremental games
- Easy to upgrade as post-MVP progression milestone

**Why 8-hour cap:**
- Prevents extreme accumulation for very long absences
- Covers typical overnight or workday absence
- Can be extended via upgrades post-MVP

**Edge cases handled:**
- First-time player (no `lastPlayed`): Skip offline calculation
- Very short absence (<1 min): Skip modal, apply silently
- Browser clock manipulation: Consider server time validation post-MVP
