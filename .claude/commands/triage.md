# Request Triage

Perform a SWAG (Scientific Wild-Ass Guess) assessment on the following request to determine complexity, risk, and the appropriate workflow tier.

## Request to Triage

$ARGUMENTS

## Instructions

1. **Assess Complexity (1-10)**
   - Technical Complexity: How difficult? How familiar is the domain?
   - Scope: How many files/modules affected?
   - Volatility: How likely are requirements to change?
   - Completeness: How well-defined is the request?

2. **Assess Risk (1-10)**
   - Impact: What happens if something goes wrong?
   - Probability: How likely are issues?
   - Blast Radius: How many systems/users affected?

3. **Select Tier**
   - TRIVIAL: Complexity <=3 AND Risk <=3
   - SMALL: (Complexity <=3, Risk 4-6) OR (Complexity 4-6, Risk <=3)
   - MEDIUM: Complexity OR Risk is 4-6 (neither both low)
   - LARGE: Complexity >=7 OR Risk >=7

4. **Auto-Escalate to LARGE if any apply:**
   - Database schema changes
   - Authentication/authorization changes
   - External API contract changes
   - Security-sensitive functionality
   - Infrastructure/deployment changes

5. **Output the assessment in this format:**

```markdown
## Triage Assessment: {title}

### Scores
| Factor | Score | Rationale |
|--------|-------|-----------|
| Technical Complexity | X/10 | {reason} |
| Scope | X/10 | {reason} |
| Volatility | X/10 | {reason} |
| Completeness | X/10 | {reason} |
| **Complexity Average** | **X/10** | |
| Impact | X/10 | {reason} |
| Probability | X/10 | {reason} |
| Blast Radius | X/10 | {reason} |
| **Risk Average** | **X/10** | |

### Tier: {TRIVIAL|SMALL|MEDIUM|LARGE}

### Recommended Workflow
{Description of next steps based on tier}

### Questions/Blockers
{Any clarifications needed before proceeding}
```
