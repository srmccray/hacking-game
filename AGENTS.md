# Agent Instructions

This project uses **bd** (beads) for persistent issue tracking combined with **specialized agents** for domain expertise.

## Architecture: Orchestrator + Subagents

The workflow commands (`/bd-workflow`, `/bd-start`) operate as **orchestrators**:
- The **primary context** manages beads state and coordinates the workflow
- **Subagents** (via Task tool) perform actual work (triage, planning, implementation)
- Results flow back to the orchestrator, which updates beads and continues

```
┌─────────────────────────────────────────────────────────────────┐
│  PRIMARY CONTEXT (Orchestrator)                                 │
│    - Manages beads (create, update, close issues)               │
│    - Invokes subagents via Task tool                            │
│    - Processes results and continues workflow                   │
│    - NEVER writes implementation code directly                  │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │ Triage  │         │   FRD   │         │  Impl   │
    │  Agent  │         │  Agent  │         │  Agent  │
    └─────────┘         └─────────┘         └─────────┘
```

## Quick Start

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status=in_progress  # Claim work
# ... invoke subagent for implementation ...
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Slash Commands

| Command | Purpose |
|---------|---------|
| `/bd-workflow <request>` | Full graduated workflow (triage → plan → implement) using subagents |
| `/bd-start [request]` | Quick session start - find or create work, delegate to subagents |
| `/triage <request>` | Assess complexity/risk, determine tier |
| `/implement <task>` | Execute implementation with domain agent |

## Workflow Overview

```
New Request
    │
    ▼
┌─────────────────┐
│  /bd-workflow   │  Creates feature issue in beads
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Triage       │  Assess complexity → TRIVIAL/SMALL/MEDIUM/LARGE
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼
 TRIVIAL    SMALL     MEDIUM      LARGE
    │         │          │          │
    │     Quick       FRD +      FRD +
    │     Sketch    Refinement  Refinement +
    │         │          │      Task Breakdown
    │         │          │          │
    └────┬────┴──────────┴──────────┘
         │
         ▼
┌─────────────────┐
│ Create Tasks    │  bd create for each implementation task
│ (beads issues)  │  bd dep add to set dependencies
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   bd ready      │  Find unblocked tasks
│   Implement     │  Use domain agents
│   bd close      │  Mark complete, unblocks dependents
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  bd sync        │  Persist state
│  git push       │  Push to remote
└─────────────────┘
```

## Beads Commands Reference

### Finding Work
```bash
bd ready                          # Tasks with no blockers
bd list --status=open             # All open issues
bd list --status=in_progress      # Active work
bd show <id>                      # Issue details
bd blocked                        # What's stuck
```

### Creating & Updating
```bash
bd create "Title" --type=feature --priority=2   # New feature
bd create "Title" --type=task --priority=2      # New task
bd create "Title" --type=bug --priority=1       # Bug (higher priority)

bd update <id> --status=in_progress   # Start work
bd update <id> --notes="Context..."   # Add notes
bd close <id>                         # Complete
bd close <id1> <id2> <id3>            # Close multiple
```

### Dependencies
```bash
bd dep add <child> <parent>    # child depends on parent completing first
bd graph                       # Visualize dependency tree
```

### Sync
```bash
bd sync              # Commit beads changes to git
bd sync --status     # Check sync status
```

## Domain Agents

| Domain | Agent | When to Use |
|--------|-------|-------------|
| TypeScript, game logic, state | `backend-implementation` | Core systems, Zustand store, resource management |
| PixiJS, rendering, UI | `frontend-implementation` | Visual components, scenes, HUD |
| AWS, deployment | `infrastructure-implementation` | Build config, hosting |
| Auth, validation | `security-review` | Security-sensitive changes |
| pytest, Jest | `test-coverage` | Test creation and coverage |
| Markdown, API docs | `documentation-writer` | Documentation |

## Session Protocol

### Starting a Session
```bash
bd ready              # What's available?
bd show <id>          # Review details
bd update <id> --status=in_progress  # Claim it
```

### Ending a Session

**MANDATORY - work is NOT complete until pushed:**

```bash
# 1. Check state
git status

# 2. Stage and commit code
git add <files>
git commit -m "Description"

# 3. Sync beads
bd sync

# 4. Push everything
git push

# 5. Verify
git status   # Should show "up to date with origin"
```

**CRITICAL RULES:**
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

## Example: Adding a New Minigame

```bash
# 1. Create feature
bd create "Add packet sniffer minigame" --type=feature --priority=2
# → hacking-a1b2

# 2. After triage (MEDIUM tier), create tasks
bd create "Define PacketSniffer class extending BaseMinigame" --type=task
# → hacking-c3d4
bd create "Implement packet capture gameplay loop" --type=task
# → hacking-e5f6
bd create "Add visual packet rendering" --type=task
# → hacking-g7h8
bd create "Create station in apartment scene" --type=task
# → hacking-i9j0

# 3. Set dependencies
bd dep add hacking-e5f6 hacking-c3d4   # gameplay needs class
bd dep add hacking-g7h8 hacking-e5f6   # visuals need gameplay
bd dep add hacking-i9j0 hacking-g7h8   # station needs visuals

# 4. Implement in order
bd ready  # → hacking-c3d4 is ready
bd update hacking-c3d4 --status=in_progress
# ... use backend-implementation agent ...
bd close hacking-c3d4

bd ready  # → hacking-e5f6 now unblocked
# ... continue until all done ...

# 5. Close feature and sync
bd close hacking-a1b2
bd sync && git push
```

## Subagent Invocation Pattern

When orchestrating, always use the Task tool to invoke subagents:

```
Task tool call:
  subagent_type: "backend-implementation"  (or other agent)
  prompt: |
    Implement this task:

    TASK ID: hacking-game-xyz
    TITLE: Create NetworkMonitor class
    DESCRIPTION: Full description from bd show

    After implementation:
    - List files created/modified
    - Note any issues or follow-up work
    - Confirm task is complete
```

After the subagent returns:
1. Verify the work was completed
2. Update beads: `bd close <task-id> --reason="summary"`
3. Check for next task: `bd ready`
4. Continue or end session

## Tips

- **Orchestrate, don't implement**: Primary context manages beads; subagents write code
- **Persistence beats memory**: When in doubt, create a beads issue. It survives session clears.
- **Dependencies unblock automatically**: Closing a task makes its dependents show up in `bd ready`.
- **Parallel work**: Tasks with no dependency relationship can be worked in parallel.
- **Notes are cheap**: Use `bd update <id> --notes="..."` to capture context for future sessions.
