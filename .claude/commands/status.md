# Feature Status Report

Check the status of a feature or all in-flight features.

## Feature to Check

$ARGUMENTS

## Instructions

1. **Locate Feature Artifacts**

   If a specific feature slug is provided:
   - Check `.claude_docs/features/{slug}/` for FRD/sketch
   - Check `.claude_docs/tasks/{slug}/` for task breakdown
   - Report what exists and current state

   If no slug provided:
   - Scan `.claude_docs/features/` for all features
   - Report summary of all in-flight work

2. **Determine Current Phase**

   | Phase | Indicators |
   |-------|------------|
   | Triage | No artifacts yet |
   | FRD | `sketch.md` or `frd.md` exists, no refinement |
   | Refinement | `refinement.md` exists or in progress |
   | Breakdown | `tasks/{slug}/` directory exists |
   | Implementation | Tasks have `in_progress` status |
   | Complete | All tasks marked complete |

3. **Generate Status Report**

   ```markdown
   ## Status: {Feature Name}

   **Tier:** {TRIVIAL|SMALL|MEDIUM|LARGE}
   **Phase:** {triage|frd|refinement|breakdown|implementation|complete}
   **Health:** On Track | At Risk | Blocked

   ### Artifacts
   - [ ] Triage complete
   - [x] FRD/Sketch created: `.claude_docs/features/{slug}/frd.md`
   - [ ] Refinement complete
   - [ ] Task breakdown complete
   - [ ] Implementation complete

   ### Task Progress (if applicable)
   | # | Task | Status |
   |---|------|--------|
   | 01 | {task} | Complete |
   | 02 | {task} | In Progress |
   | 03 | {task} | Blocked by 02 |

   ### Blockers
   - {Any blocking issues}

   ### Next Actions
   1. {Recommended next step}
   ```

4. **For Multiple Features**

   ```markdown
   ## In-Flight Features

   | Feature | Tier | Phase | Health |
   |---------|------|-------|--------|
   | {name} | MEDIUM | Implementation | On Track |
   | {name} | LARGE | Refinement | At Risk |

   ### Recommended Focus
   {Which feature to prioritize and why}
   ```
