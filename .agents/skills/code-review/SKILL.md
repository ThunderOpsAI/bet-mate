---
name: code-review
description: Review a branch, PR, or work-in-progress diff for correctness, security, spec alignment, risk, and repo standards. Use when the user asks for a code review or asks to review changes since a ref.
---

Review changes using the repository's root `REVIEW.md` as policy when present. Also follow `AGENTS.md`, `CLAUDE.md`, and the applicable task or spec. Apply guidance only to the layers and stack touched by the diff.

The review covers two focused passes:

- **Standards** — does the code conform to this repo's documented coding standards?
- **Spec** — does the code faithfully implement the originating issue / PRD / spec?

Automated findings inform the review decision; they are not human approval and do not alter branch protection or merge permissions.

Do both review passes in this context. Do not spawn sub-agents unless the user or applicable repo instructions explicitly request delegation.

## Process

### 1. Pin the fixed point

Use the user's requested fixed point. If none is specified, use the PR base or current branch upstream and state that assumption. If neither is available, use the repository's locally available default branch; do not invent a ref.

Capture the diff command once: `git diff <fixed-point>...HEAD` (three-dot, so the comparison is against the merge-base). Also note the list of commits via `git log <fixed-point>..HEAD --oneline`.

Confirm the fixed point resolves (`git rev-parse <fixed-point>`), capture the diff and commit list once, and report if the diff is empty or the base is uncertain. Use repo code-review graph tools first when available and required by repo instructions; otherwise inspect relevant files and note any coverage limits.

### 2. Identify the spec source

Look for the originating spec, in this order:

1. Issue references in the commit messages (`#123`, `Closes #45`, GitLab `!67`, etc.) — fetch via the workflow in `docs/agents/issue-tracker.md`.
2. A path the user passed as an argument.
3. A PRD/spec file under `docs/`, `specs/`, or `.scratch/` matching the branch name or feature.
4. If no spec is found, review the stated task and repo conventions, and report that no spec was available. Never report an optional missing document as a defect.

### 3. Identify the standards sources

Anything in the repo that documents how code should be written, such as `CODING_STANDARDS.md` or `CONTRIBUTING.md`.

On top of whatever the repo documents, the Standards axis always carries the **smell baseline** below — a fixed set of Fowler code smells (_Refactoring_, ch.3) that applies even when a repo documents nothing. Two rules bind it:

- **The repo overrides.** A documented repo standard always wins; where it endorses something the baseline would flag, suppress the smell.
- **Always a judgement call.** Each smell is a labelled heuristic ("possible Feature Envy"), never a hard violation — and, like any standard here, skip anything tooling already enforces.

Each smell reads *what it is* → *how to fix*; match it against the diff:

- **Mysterious Name** — a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- **Duplicated Code** — the same logic shape appears in more than one hunk or file in the change. → extract the shared shape, call it from both.
- **Feature Envy** — a method that reaches into another object's data more than its own. → move the method onto the data it envies.
- **Data Clumps** — the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- **Primitive Obsession** — a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- **Repeated Switches** — the same `switch`/`if`-cascade on the same type recurs across the change. → replace with polymorphism, or one map both sites share.
- **Shotgun Surgery** — one logical change forces scattered edits across many files in the diff. → gather what changes together into one module.
- **Divergent Change** — one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- **Speculative Generality** — abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- **Message Chains** — long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method on the first object.
- **Middle Man** — a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest** — a subclass or implementer that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

### 4. Review in two focused passes

Review both axes in this context. First check behavior, correctness, security, and applicable code standards. Then check spec coverage, scope, and design choices. Do not spawn sub-agents unless explicitly requested by the user or applicable repo instructions.

**Standards pass** — check:

- Whether changed code breaks an applicable documented rule; cite the rule and changed hunk.
- Any concrete, actionable smell from the baseline. Treat these as judgment calls, not hard violations. Repo guidance overrides the baseline, and tooling-enforced issues are not review findings.

**Spec pass** — check:

- Requirements that are missing or partial, behavior outside the requested scope, and implementations that appear to violate the spec. Cite the relevant spec text and changed code.

If the spec is missing, skip spec comparison and note this in the final report.

### 5. Aggregate

Present findings in the format specified by root `REVIEW.md`, when present. Include verdict, an advisory risk tier based on changed paths and behavior, task/spec context, check commands and results (or "not run"), and severity counts. Use `REQUEST CHANGES` only when there is at least one blocker. Use `NEEDS DECISION` when the code looks sound but an owner decision is needed; otherwise use `APPROVE`.

Risk guidance: Low for docs and isolated additive changes; Medium for ordinary product behavior or shared logic; High for authentication, money/betting logic, sensitive data, migrations, secrets, deployment/release, CI, or broad architecture changes. Explain the tier. High risk merits human review; an agent verdict never substitutes for human approval.

On a follow-up, focus on the new diff, check whether prior findings were addressed, and don't repeat resolved or unchanged findings. After three review/fix rounds, request a simpler approach or human review. If the same issue recurs, recommend adding the rule to `REVIEW.md`, `AGENTS.md`, a focused skill, or a deterministic check. Use regressions and reverts to improve review guidance; report rates only when the repo tracks them.

## Why two axes

A change can pass one axis and fail the other:

- Code that follows every standard but implements the wrong thing → **Standards pass, Spec fail.**
- Code that does exactly what the issue asked but breaks the project's conventions → **Spec pass, Standards fail.**

Keep correctness/security findings distinct from spec/standards findings when that makes the reasoning clearer, but aggregate them into one concise review report.
