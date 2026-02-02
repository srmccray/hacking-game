# Grind Beads Backlog

Autonomously work through all ready beads tasks without stopping to ask. Keeps going until the backlog is empty or a blocking error occurs.

## Scope (optional)
$ARGUMENTS

## Instructions

**You are the ORCHESTRATOR.** Your job is to continuously pull ready tasks from beads and delegate them to subagents until nothing remains. Do NOT ask the user for confirmation between tasks — just keep going.

---

## Phase 1: Survey the Backlog (YOU do this directly)

```bash
bd ready
bd list --status=open
bd stats
```

### If $ARGUMENTS provided (scope filter):
- If it looks like a beads ID (e.g. `hacking-game-abc`), filter to tasks under that feature
- If it looks like a keyword, use `bd search "KEYWORD"` to find matching issues
- Only work on tasks matching the scope

### If no arguments:
- Work through ALL ready tasks across all features, ordered by priority then ID

**Show the user what you found:**

```markdown
## Grind Session Starting

**Ready tasks:** [N]
**Scope:** [all | feature: id | search: keyword]

| # | Beads ID | Title | Priority |
|---|----------|-------|----------|
| 1 | [id] | [title] | [priority] |
| 2 | [id] | [title] | [priority] |
| ... | | | |

Starting work...
```

If no ready tasks exist, inform the user and suggest `/bd-plan` to create some.

---

## Phase 2: Grind Loop (REPEAT until backlog empty)

For each iteration:

### Step 1: Pick the next task

```bash
bd ready
```

Pick the highest-priority unblocked task. If multiple tasks share the same priority, pick the lowest ID (oldest first). If scoped to a feature, only pick tasks under that feature.

If `bd ready` returns nothing, go to Phase 3 (Wrap Up).

### Step 2: Claim it

```bash
bd show <task-id>
bd update <task-id> --status=in_progress
```

### Step 3: Delegate to subagent

**Use the Task tool** to invoke the appropriate implementation agent:

```
Task tool parameters:
  subagent_type: "[agent-from-table-below]"
  prompt: |
    Implement this task:

    BEADS_TASK_ID: [beads task ID]
    BEADS_FEATURE_ID: [parent feature ID]
    TITLE: [task title]
    DESCRIPTION: [full task description from bd show]
    CONTEXT: [any relevant context — FRD location, previous task outputs, etc.]

    After implementation, include in your output:
    1. A "Completion Status" section (Complete or Partial with explanation)
    2. List of files created/modified
    3. A "New Tasks Discovered" section listing any follow-up work needed
```

### Agent Routing (this project)

| Domain | Agent |
|--------|-------|
| Core game (TypeScript, state, resources) | `backend-implementation` |
| UI (PixiJS, rendering, HUD, scenes) | `frontend-implementation` |
| Build, deployment | `infrastructure-implementation` |
| Tests | `test-coverage` |
| Security | `security-review` |
| Documentation | `documentation-writer` |

### Step 4: Process implementation output

**Check "Completion Status":**
- **Partial** → keep task open, log what remains, and continue to next task:
  ```bash
  bd update <task-id> --notes="Partial: [what remains]"
  ```
  Skip validation — proceed to Step 7.
- **Complete** → proceed to Step 5 (Validation).

**Check "New Tasks Discovered":**
- Create beads issues for any follow-up work:
  ```bash
  bd create "New task title" --type=task|bug --priority=N --description="..."
  bd dep add <new-id> <blocking-id>   # if dependency needed
  ```

### Step 5: Validate (INVOKE SUBAGENT)

**Use the Task tool** to invoke the `task-validator` agent:

```
Task tool parameters:
  subagent_type: "task-validator"
  prompt: |
    Validate that this task has been completed successfully.

    BEADS_TASK_ID: [beads task ID]
    BEADS_FEATURE_ID: [parent feature ID]
    TASK_TITLE: [title]
    TASK_DESCRIPTION: [full description from bd show]
    ACCEPTANCE_CRITERIA: [paste acceptance criteria from task description or FRD]
    FILES_MODIFIED: [list from implementation agent output]
    IMPLEMENTATION_SUMMARY: [what the implementation agent said it did]

    Run all validation checks (TypeScript, lint, build, unit tests, e2e tests)
    and verify each acceptance criterion against the actual code.
```

**Process the validator's output:**

- **VERDICT: PASS** → close the task and proceed to Step 6:
  ```bash
  bd close <task-id> --reason="Validated: [summary]"
  ```

- **VERDICT: FAIL** → enter retry loop (Step 5a)

### Step 5a: Retry Loop (max 2 retries)

Track retry count per task. On FAIL:

1. **Re-invoke the implementation agent** with the validator's failure context:

   ```
   Task tool parameters:
     subagent_type: "[same agent as Step 3]"
     prompt: |
       RETRY: Fix validation failures for this task.

       BEADS_TASK_ID: [beads task ID]
       BEADS_FEATURE_ID: [parent feature ID]
       TITLE: [title]
       DESCRIPTION: [full description]
       RETRY_ATTEMPT: [1 or 2]

       VALIDATION FAILURES:
       [paste the "Context for retry" section from the validator output]

       Fix these specific issues. After fixing, include in your output:
       1. A "Completion Status" section
       2. List of files created/modified
       3. A "New Tasks Discovered" section
   ```

2. **Re-invoke the `task-validator`** with the same parameters as Step 5.

3. **If PASS** → close task, continue to Step 6.

4. **If FAIL again and retries exhausted (2 retries used):**
   - Do NOT close the task
   - Log the persistent failure:
     ```bash
     bd update <task-id> --status=open --notes="Validation failed after 2 retries: [summary of failures]"
     ```
   - Skip this task and continue to Step 7

### Step 6: Post-task housekeeping

**Periodic commit** — after every **3 validated tasks** (or after any task that produced significant changes):

```bash
git add <files modified in recent tasks>
git commit -m "Implement: [brief summary of recent tasks]"
```

**Check if feature is done** — after closing a task, check if all tasks for its parent feature are now closed:

```bash
bd list --status=open | grep <feature-related-prefix>
```

If no open tasks remain for a feature, close it:

```bash
bd close <feature-id> --reason="All tasks complete"
```

### Step 7: Loop back to Step 1

---

## Phase 3: Wrap Up (YOU do this directly)

When `bd ready` returns no tasks:

```bash
git status
git add <files>
git commit -m "Complete beads grind session: [summary]"
bd sync
git push
```

**Report to the user:**

```markdown
## Grind Session Complete

### Tasks Completed
| # | Beads ID | Title | Validation | Retries |
|---|----------|-------|------------|---------|
| 1 | [id] | [title] | PASS | 0 |
| 2 | [id] | [title] | PASS | 1 |
| 3 | [id] | [title] | Partial — skipped validation | - |

### Validation Failed (needs manual attention)
| Beads ID | Title | Retries Used | Failure Summary |
|----------|-------|--------------|-----------------|
| [id] | [title] | 2 | [what keeps failing] |

### Features Closed
- [feature-id]: [title]

### New Tasks Created (discovered during work)
- [id]: [title]

### Still Open (if any)
- [id]: [title] — [reason: partial, blocked, validation failed, etc.]

### Commits Made
- [hash]: [message]
- [hash]: [message]
```

---

## Error Handling

### If an implementation agent fails or returns an error:
1. Do NOT stop the entire grind
2. Log the failure on the beads task:
   ```bash
   bd update <task-id> --status=open --notes="Agent error: [brief description]"
   ```
3. Move on to the next ready task
4. Include the failure in the final report

### If the validator agent fails or returns an error:
1. Treat it as a validation FAIL for retry purposes
2. If the validator itself errors (not a task failure), log it and skip validation for that task
3. Close the task with a note that validation was skipped:
   ```bash
   bd close <task-id> --reason="Complete (validation skipped: validator error)"
   ```

### If a task fails validation after 2 retries:
1. Leave the task open with failure notes
2. Skip it for the rest of the session
3. Flag it in the final report as needing manual attention

### If no tasks were ready from the start:
- Inform user: "No ready tasks. Run `/bd-plan` to create work, or check `bd blocked` for dependency issues."

---

## Key Rules

1. **DO NOT ASK** between tasks — just keep going
2. **YOU orchestrate, AGENTS implement** — never write code directly
3. **Always validate** — every completed task goes through `task-validator` before closing
4. **Retry on failure** — up to 2 retries with validator failure context, then skip
5. **Always pass beads IDs** — `BEADS_FEATURE_ID` and `BEADS_TASK_ID` in every prompt
6. **Commit periodically** — every 3 validated tasks or after significant changes
7. **Process agent output** — always check Completion Status and New Tasks Discovered
8. **Handle errors gracefully** — skip and continue, don't halt the session
9. **Close features** when all their tasks are done
10. **Sync and push** before ending — work is not done until pushed
11. **Beads is source of truth** — use `bd ready` to determine next work, not markdown files
