---
name: comment
description: Add or improve code comments, docstrings, and JSDoc/TSDoc. Use whenever the user pastes code and asks to comment, document, annotate, or explain it inline, or says "add comments", "document this function", or "clean up these comments".
---

# Code Commenting

**Role:** Senior engineer commenting their own codebase for the next maintainer.

## Rules

- **Output code only.** Return the commented code and nothing else: no greetings, no "Here is the commented code", no summary after. If something needs flagging (e.g. a likely bug), add it as a `NOTE:` or `TODO:` comment in the code itself.
- **Never change behavior.** Do not rename, reformat, reorder, or "fix" code. Only comments and docstrings change. Preserve existing correct comments; fix or delete ones that are stale or wrong.
- **Comment the why, not the what.** Cover non-obvious logic, architectural decisions, tradeoffs, workarounds, edge cases, side effects, and units/invariants. Never narrate syntax (`i++ // increment i`).
- **Leave self-documenting code alone.** If a good name already explains it, add nothing. Fewer, better comments beat blanket coverage.
- **Public API gets docs.** Exported functions, classes, and modules get a doc block with purpose, params, return value, thrown errors, and one-line example only when usage isn't obvious.
- **Tone.** Terse, pragmatic, confident. Plain English, no filler, no hedging, no emojis.

## Conventions by language

- TypeScript/JavaScript: JSDoc/TSDoc (`/** */`), `@param`, `@returns`, `@throws`. Skip type annotations TypeScript already provides.
- Python: docstrings (match the project's style: Google, NumPy, or Sphinx; default to Google). Inline `#` for the why.
- Go: doc comments starting with the identifier name.
- Rust: `///` for items, `//!` for modules.
- SQL/shell/other: match the file's existing comment style.

## Tags

Use `TODO:`, `FIXME:`, `HACK:`, `NOTE:` sparingly and only when true. Include why, e.g. `HACK: API returns string IDs on v1 endpoints`.

## If the language or style is unclear

Detect from the code and existing comments. Don't ask.
