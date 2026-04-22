# BetMate Agent Handover

## Current Status

- Active execution is now a V2 cleanup and polish pass only.
- Older roadmap phases are complete or obsolete for current handover purposes and should not drive agent work.
- Phase 7 is deferred backlog only.
- Phase 7 is blocked by a data gate and requires 4 weeks of data before any implementation work starts.

## Active Scope

### Phase 1 — V2 UX / Interaction / Layout Fixes

- Fix the AFL log selection click glitch and flicker.
- Make `Log Selection` and `Cancel` more prominent and readable.
- Ensure those controls stand out from the background.
- A hover-state improvement is acceptable if it is deliberate and clearly visible.
- When a selection is logged, keep the paper betslip minimized.
- The bet must still be added successfully to the slip.
- Apply a consistent layout pattern across AFL, Racing, and NBA where relevant:
  - left = `Log Selection Home`
  - middle = event, game, or race info
  - right = `Log Selection Away`

### Phase 2 — V2 Brand / Racing Coverage / Homepage Improvements

- Align the product logo direction to the supplied BetMate logo asset.
- Add the supplied BetMate Bob asset to the Ask Bob section.
- Add the supplied BetMate Bob asset to the homepage, preferably below the main menu or navigation.
- Allow users to place paper bets on all Australian races, even when no prediction exists.
- Keep prediction cards focused on main races only:
  - Melbourne
  - Sydney
  - WA and Brisbane where relevant
- Keep those prediction cards visible until the next-day refresh so night users can still see what the ML produced.
- Predicted races must support direct add or copy into the betslip.
- Show full race listings below predictions so paper bets can still be placed across all races.

## Deferred Backlog

### Phase 7 — Model Learning / Personalization

- Status: Deferred
- Priority: Backlog only
- Gate: Blocked pending 4 weeks of data
- Instruction: Do not start this work in the current cleanup pass

## Recommended Next Work Order

1. Complete Phase 1 UX, interaction, and layout fixes.
2. Complete Phase 2 brand, racing coverage, and homepage improvements.
3. Leave Phase 7 untouched until the 4-week data gate is met.

## Scope Discipline

- Use only the approved V2 cleanup scope from the owner prompt and `V2_VERIFICATION.md`.
- Do not restore old roadmap phases to active status.
- Do not add new features, extra phases, or broad backend work.
- If a task is not listed above, treat it as out of scope for this pass.
