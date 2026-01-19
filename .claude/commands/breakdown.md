# Task Breakdown

Convert a refined FRD into structured, actionable task documents with clear dependencies and acceptance criteria.

## Feature to Break Down

$ARGUMENTS

## Instructions

1. **Locate Inputs**
   - FRD: `.claude_docs/features/{slug}/frd.md`
   - Refinement: `.claude_docs/features/{slug}/refinement.md`
   - If not found, note what's missing

2. **Identify Work Units**

   Break down into tasks that are:
   - **Atomic**: Can be completed independently (after dependencies met)
   - **Testable**: Has clear acceptance criteria
   - **Sized appropriately**: Small (hours), Medium (1-2 days), Large (2-5 days max)

3. **Map Dependencies**
   - Which tasks block others?
   - What can run in parallel?
   - What is the critical path?

4. **Assign to Implementation Domains**
   - `backend`: FastAPI endpoints, services, models
   - `frontend`: React components, state, UI
   - `infrastructure`: AWS infrastructure, CDK, Lambda
   - `migrations`: Database schema changes
   - `testing`: Test coverage

5. **Create Task Documents**

   Create `.claude_docs/tasks/{slug}/_index.md`:

   ```markdown
   # Task Breakdown: {Title}

   **FRD:** `.claude_docs/features/{slug}/frd.md`
   **Created:** {date}
   **Status:** Ready

   ## Summary
   {1-2 sentence summary}

   ## Task Overview

   | # | Task | Domain | Status | Blocked By |
   |---|------|--------|--------|------------|
   | 01 | {task} | backend | Not Started | - |
   | 02 | {task} | backend | Not Started | 01 |

   ## Dependency Graph
   ```
   task-01 --> task-02 --> task-04
           \-> task-03 -/
   ```

   ## Critical Path
   task-01 -> task-02 -> task-04
   ```

   Create `.claude_docs/tasks/{slug}/task-{nn}-{name}.md` for each task:

   ```markdown
   # Task {NN}: {Title}

   **Feature:** {slug}
   **Domain:** {backend|frontend|infrastructure|migrations|testing}
   **Status:** Not Started
   **Blocked By:** {task numbers or "None"}

   ## Objective
   {What this task accomplishes}

   ## Scope
   ### In Scope
   - {Deliverable}

   ### Out of Scope
   - {What this does NOT include}

   ## Key Files
   | File | Action | Notes |
   |------|--------|-------|
   | `{path}` | Create/Modify | {notes} |

   ## Acceptance Criteria
   - [ ] {Criterion}
   - [ ] Tests passing
   ```

6. **Report Completion**
   - List all tasks created
   - Identify first actionable task(s)
   - Note parallel opportunities
