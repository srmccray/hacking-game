# Start Work Session

Begin a work session by checking beads for available work or creating new work.

## Request (optional)
$ARGUMENTS

## Instructions

**You are the ORCHESTRATOR.** Check beads for work and delegate implementation to subagents.

---

## If NO request provided:

1. **Check for existing ready work:**
   ```bash
   bd ready
   ```

2. **If work exists:**
   - Show the user the ready issues
   - Ask which one they want to work on
   - Once selected, go to "Starting Implementation" below

3. **If no work exists:**
   - Ask the user what they want to work on
   - Once they provide a request, run `/bd-workflow` with that request

---

## If request IS provided:

1. **Check if it matches existing work:**
   ```bash
   bd search "KEYWORDS"
   bd list --status=open
   ```

2. **If matching issue found:**
   - Show the issue with `bd show <id>`
   - Ask user to confirm this is what they want to work on
   - If confirmed, go to "Starting Implementation" below

3. **If no matching issue:**
   - Use `/bd-workflow` to create and plan the new feature
   - Follow that workflow completely

---

## Starting Implementation (INVOKE SUBAGENT)

Once a task is selected:

1. **Determine the parent feature:**
   ```bash
   bd show <task-id>
   ```
   Note the parent feature ID from the task's context/description.

2. **Claim the task:**
   ```bash
   bd update <task-id> --status=in_progress
   ```

3. **Use the Task tool** to invoke the appropriate implementation agent:

   ```
   Task tool parameters:
     subagent_type: "[see table below]"
     prompt: |
       Implement this task:

       BEADS_TASK_ID: <task-id>
       BEADS_FEATURE_ID: <feature-id>
       TITLE: <from bd show>
       DESCRIPTION: <from bd show>

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
   | Tests | `test-coverage` |
   | Security | `security-review` |
   | Documentation | `documentation-writer` |

4. **Process implementation output:**

   **Check "Completion Status":**
   - If **Partial**: keep task open, note what remains, skip to step 6:
     ```bash
     bd update <task-id> --notes="Partial: [what remains]"
     ```
   - If **Complete**: proceed to step 5 (Validation).

   **Check "New Tasks Discovered":**
   - Create beads issues for any follow-up work:
     ```bash
     bd create "New task title" --type=task|bug --priority=N --description="From agent output"
     ```

5. **Validate (INVOKE SUBAGENT):**

   **Use the Task tool** to invoke the `task-validator` agent:

   ```
   Task tool parameters:
     subagent_type: "task-validator"
     prompt: |
       Validate that this task has been completed successfully.

       BEADS_TASK_ID: <task-id>
       BEADS_FEATURE_ID: <feature-id>
       TASK_TITLE: <title>
       TASK_DESCRIPTION: <full description>
       ACCEPTANCE_CRITERIA: <paste from task>
       FILES_MODIFIED: <list from implementation agent>
       IMPLEMENTATION_SUMMARY: <what the agent said it did>

       Run all validation checks and verify each acceptance criterion.
   ```

   **If VERDICT: PASS** → close the task:
   ```bash
   bd close <task-id> --reason="Validated: [summary]"
   ```

   **If VERDICT: FAIL** → retry (max 2 retries):
   - Re-invoke the implementation agent with the validator's "Context for retry" section
   - Re-invoke the `task-validator` after the fix
   - If still failing after 2 retries, leave the task open:
     ```bash
     bd update <task-id> --status=open --notes="Validation failed after 2 retries: [summary]"
     ```
   - Inform the user of the persistent failure

6. **Check for more work:**
   ```bash
   bd ready
   ```
   - If more tasks, ask user if they want to continue
   - If no more tasks for the feature, close the feature issue:
     ```bash
     bd close <feature-id> --reason="Feature complete"
     ```

---

## Session End

Before ending any session:

```bash
git status
git add <files>
git commit -m "Description"
bd sync
git push
```

**Work is NOT complete until pushed.** Never stop before syncing beads and pushing.

---

## Key Rules

1. **YOU orchestrate, AGENTS implement** - Never write code directly
2. **Always validate before closing** - Every completed task goes through `task-validator` before the bead is closed
3. **Retry on failure** - Up to 2 retries with validator failure context, then inform user
4. **Always use Task tool** for implementation and validation work
5. **Always pass beads IDs** - Include `BEADS_FEATURE_ID` and `BEADS_TASK_ID` in every subagent prompt
6. **Always update beads** - claim before work, close after validation passes
7. **Process agent output** - Check "Completion Status" and "New Tasks Discovered" from implementation, check "VERDICT" from validator
8. **Beads is source of truth** - Use `bd ready` to find next work
9. **Always sync and push** before ending session
