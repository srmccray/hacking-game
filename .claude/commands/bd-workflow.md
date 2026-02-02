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
    BEADS_FEATURE_ID: [the beads issue ID from Phase 1]

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
    BEADS_FEATURE_ID: [beads issue ID]
    TIER: SMALL

    Output to: .claude_docs/features/[slug]/sketch.md

    Return a summary of:
    - Key implementation points
    - A "Suggested Tasks (for beads)" table with columns: #, Title, Agent, Depends On
    - Any dependencies between tasks
```

**After agent returns:**
1. Extract the "Suggested Tasks" table from the agent's output
2. Proceed to Phase 4 using those tasks

---

## Phase 3b: Standard FRD - MEDIUM tier (INVOKE SUBAGENTS)

**Step 1:** Use Task tool to invoke `frd-creator`:

```
Task tool parameters:
  subagent_type: "frd-creator"
  prompt: |
    Create a standard FRD for this MEDIUM tier feature.

    REQUEST: [paste request]
    BEADS_FEATURE_ID: [beads issue ID]
    TIER: MEDIUM

    Output to: .claude_docs/features/[slug]/frd.md

    Return a summary of:
    - Core requirements
    - Suggested task breakdown (list of tasks with descriptions)
    - Dependencies between tasks
    - Recommended implementation agents for each task
```

**Step 2:** Use Task tool to invoke `frd-refiner` for light refinement:

```
Task tool parameters:
  subagent_type: "frd-refiner"
  prompt: |
    Perform light refinement on the FRD at .claude_docs/features/[slug]/frd.md
    Validate against codebase, identify key files.

    BEADS_FEATURE_ID: [beads issue ID]
    TIER: MEDIUM

    Include a "Suggested Tasks (for beads)" table with columns: #, Title, Agent, Depends On, Description
```

**After agent returns:**
1. Update beads: `bd update <feature-id> --notes="FRD + refinement complete"`
2. Extract the "Suggested Tasks" table from the refiner's output
3. Proceed to Phase 4 using those tasks

---

## Phase 3c: Full FRD + Breakdown - LARGE tier (INVOKE SUBAGENTS)

**Step 1:** Use Task tool to invoke `frd-creator`:
```
Task tool parameters:
  subagent_type: "frd-creator"
  prompt: |
    Create a comprehensive FRD for this LARGE tier feature.
    REQUEST: [paste request]
    BEADS_FEATURE_ID: [beads issue ID]
    TIER: LARGE
    Output to: .claude_docs/features/[slug]/frd.md
```

**Step 2:** Use Task tool to invoke `frd-refiner`:
```
Task tool parameters:
  subagent_type: "frd-refiner"
  prompt: |
    Perform thorough refinement on the FRD at .claude_docs/features/[slug]/frd.md
    Validate against codebase, identify implementation pathways and lateral moves.
    BEADS_FEATURE_ID: [beads issue ID]
    TIER: LARGE
```

**Step 3:** Use Task tool to invoke `frd-task-breakdown`:
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

    The script should be directly runnable by the orchestrator.
```

**After agent returns:**
1. Update beads: `bd update <feature-id> --notes="Task breakdown complete"`
2. The agent will provide a "Beads Task Creation Script" — run those commands directly in Phase 4
3. Proceed to Phase 4

---

## Phase 4: Create Beads Tasks (YOU do this directly)

### For LARGE tier (from frd-task-breakdown output):

The `frd-task-breakdown` agent provides a "Beads Task Creation Script" with pre-formatted `bd create` and `bd dep add` commands. Run them directly, capturing the returned IDs.

### For TRIVIAL/SMALL/MEDIUM tier (from sketch/FRD/refinement output):

Create beads issues from the "Suggested Tasks" table:

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

**Verify the dependency graph:**
```bash
bd graph
```

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

3. **Get task details:**
   ```bash
   bd show <task-id>
   ```

4. **Use the Task tool** to invoke the appropriate implementation agent:

   ```
   Task tool parameters:
     subagent_type: "[agent-from-table-below]"
     prompt: |
       Implement this task:

       BEADS_TASK_ID: [beads task ID]
       BEADS_FEATURE_ID: [beads feature ID]
       TITLE: [task title]
       DESCRIPTION: [full task description]
       CONTEXT: [any relevant context from FRD, refinement, or previous tasks]

       After implementation, include in your output:
       1. A "Completion Status" section (Complete or Partial with explanation)
       2. List of files created/modified
       3. A "New Tasks Discovered" section listing any follow-up work needed
   ```

   ### Agent Routing (this project)

   | Domain | Agent |
   |--------|-------|
   | TypeScript, game logic, state, resources | `backend-implementation` |
   | UI, PixiJS, rendering, HUD, scenes | `frontend-implementation` |
   | Build, deployment | `infrastructure-implementation` |
   | Security | `security-review` |
   | Testing | `test-coverage` |
   | Documentation | `documentation-writer` |

5. **Process implementation output:**

   **Check "Completion Status":**
   - If **Partial**: keep task open, log what remains, move to next task:
     ```bash
     bd update <task-id> --notes="Partial: [what remains]"
     ```
   - If **Complete**: proceed to step 6 (Validation).

   **Check "New Tasks Discovered":**
   - Create beads issues for any follow-up work:
     ```bash
     bd create "New task title" --type=task|bug --priority=N --description="From agent output"
     bd dep add <new-task-id> <blocking-task-id>
     ```

6. **Validate (INVOKE SUBAGENT):**

   **Use the Task tool** to invoke the `task-validator` agent:

   ```
   Task tool parameters:
     subagent_type: "task-validator"
     prompt: |
       Validate that this task has been completed successfully.

       BEADS_TASK_ID: [beads task ID]
       BEADS_FEATURE_ID: [beads feature ID]
       TASK_TITLE: [title]
       TASK_DESCRIPTION: [full description]
       ACCEPTANCE_CRITERIA: [paste acceptance criteria from task]
       FILES_MODIFIED: [list from implementation agent output]
       IMPLEMENTATION_SUMMARY: [what the implementation agent said it did]

       Run all validation checks and verify each acceptance criterion.
   ```

   **If VERDICT: PASS** → close the task:
   ```bash
   bd close <task-id> --reason="Validated: [summary]"
   ```

   **If VERDICT: FAIL** → retry (max 2 retries):
   - Re-invoke the implementation agent with the validator's "Context for retry" section
   - Re-invoke the `task-validator` after the fix
   - If still failing after 2 retries, leave the task open and move on:
     ```bash
     bd update <task-id> --status=open --notes="Validation failed after 2 retries: [summary]"
     ```

7. **Repeat** for each task until all are complete.

8. **Close the feature:**
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

**Work is NOT complete until pushed.** Never stop before syncing beads and pushing.

---

## Key Rules

1. **YOU orchestrate, AGENTS implement** - Never write implementation code directly
2. **Always validate before closing** - Every completed task goes through `task-validator` before the bead is closed
3. **Retry on failure** - Up to 2 retries with validator failure context, then skip and move on
4. **Always use Task tool** for exploration, triage, FRD creation, implementation, and validation
5. **Always pass beads IDs** - Include `BEADS_FEATURE_ID` in every subagent prompt, and `BEADS_TASK_ID` for implementation/validation agents
6. **Always update beads** after each phase completes
7. **Track task IDs** - You need them to set dependencies and close tasks
8. **Process agent output** - Check "Completion Status" and "New Tasks Discovered" from implementation agents, check "VERDICT" from validator
9. **Beads is source of truth** - Use `bd ready` to find next work, not markdown status

## Subagent Invocation Pattern

Every time you need work done, use this pattern:

```
<invoke implementation agent>
  subagent_type: "agent-name"
  prompt: "...including BEADS_FEATURE_ID and BEADS_TASK_ID"

<process implementation result>
  - Check Completion Status (if Partial, skip validation)
  - Create beads issues for New Tasks Discovered

<invoke task-validator>
  subagent_type: "task-validator"
  prompt: "...with acceptance criteria and files modified"

<process validation result>
  - PASS → bd close <task-id>
  - FAIL → retry implementation with "Context for retry" (max 2 retries)
  - After retries exhausted → leave open, move on

<next task>
  - bd ready → pick next → repeat
```
