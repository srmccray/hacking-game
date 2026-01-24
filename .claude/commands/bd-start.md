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

1. **Claim the task:**
   ```bash
   bd update <task-id> --status=in_progress
   ```

2. **Get full task details:**
   ```bash
   bd show <task-id>
   ```

3. **Use the Task tool** to invoke the appropriate implementation agent:

   ```
   Task tool parameters:
     subagent_type: "[see table below]"
     prompt: |
       Implement this task:

       TASK ID: <task-id>
       TITLE: <from bd show>
       DESCRIPTION: <from bd show>

       After implementation:
       - List files created/modified
       - Note any issues or follow-up work needed
       - Confirm the task is complete
   ```

   | This Project's Domains | Agent |
   |------------------------|-------|
   | Core game (TypeScript, state, resources) | `backend-implementation` |
   | UI (PixiJS, rendering, HUD, scenes) | `frontend-implementation` |
   | Tests | `test-coverage` |

4. **After agent returns**, verify and close:
   ```bash
   bd close <task-id> --reason="Summary of what was done"
   ```

5. **Check for more work:**
   ```bash
   bd ready
   ```
   - If more tasks, ask user if they want to continue
   - If no more tasks for the feature, close the feature issue

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

---

## Key Rules

1. **YOU orchestrate, AGENTS implement** - Never write code directly
2. **Always use Task tool** for implementation work
3. **Always update beads** - claim before work, close after work
4. **Always sync and push** before ending session
