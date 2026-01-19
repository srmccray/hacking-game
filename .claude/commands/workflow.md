# Workflow Orchestration

Orchestrate a feature request through the complete graduated workflow.

## Request
$ARGUMENTS

## Instructions

Invoke the `workflow-orchestrator` agent with this request. The orchestrator will analyze the request and return a recommendation for which agent to invoke next.

**Important:** You are the executor in this workflow. Your role is to:
1. Invoke the `workflow-orchestrator` agent with the request above
2. Follow its recommendation to invoke the next agent
3. After that agent completes, follow ITS recommendation for the next agent
4. Repeat until the workflow is complete

**Do not do work directly.** All exploration, FRD creation, refinement, and implementation should be done by specialized agents. You only coordinate by invoking the agents they recommend.

Begin by invoking the `workflow-orchestrator` agent now.
