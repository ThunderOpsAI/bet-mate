# Verify Skill Glossary

This glossary contains definitions for key concepts referenced in the `verify` skill. These definitions ensure a consistent, predictable approach to planning and verifying orchestrator work.

## Clarifying Loop
A focused, interactive question-and-answer cycle with the user. The goal is to surface unstated requirements and constraints before writing any code. A successful clarifying loop asks one tightly scoped question (or a small batch of related questions) at a time, avoiding overwhelming the user. The loop terminates only when the goal, success criteria, and constraints are explicit and unambiguous.

## Phase Gates
Explicit checkpoints within a prompt where the orchestrator must stop execution, output its progress, and wait for human review before proceeding to the next phase. Phase gates prevent compounding errors in complex tasks (e.g., stopping after a database schema is generated to ensure it is correct before writing the API routes that depend on it).

## Architectural Fork
A critical decision point in the implementation plan where multiple valid technical paths exist (e.g., choosing between server-side rendering vs. client-side fetching, or choosing between two different state management patterns). All architectural forks must be explicitly identified and resolved with the user during the **Clarifying Loop** before writing the orchestrator prompt.

## Verifiable Done
A success criterion that can be objectively confirmed by reading code, running a test, or observing a specific output. "The code is robust" is not verifiable; "The form handles 500 errors by displaying a red toast notification" is verifiable. The orchestrator's prompt must demand work that yields a verifiable state.
