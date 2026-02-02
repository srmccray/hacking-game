# Plan Work in Beads

Analyze a feature request, break it into tasks, and populate beads with issues and dependencies — without starting implementation.

## Request
$ARGUMENTS

## Instructions

**You are the ORCHESTRATOR.** Your goal is to populate beads with a well-structured set of tasks and dependencies. You will NOT implement anything — only plan.

---

## Phase 1: Initialize (YOU do this directly)

```bash
bd ready
bd list --status=open
```

Check if this request already has beads issues. If a matching feature exists, show it and ask the user whether to add tasks to the existing feature or start fresh.

If no match, create the feature issue:

```bash
bd create "FEATURE_TITLE" --type=feature --priority=2 --description="DESCRIPTION"
```

**Save the feature ID.**

---

## Phase 2: Triage (INVOKE SUBAGENT)

**Use the Task tool** to invoke the `request-triage` agent:

```
Task tool parameters:
  subagent_type: "request-triage"
  prompt: |
    Triage this feature request and return a structured assessment.

    REQUEST: [paste the user's request]
    BEADS_FEATURE_ID: [the beads issue ID]

    Return your assessment in this exact format:

    TIER: [TRIVIAL|SMALL|MEDIUM|LARGE]
    COMPLEXITY: [1-10]
    RISK: [1-10]
    RATIONALE: [brief explanation]
    RECOMMENDED_AGENTS: [comma-separated list of agents needed]
```

Update beads with the tier:

```bash
bd update <feature-id> --notes="Tier: X. Complexity: Y, Risk: Z"
```

---

## Phase 3: Generate Task Breakdown

Choose the approach based on tier:

### TRIVIAL
Create a single task directly — no subagent needed:

```bash
bd create "Implement: [brief title]" --type=task --priority=3 --description="[from the request]"
```

Skip to Phase 4.

### SMALL
**Use the Task tool** to invoke the `frd-creator` agent:

```
Task tool parameters:
  subagent_type: "frd-creator"
  prompt: |
    Create a Quick Sketch for this SMALL tier feature.

    REQUEST: [paste request]
    BEADS_FEATURE_ID: [beads issue ID]
    TIER: SMALL

    Output to: .claude_docs/features/[slug]/sketch.md

    Return a summary including a "Suggested Tasks (for beads)" table with columns: #, Title, Agent, Depends On
```

Extract the tasks from the agent's output. Proceed to Phase 4.

### MEDIUM
**Step 1:** Invoke `frd-creator` for a standard FRD.
**Step 2:** Invoke `frd-refiner` for light refinement.

```
Task tool parameters:
  subagent_type: "frd-creator"
  prompt: |
    Create a standard FRD for this MEDIUM tier feature.

    REQUEST: [paste request]
    BEADS_FEATURE_ID: [beads issue ID]
    TIER: MEDIUM

    Output to: .claude_docs/features/[slug]/frd.md
```

```
Task tool parameters:
  subagent_type: "frd-refiner"
  prompt: |
    Perform light refinement on the FRD at .claude_docs/features/[slug]/frd.md

    BEADS_FEATURE_ID: [beads issue ID]
    TIER: MEDIUM

    Include a "Suggested Tasks (for beads)" table with columns: #, Title, Agent, Depends On, Description
```

Extract the tasks from the refiner's output. Proceed to Phase 4.

### LARGE
**Step 1:** Invoke `frd-creator` for comprehensive FRD.
**Step 2:** Invoke `frd-refiner` for thorough refinement.
**Step 3:** Invoke `frd-task-breakdown` for full task decomposition.

```
Task tool parameters:
  subagent_type: "frd-task-breakdown"
  prompt: |
    Break down the refined FRD into implementation tasks.

    BEADS_FEATURE_ID: [beads issue ID]
    FRD: .claude_docs/features/[slug]/frd.md
    REFINEMENT: .claude_docs/features/[slug]/refinement.md

    Output:
    1. Task documents in .claude_docs/tasks/[slug]/
    2. A "Beads Task Creation Script" section with bd create and bd dep add commands
```

The agent provides a "Beads Task Creation Script" — use it directly in Phase 4.

---

## Phase 4: Populate Beads (YOU do this directly)

### For LARGE tier:
Run the "Beads Task Creation Script" from the frd-task-breakdown agent's output.

### For all other tiers:
Create beads issues from the suggested tasks:

```bash
bd create "Task title" --type=task --priority=2 --description="Description"
# → capture ID

bd create "Task title 2" --type=task --priority=2 --description="Description"
# → capture ID

# Set dependencies
bd dep add <child-id> <parent-id>
```

### Verify the result:

```bash
bd graph
bd ready
```

---

## Phase 5: Report to User (YOU do this directly)

**STOP HERE. Do NOT start implementation.**

Present the user with a summary:

```markdown
## Planning Complete

**Feature:** [title]
**Beads Feature ID:** [id]
**Tier:** [TRIVIAL|SMALL|MEDIUM|LARGE]

### Tasks Created

| # | Beads ID | Title | Agent | Blocked By |
|---|----------|-------|-------|------------|
| 1 | [id] | [title] | [agent] | - |
| 2 | [id] | [title] | [agent] | 1 |
| ... | | | | |

### Ready to Start (unblocked)
[list from bd ready]

### Dependency Graph
[output from bd graph]

### Artifacts Created
- .claude_docs/features/[slug]/sketch.md (or frd.md)
- .claude_docs/features/[slug]/refinement.md (if applicable)
- .claude_docs/tasks/[slug]/ (if LARGE tier)

### Next Steps
- Run `/bd-start` to begin implementation
- Run `/bd-workflow [feature]` to plan AND implement in one session
- Or manually pick tasks with `bd ready` and delegate
```

---

## Key Rules

1. **DO NOT IMPLEMENT** - This command is planning only
2. **Always pass beads IDs** to subagents
3. **Create all tasks and dependencies** before stopping
4. **Verify with `bd graph`** that the dependency tree makes sense
5. **Show the user the full plan** so they can adjust before implementation begins
