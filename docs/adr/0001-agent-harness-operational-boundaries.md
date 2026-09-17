# 1. Agent Harness Operational Boundaries & Development Rules

Date: 2026-08-03

## Status

Accepted

## Context

During development, AI agents were exhibiting "Agent Thrashing and Scope Creep" by taking extreme liberties: rewriting entire files or pages to address localized bugs, crossing architectural boundaries (modifying backend APIs or database pipelines during UI tasks), and injecting synthetic/mock data fallbacks into frontend code when APIs returned empty feeds. This led to loss of control over the codebase, broken working features, and masked backend issues.

## Decision

We decided to strictly enforce four core constraints and operational boundaries across all agent interactions in this repository:

1. **'Patch, Don't Rewrite' Directive:** Agents are explicitly forbidden from rewriting entire components, pages, or functions to solve a bug. They must diagnose the specific line or block causing the issue and apply a targeted, surgical patch.
2. **Strict Architectural Boundaries & Hard-Stop Protocol:** Agents must respect separation of concerns. If a task assigned to one domain (e.g., Frontend/UI) requires changes in another (e.g., Backend API, Prisma schema), the agent MUST halt execution, state the missing dependency/blocker, output a multi-domain Execution Plan, and wait for explicit written authorization.
3. **Zero-Tolerance for Mock Data Fallbacks:** Agents are strictly forbidden from adding, injecting, or leaving fake data, hardcoded fallback arrays, static JSON, or sample props. When data is missing, the UI must render an explicit, clean Empty/Error state component (e.g., `<NoLiveMeetings />` or `"Awaiting Data Feed"`).
4. **Execution Checkpoint Thresholds:**
   - 🟢 **GREEN LIGHT (Execute Immediately):** Single-file, non-structural bug fixes or localized surgical patches within domain boundaries can be executed immediately.
   - 🔴 **RED LIGHT (Mandatory Checkpoint):** Multi-file changes, structural refactors, data pipeline modifications, or cross-boundary tasks require halting execution, outputting a step-by-step Execution Plan, and awaiting explicit written approval.

## Consequences

- **Pros:** Eliminates scope creep, prevents agent-induced codebase thrashing, ensures backend API issues are surfaced and fixed directly rather than hidden behind mock data, and maintains clear domain boundaries.
- **Cons:** Slightly increases friction for multi-file tasks due to required user checkpoint authorization, but drastically increases architectural safety and predictability.
