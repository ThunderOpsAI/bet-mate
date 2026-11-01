# REVIEW.md — AI Code Review Guidelines

This file tells automated reviewers (Claude Code Review, Cursor Bugbot, GitHub PR bots, and other reviewer agents) what matters in this repository's pull requests, what to block, and what to ignore. It is written to be reused across projects, so it is **conditional**: apply only what matches the changed code and the repo's actual architecture.

`AGENTS.md` / `CLAUDE.md` tell implementers how to build. This file tells reviewers how to judge.

---

## 1. Before You Review: Orient to This Repo

1. **Detect the stack from the repo, not from this file.** Read manifests, configs, and the folder layout (`package.json`, `requirements.txt`, `pyproject.toml`, `prisma/`, `supabase/`, framework configs, CI files). Examples in this file name specific tools; they apply only if the repo actually uses them.
2. **Find the source of truth, if one exists.** Look for the spec and any phase/handover record the repo uses. Common names include `SPEC.md`, `BUILD_SPEC.md`, an SRS, `AGENTS.md`, `CLAUDE.md`, `AGENT_HANDOVER.md`, or a `docs/` folder. Names vary by project.
   - If the PR or `AGENTS.md` points to a spec, use it.
   - If no spec or phase record exists, review against the PR description, linked issue, and the code's own conventions. **Never report a missing spec, handover file, or other document as a defect.**
3. **Read repo-specific rules first.** Where `AGENTS.md`, `CLAUDE.md`, or the spec define conventions, `DO NOT` lists, or approval gates, those override the general guidance below.
4. **Review only the diff and what it affects.** Skip sections that don't apply to the changed files. A change to a Python script doesn't need frontend state-handling review.

---

## 2. Review Philosophy

- **High signal only.** Comment on genuine bugs, security risks, broken architectural boundaries, and missing handling of cases that matter for the changed behavior.
- **No style nitpicks.** Don't comment on formatting, naming preferences, or import order where a linter/formatter owns them.
- **Be actionable.** Cite file and line, explain what goes wrong and why, and give a concise fix.
- **Show evidence.** Point to the code path, input, or config that causes the problem. If you can't demonstrate the issue, downgrade it or leave it out.
- **One comment per root cause.** Flag it once and list other affected locations.
- **If the PR is clean, say so briefly.** Don't invent findings.

### Severity levels

| Label | Use for | Effect |
|---|---|---|
| `[BLOCKER]` | A **demonstrable** failure: a concrete security vulnerability, a correctness bug you can trace, data loss/corruption risk, a build or test break, or a violation of an **explicit** repo policy (a written rule in `AGENTS.md`, the spec, or CI config) | Should not merge until fixed or explicitly waived |
| `[WARN]` | Probable problems, risky patterns, or gaps worth fixing that don't clearly break anything: scope beyond the task, a design decision the spec doesn't cover, missing tests for risky logic, missing docs/handover updates | Discuss; may merge with justification |
| `[NOTE]` | Optional observations. Use sparingly (max 3 per PR) | No action required |

Rule of thumb: if you can't point to a concrete failure or a written rule that's broken, it is not a blocker.

---

## 3. Spec & Scope Alignment (only if a spec or task description exists)

Compare the diff against the applicable spec, ticket, or PR description.

- `[WARN]` Changes unrelated to the stated task (features, refactors, new dependencies) that make the PR harder to review or revert. Escalate to `[BLOCKER]` only if the repo explicitly forbids it (e.g. a `DO NOT` rule or an enforced phase gate) and the PR breaks that rule.
- `[BLOCKER]` Violating an explicit `DO NOT` rule or recorded approval gate in the repo's own documents.
- `[WARN]` The PR makes a design decision the spec doesn't cover. Describe the decision so the owner can approve it and update the spec; this is a question, not a failure.
- `[WARN]` If the repo keeps a phase/handover record and the PR changes phase status, note when it wasn't updated.

---

## 4. Security & Correctness (apply to any stack)

`[BLOCKER]` when you can demonstrate it:

- **Injection and unsafe input handling:** user input reaching SQL, shell, file paths, HTML, or `eval`-style execution without validation/escaping/parameterization.
- **Exposed secrets:** credentials, tokens, or private keys in committed code, logs, or client-side bundles (e.g. server-only keys behind a public env prefix). Placeholder values in `.env.example` are fine.
- **Broken access control:** new routes, queries, or tables that skip the authentication/authorization or row-level security approach the repo already uses elsewhere.
- **Data loss:** destructive migrations (dropping/renaming columns or tables) with no migration path, or writes that can corrupt existing data.
- **Silent failure that hides real errors:** empty `catch` blocks or ignored promise rejections on paths where the failure matters, with no logging, propagation, or user feedback.
- **Fake data masking real failures:** hardcoded fixtures or sample data returned when a real data source is empty or erroring, so users see made-up content as if it were real. (Clearly labelled test fixtures, seeds, and Storybook data are fine.)
- **Traceable logic bugs:** off-by-one errors, wrong conditions, race conditions, unhandled null/undefined, or incorrect types you can walk through with a concrete input.

`[WARN]` for the weaker or less certain version of any of the above.

---

## 5. Dependencies

Flag a dependency only for a **concrete, checkable issue**:

- `[BLOCKER]` Imported but not declared in the project's manifest/lockfile (will fail at install or runtime).
- `[BLOCKER]` A known typo-squat or look-alike of a popular package (e.g. a one-character variant of a well-known name), or a package with a published security advisory affecting the version used.
- `[WARN]` Incompatible with the project (conflicting peer dependency, unsupported runtime/engine version, license that conflicts with a stated repo policy, or duplicates functionality of a dependency already in the repo).

Do **not** flag a package merely for being unfamiliar, small, or "possibly unmaintained" unless you can cite evidence (e.g. a deprecation notice, an archived repository, or a known advisory).

---

## 6. Build, Test & Quality-Gate Integrity

Flag changes that weaken the project's own quality gates **when you can show they hide a real issue or remove real coverage**. Look at the repo's actual commands and config (CI workflows, `package.json` scripts, `tsconfig`, linter config) to know what counts.

Patterns worth checking, if the repo uses them:

- Type or lint suppressions: `@ts-ignore`, `@ts-expect-error`, `# type: ignore`, `eslint-disable`, `// nolint`, `noqa`
- Config that turns off checks: build flags or settings that ignore type or lint errors (e.g. `ignoreBuildErrors`, `strict: false` newly added), CI steps marked `continue-on-error`, or commands with `|| true`
- Skipped or removed tests: `.skip`, `xit`, `@pytest.mark.skip`, deleted assertions, or commented-out tests
- Hook bypasses added to scripts (e.g. `--no-verify`)

Severity:
- `[BLOCKER]` the suppression or skip demonstrably hides a real error, a failing test, or a policy the repo explicitly requires.
- `[WARN]` a suppression or skip with no explanation, or one that plausibly hides an issue but you can't show it.
- Do not flag a suppression that has a clear, accurate justification (e.g. a documented third-party typing gap), and do not treat compiler or CLI flags as bypasses unless they demonstrably suppress errors in this repo's setup.

---

## 7. Architecture & Boundaries (apply only the parts that match the changed code)

First identify which layers the diff touches, then use only the relevant guidance. These are common patterns; defer to the repo's own architecture when it differs.

**Frontend / UI code**
- Check loading, empty, and error handling **where the changed behavior depends on async data or can fail**. Not every component needs all three.
- Server-only code, secrets, or database clients must not be imported into client-side code.
- Mutations and forms should give the user feedback on failure if the failure matters to them.

**Backend / API code**
- Inputs should be validated at the boundary using whatever validation approach the repo already uses (e.g. a schema library), before business logic runs.
- Outbound calls to external services should have timeouts or cancellation where a hang would affect users or other requests.
- Error responses shouldn't leak stack traces or internals.
- Follow the repo's layering (e.g. thin handlers, logic in services, data access in a data layer) if it has one; don't impose a layering it doesn't use.

**Database / data layer** (whatever ORM or database the repo actually uses)
- Migrations should be consistent with the schema changes in the diff and safe for existing data (see §4).
- Queries inside loops (N+1) and unbounded queries on potentially large tables are `[WARN]` unless you can show they break a real path.
- Caching code (if present) should have a clear expiry or invalidation approach.

**LLM / agent code** (only if the diff touches it)
- Model identifiers should come from config or constants if the repo does so elsewhere.
- Model output used for logic should be validated or safely parsed, not trusted blindly.
- Rate limits, refusals, and failures should be handled; unbounded loops of paid calls or missing token limits are `[WARN]`, or `[BLOCKER]` if you can show uncontrolled cost on a user-reachable path.

**Scripts, scrapers, and background jobs**
- Failures should be visible (logging or non-zero exit), retries should be bounded, and external targets shouldn't be hammered without backoff.

**Module design**
- Prefer small module interfaces. Flag changes that expose internals across boundaries when it causes a concrete maintenance or correctness problem.

---

## 8. Smells to Watch For (usually `[WARN]` or `[NOTE]`)

- **Shotgun surgery:** one logical change scattered across many loosely coupled files.
- **Primitive obsession:** raw strings/numbers for core domain concepts where the repo uses typed models elsewhere.
- **Speculative generality:** abstractions or config "just in case" with a single caller.
- **Duplication:** logic copied where a shared utility already exists in the repo.
- **Leftovers:** commented-out code, unused exports, stray debug logging.

---

## 9. Ignore List (do NOT comment on)

- Formatting, whitespace, quote style, trailing commas, and import order
- Naming preferences where the existing name is clear
- Generic advice such as "consider adding a comment" or "consider extracting this"
- Style questions already settled in `AGENTS.md` or enforced by tooling
- Generated files, lockfile churn, and migration snapshots (review migration SQL itself)
- Code outside the diff, unless the diff makes it newly broken
- Missing documents (spec, handover, README) as a defect on their own

---

## 10. Verification Checklist (apply what is relevant to the PR)

Use judgment; skip items that don't relate to the changed behavior.

- [ ] The project's own build, type-check, and lint commands would pass (check CI config; don't assume specific commands)
- [ ] Changed or new behavior with meaningful risk has tests, such as business rules, data transformations, auth, money, or bug fixes (bug fixes ideally include a regression test). Trivial wiring, config, and pure UI markup don't need new tests
- [ ] New environment variables are documented wherever the repo documents them (e.g. `.env.example`), without real values
- [ ] Schema changes include migrations if the repo uses them, and access rules if the repo's pattern requires them
- [ ] User-facing async flows handle failure in a way that fits the repo's conventions
- [ ] The diff matches the stated task, or deviations are called out
- [ ] No secrets, deceptive fake-data fallbacks, or debug leftovers

---

## 11. Review Output Format

Post one summary comment, then inline comments.

```
## Review Summary
Verdict: APPROVE | REQUEST CHANGES | NEEDS DECISION
Context used: <spec/task/PR description found, or "none found">
Layers reviewed: <e.g. API, data layer, scripts>

Blockers: <n>   Warnings: <n>   Notes: <n>

### Blockers
1. <file:line> — <issue> — <evidence> — <fix>

### Warnings
1. <file:line> — <issue> — <fix>

### Questions for the owner
- <design or scope decision the spec/task doesn't cover>
```

- Use **REQUEST CHANGES** only when there is at least one `[BLOCKER]`.
- Use **NEEDS DECISION** when the code looks fine but a scope or design question needs the owner's input before merging.
- Use **APPROVE** otherwise, listing any warnings.

---

## 12. Escalation & Large PRs

- If a finding depends on a product decision (scope, pricing, data model direction), don't guess. List it under "Questions for the owner."
- If a PR is too large to review reliably (roughly 800+ changed lines excluding generated files), say so and suggest splitting it by concern. Then review the highest-risk parts instead of skimming everything.
