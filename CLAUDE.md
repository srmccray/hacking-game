# Hacker Incremental Game

A hacker-themed incremental game inspired by Cauldron, featuring minigames that drive resource accumulation, idle progression, and ASCII-inspired visuals.

## Tech Stack

- **TypeScript** - Language
- **Vite** - Build tool
- **PixiJS 8.x** - 2D rendering (ASCII-inspired with graphical elements)
- **Zustand (vanilla)** - State management (no React dependency)
- **break_eternity.js** - Big number handling for incremental scaling

## Project Structure

```
src/
├── core/           # Core game systems
│   ├── game-state.ts      # Zustand store
│   ├── types.ts           # TypeScript interfaces
│   ├── resource-manager.ts # Decimal operations and formatting
│   ├── save-system.ts     # localStorage persistence
│   ├── tick-engine.ts     # Idle progression loop
│   ├── auto-generation.ts # Resource generation rates
│   ├── upgrades.ts        # Upgrade definitions
│   └── offline-progress.ts # Offline earnings calculation
├── overworld/      # Apartment scene
│   ├── apartment.ts       # Main scene
│   ├── player.ts          # Player movement
│   └── stations.ts        # Interactive objects
├── minigames/      # Minigame modules
│   ├── base-minigame.ts   # Abstract base class
│   └── code-breaker/      # Code Breaker minigame
├── ui/             # UI components
│   ├── renderer.ts        # PixiJS setup
│   ├── styles.ts          # Text styles
│   ├── hud.ts             # Resource display
│   ├── upgrade-panel.ts   # Upgrade purchasing
│   ├── welcome-back-modal.ts # Offline earnings modal
│   └── scenes/            # Scene management
└── main.ts         # Entry point
```

## Development Commands

```bash
npm install      # Install dependencies
npm run dev      # Start dev server (usually port 3000)
npm run build    # Production build
npm run preview  # Preview production build
```

## Game Controls

- **A/D** or **Arrow keys** - Move player
- **Enter/Space** - Interact with stations
- **U** - Toggle upgrade panel
- **0-9** - Input digits in Code Breaker minigame

## Key Architecture Notes

- All Decimal values are stored as strings for JSON serialization
- Zustand uses `zustand/vanilla` (no React dependency)
- PixiJS 8.x uses async initialization (`await app.init()`)
- TextStyle dropShadow uses nested object format (PixiJS 8.x API)
- Top 5 minigame scores drive auto-generation rates
- Offline progression: 8-hour cap, 50% efficiency

## Commit Guidelines

- Do not include AI/Claude attribution in commit messages
- Use conventional commit style when appropriate
- Keep commit messages concise but descriptive

## Documentation

Feature documentation is in `.claude_docs/features/hacker-incremental-game/`:
- `frd.md` - Feature Requirements Document
- `refinement.md` - Refinement notes
- `tasks.md` - Implementation task breakdown
