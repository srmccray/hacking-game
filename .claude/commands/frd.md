# Create Feature Requirements Document

Create an FRD (Functional Requirements Document) for the following feature request. The depth of the FRD depends on the tier - use the appropriate template.

## Feature Request

$ARGUMENTS

## Instructions

First, determine or confirm the tier for this request:
- **SMALL tier**: Create a Quick Sketch (brief, 5-10 min)
- **MEDIUM tier**: Create a standard FRD (20-45 min)
- **LARGE tier**: Create a comprehensive FRD (1-3 hours)

If tier is not specified, infer from the request complexity or ask for clarification.

## Quick Sketch Template (SMALL tier)

Save to `.claude_docs/features/{slug}/sketch.md`:

```markdown
# Quick Sketch: {Title}

**Created:** {date}
**Tier:** SMALL

## What
{1-2 sentence description}

## Why
{Business justification}

## Approach
- {Step 1}
- {Step 2}

## Files Likely Affected
- `{path}` - {what changes}

## Considerations
- {Risks or edge cases}

## Acceptance Criteria
- [ ] {Criterion 1}
- [ ] {Criterion 2}
```

## Standard FRD Template (MEDIUM tier)

Save to `.claude_docs/features/{slug}/frd.md`:

```markdown
# FRD: {Title}

**Created:** {date}
**Tier:** MEDIUM
**Status:** Draft

## Problem Statement
{What problem are we solving? Who is affected?}

## Proposed Solution

### Overview
{High-level description}

### Key Components
1. **{Component 1}:** {Description}

## Technical Approach

### Backend Changes
- {Changes}

### Frontend Changes
- {Changes}

## Testing Strategy
- Unit tests: {scope}
- Integration tests: {scope}

## Rollback Plan
{How to undo if needed}

## Acceptance Criteria
- [ ] {Criteria}

## Open Questions
- [ ] {Questions}
```

## Comprehensive FRD Template (LARGE tier)

Save to `.claude_docs/features/{slug}/frd.md` with all sections from the frd-creator agent including:
- Executive Summary
- Detailed Problem Statement with metrics
- Full Technical Design
- Risk Assessment
- Implementation Plan with phases
- Deployment Plan with feature flags

## After Creating the FRD

1. For MEDIUM/LARGE: Suggest running `/refine {slug}` to validate against codebase
2. For LARGE: Note that task breakdown will be needed after refinement
