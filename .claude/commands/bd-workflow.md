# Beads Workflow

Orchestrate a feature request using beads for task tracking and specialized agents for execution.

## Request
$ARGUMENTS

## Instructions

**You are the ORCHESTRATOR.** Your role is to:
1. Manage beads state (create issues, update status, set dependencies)
2. Invoke subagents via the **Task tool** for actual work
3. Process subagent results and continue the workflow
4. **NEVER do implementation work directly** - always delegate to subagents

---

## Phase 1: Initialize Tracking (YOU do this directly)

Run these commands yourself:

```bash
bd ready        # Check for existing work
bd list         # Check for duplicates
```

If no duplicate exists, create the feature issue:

```bash
bd create "FEATURE_TITLE" --type=feature --priority=2 --description="DESCRIPTION"
```

**Save the issue ID** (e.g., `hacking-game-abc`) - you'll need it throughout.

---

## Phase 2: Triage (INVOKE SUBAGENT)

**Use the Task tool** to invoke the `request-triage` agent:

```
Task tool parameters:
  subagent_type: "request-triage"
  prompt: |
    Triage this feature request and return a structured assessment.

    REQUEST: [paste the user's request]

    Return your assessment in this exact format:

    TIER: [TRIVIAL|SMALL|MEDIUM|LARGE]
    COMPLEXITY: [1-10]
    RISK: [1-10]
    RATIONALE: [brief explanation]
    RECOMMENDED_AGENTS: [comma-separated list of agents needed]
```

**After the agent returns**, update beads with the results:

```bash
bd update <feature-id> --notes="Tier: X. Complexity: Y, Risk: Z"
```

**Then follow the tier-specific path:**

| Tier | Next Phase |
|------|------------|
| TRIVIAL | Skip to Phase 4 (Task Creation) - create single implementation task |
| SMALL | Go to Phase 3a (Quick Sketch) |
| MEDIUM | Go to Phase 3b (Standard FRD) |
| LARGE | Go to Phase 3c (Full FRD + Breakdown) |

---

## Phase 3a: Quick Sketch - SMALL tier (INVOKE SUBAGENT)

**Use the Task tool** to invoke the `frd-creator` agent:

```
Task tool parameters:
  subagent_type: "frd-creator"
  prompt: |
    Create a Quick Sketch for this SMALL tier feature.

    REQUEST: [paste request]
    FEATURE_ID: [beads issue ID]

    Output to: .claude_docs/features/[slug]/sketch.md

    Return a summary of:
    - Key implementation points
    - Suggested task breakdown (list of tasks)
    - Any dependencies between tasks
```

**After agent returns**, proceed to Phase 4.

---

## Phase 3b: Standard FRD - MEDIUM tier (INVOKE SUBAGENT)

**Use the Task tool** to invoke the `frd-creator` agent:

```
Task tool parameters:
  subagent_type: "frd-creator"
  prompt: |
    Create a standard FRD for this MEDIUM tier feature.

    REQUEST: [paste request]
    FEATURE_ID: [beads issue ID]

    Output to: .claude_docs/features/[slug]/frd.md

    Return a summary of:
    - Core requirements
    - Suggested task breakdown (list of tasks with descriptions)
    - Dependencies between tasks
    - Recommended implementation agents for each task
```

**Optionally invoke `frd-refiner`** for light refinement, then proceed to Phase 4.

---

## Phase 3c: Full FRD + Breakdown - LARGE tier (INVOKE SUBAGENTS)

**Step 1:** Use Task tool to invoke `frd-creator`:
```
Task tool parameters:
  subagent_type: "frd-creator"
  prompt: |
    Create a comprehensive FRD for this LARGE tier feature.
    REQUEST: [paste request]
    Output to: .claude_docs/features/[slug]/frd.md
```

**Step 2:** Use Task tool to invoke `frd-refiner`:
```
Task tool parameters:
  subagent_type: "frd-refiner"
  prompt: |
    Perform thorough refinement on the FRD at .claude_docs/features/[slug]/frd.md
    Validate against codebase, identify implementation pathways.
```

**Step 3:** Use Task tool to invoke `frd-task-breakdown`:
```
Task tool parameters:
  subagent_type: "frd-task-breakdown"
  prompt: |
    Break down the refined FRD into implementation tasks.

    Return tasks in this format:
    TASK 1: [title]
    DESCRIPTION: [what needs to be done]
    AGENT: [recommended agent]
    DEPENDS_ON: [task numbers this depends on, or "none"]

    TASK 2: ...
```

**After agent returns**, proceed to Phase 4.

---

## Phase 4: Create Beads Tasks (YOU do this directly)

Based on the task breakdown from Phase 3 (or your own analysis for TRIVIAL), create beads issues:

```bash
# Create each task
bd create "Task title 1" --type=task --priority=2 --description="Description"
# → hacking-game-xxx

bd create "Task title 2" --type=task --priority=2 --description="Description"
# → hacking-game-yyy

# Set up dependencies (child depends on parent)
bd dep add <child-id> <parent-id>
```

**Record the mapping** of task IDs to their descriptions for the implementation phase.

---

## Phase 5: Implementation Loop (INVOKE SUBAGENTS)

**For each ready task:**

1. **Find ready work:**
   ```bash
   bd ready
   ```

2. **Claim the task:**
   ```bash
   bd update <task-id> --status=in_progress
   ```

3. **Use the Task tool** to invoke the appropriate implementation agent:

   ```
   Task tool parameters:
     subagent_type: "[agent-from-table-below]"
     prompt: |
       Implement this task:

       TASK ID: [beads task ID]
       TITLE: [task title]
       DESCRIPTION: [full task description]
       CONTEXT: [any relevant context from FRD or previous tasks]

       After implementation:
       - List files created/modified
       - Note any issues or follow-up work needed
       - Confirm the task is complete or explain what remains
   ```

   | Domain | Agent |
   |--------|-------|
   | TypeScript, game logic, state | `backend-implementation` |
   | UI, PixiJS, rendering | `frontend-implementation` |
   | Build, deployment | `infrastructure-implementation` |
   | Security | `security-review` |
   | Testing | `test-coverage` |

4. **After agent returns**, verify and close:
   ```bash
   # If successful:
   bd close <task-id> --reason="Brief summary of what was done"

   # If issues found, create follow-up:
   bd create "Fix issue X" --type=bug --priority=1
   ```

5. **Repeat** for each task until all are complete.

6. **Close the feature:**
   ```bash
   bd close <feature-id> --reason="Feature complete: summary"
   ```

---

## Phase 6: Session End (YOU do this directly)

**CRITICAL - Always run before ending:**

```bash
git status
git add <files>
git commit -m "Description of changes"
bd sync
git push
```

---

## Key Rules

1. **YOU orchestrate, AGENTS implement** - Never write implementation code directly
2. **Always use Task tool** for exploration, triage, FRD creation, and implementation
3. **Always update beads** after each phase completes
4. **Track task IDs** - You need them to set dependencies and close tasks
5. **Verify agent work** - Check that agents completed their tasks before closing beads issues

## Subagent Invocation Pattern

Every time you need work done, use this pattern:

```
<use Task tool>
  subagent_type: "agent-name"
  prompt: "Clear instructions with all context needed"
</use Task tool>

<wait for agent result>

<process result>
  - Update beads
  - Determine next step
  - Continue workflow
</process result>
```
