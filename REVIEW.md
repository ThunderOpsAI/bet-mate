# Review instructions

Use this file for review-specific guidance. Read the repo's `AGENTS.md`, `CLAUDE.md`, and applicable spec or task description when present. Apply only rules that fit the changed code and the repo's actual stack. Never treat a missing optional document as a defect.

## Review goals

- Find demonstrable bugs, security issues, regressions, data risks, and violations of explicit repo policy. Show the file, line, and evidence for each finding.
- Review the diff against the task and relevant code paths. Ignore style preferences and anything tooling already enforces.
- Keep findings to one per root cause. State the likely impact and a concrete fix. If no issues are supported by evidence, say so briefly.
- Treat this review as input to a decision. An automated review does not count as human approval or change merge permissions.

## Severity

- `[BLOCKER]` — demonstrable security vulnerability, correctness failure, data loss/corruption risk, required check failure, or breach of an explicit repo rule. Request changes until fixed or explicitly waived.
- `[WARN]` — credible risk or unresolved spec/design choice without demonstrated breakage. Explain the uncertainty and ask for a decision when needed.
- `[NOTE]` — optional observation; at most three per review.

Use `REQUEST CHANGES` only when there is a blocker. Use `NEEDS DECISION` when a product or design choice must be resolved. Otherwise use `APPROVE`, listing any warnings.

## Check the changed behavior

First identify affected layers and apply only relevant checks:

- **Security and correctness:** trace important inputs, authorization, error paths, state changes, and boundary cases. Check for exposed secrets, injection, unsafe access, misleading fake data, and failures hidden without logging, propagation, or user feedback.
- **UI and API:** check async states where the changed behavior can load or fail, boundary validation using repo conventions, appropriate user feedback, and errors that do not expose internals.
- **Data and migrations:** compare schema and migration changes; consider existing data, access controls used by the repo, query limits, and cache expiry or invalidation.
- **Dependencies and quality gates:** flag only concrete dependency problems. Check whether suppressions, skipped tests, or config changes hide a real failure or weaken an explicit repo requirement.
- **LLM, scripts, and jobs:** validate model output before use; check bounded calls, timeouts, retries, and visible failure behavior where relevant.

Read the repo's actual CI and package scripts before reporting check status. Report commands and results as evidence; never say a check passed unless it was run and its output supports that claim. For this repo, root scripts include `pnpm build`, `pnpm lint`, and `pnpm test`; use the smallest relevant command when checks are requested or part of the review workflow.

## Scope, risk, and human review

- Compare the diff with the task, linked issue, and applicable spec. Unrequested scope is a warning unless it violates an explicit rule.
- Assign an advisory risk tier from the change itself: **Low** for docs/copy and isolated additive changes; **Medium** for ordinary product behavior or sensitive shared logic; **High** for auth, money/betting calculations, data migrations, secrets, deployment/release, CI workflows, or broad architectural changes. Explain the factors; do not imply that this file enforces approvals.
- High-risk changes deserve explicit human review of the decision and verification evidence. An agent may analyze or recommend, but its verdict is not a human sign-off.
- For changes that are hard to undo, describe a practical rollback, feature flag, or recovery path when one applies. Do not require artificial rollback mechanics for harmless changes.

## Review rounds and learning

- On a follow-up review, focus on the new diff and whether prior findings were fixed. Do not repeat a resolved or unchanged finding; mention an earlier finding again only if the new change reintroduces it or changes its impact.
- After three review/fix rounds, stop adding incremental comments and ask for a simpler approach or human review.
- When the same actionable issue recurs, recommend fixing the source of the rule in this file, `AGENTS.md`, a focused skill, or a deterministic lint/test check.
- Use confirmed regressions and reverted changes to improve future checks. Track review rounds and false-positive feedback when practical; do not claim incident or revert rates are measured unless the repo records them.

## Ignore

- Formatting, import ordering, and naming preferences where tooling or existing conventions are clear.
- Generic advice without a concrete impact, generated files, lockfile churn, and migration snapshots (review migration SQL itself).
- Code outside the diff unless the diff makes it newly broken.
- A package solely because it is unfamiliar or possibly unmaintained; require checkable evidence.
- Missing specs, handover records, tests, or other documents as defects on their own.

## Output

Start with a concise summary and counts, then actionable inline findings:

```text
## Review Summary
Verdict: APPROVE | REQUEST CHANGES | NEEDS DECISION
Risk: LOW | MEDIUM | HIGH — <reason>
Context: <task/spec used, or none found>
Checks: <commands and results, or not run>
Blockers: <n>  Warnings: <n>  Notes: <n>

### Findings
- [SEVERITY] <file:line> — <impact and evidence> — <fix>

### Decision needed
- <question, if any>
```

For large diffs (about 800+ changed non-generated lines), say review coverage is limited, identify the highest-risk areas covered, and recommend splitting the change.
