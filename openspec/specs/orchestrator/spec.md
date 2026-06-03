# Orchestrator

## Purpose

Defines the special agent workflow for planning, dispatching, and aggregating multi-agent tasks. Detailed flow lives in `specs/06-orchestrator-flow.md`.

## Requirements

### Requirement: Orchestrator SHALL be a normal Agent

The orchestrator MUST run through AgentRunner and an adapter like any other agent; it SHALL not have a separate service path.

#### Scenario: User starts a group task
- **WHEN** the conversation includes an orchestrator
- **THEN** AgentRunner executes it as an agent run
- **AND** uses orchestrator-specific prompts and tools.

### Requirement: Orchestrator SHALL plan before dispatch

The orchestration flow MUST produce a validated task plan before launching child agent runs.

#### Scenario: Plan tool is called
- **WHEN** the orchestrator calls `plan_tasks`
- **THEN** AgentRunner parses and validates task ids, agent ids, dependencies, and acyclicity.

### Requirement: Child tasks SHALL respect dependency order

AgentRunner MUST execute dispatch tasks as a DAG and skip dependent tasks when prerequisites fail.

#### Scenario: Upstream task fails
- **WHEN** a task dependency ends with status `failed`
- **THEN** dependent tasks are skipped
- **AND** dispatch events include the blocking reason.

### Requirement: Aggregation SHALL summarize child outputs

After child tasks finish, the orchestrator MUST run an aggregate stage that sees task results and produces the final response.

#### Scenario: All child tasks complete
- **WHEN** the DAG has no remaining runnable tasks
- **THEN** AgentRunner builds an aggregate prompt
- **AND** runs the orchestrator without `plan_tasks`.
