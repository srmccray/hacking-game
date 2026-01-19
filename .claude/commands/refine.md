# Refine FRD Against Codebase

Validate an existing FRD against the actual codebase to identify implementation pathways, lateral moves needed, and ensure the FRD is implementation-ready.

## Feature to Refine

$ARGUMENTS

## Instructions

1. **Locate the FRD**
   - Check `.claude_docs/features/{slug}/frd.md` or `.claude_docs/features/{slug}/sketch.md`
   - If slug not provided, list available features and ask for clarification

2. **Determine Refinement Depth**
   - **MEDIUM tier**: Light refinement (30-60 min)
     - Verify key assumptions
     - Identify main files that will change
     - Confirm no major blockers
   - **LARGE tier**: Thorough refinement (2-4 hours)
     - Deep codebase analysis
     - Identify all lateral moves (prerequisite refactoring)
     - Map dependencies between components
     - Validate technical approach against actual patterns

3. **Codebase Analysis**

   Search the codebase to validate FRD claims:
   - Do referenced models exist?
   - Do APIs follow claimed patterns?
   - Can components be reused as suggested?
   - What existing code can be leveraged?

4. **Create Refinement Document**

   Save to `.claude_docs/features/{slug}/refinement.md`:

   For MEDIUM tier:
   ```markdown
   # Refinement Notes: {Title}

   **Refined:** {date}
   **FRD:** `.claude_docs/features/{slug}/frd.md`

   ## Verified Assumptions
   - {Assumption} - confirmed at `{file:line}`

   ## Corrections Needed
   - {FRD says X, but code shows Y}

   ## Key Files
   - `{path}` - {action: modify/create}

   ## Ready for Implementation
   - [x] Assumptions validated
   - [ ] {Any remaining items}
   ```

   For LARGE tier, include:
   - Detailed backend/frontend analysis tables
   - Lateral moves required with effort estimates
   - Implementation pathway options
   - Risk validation
   - Reusable assets identified

5. **Next Steps**
   - MEDIUM: Ready to route to implementation agents
   - LARGE: Suggest running `/breakdown {slug}` for task decomposition
