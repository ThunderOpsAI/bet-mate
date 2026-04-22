# BetMate V2 Cleanup Build Spec

## Purpose

- This is not a fresh roadmap.
- This is a V2 cleanup, polish, and usability correction pass only.
- Use only the approved scope from `V2_VERIFICATION.md` and the owner prompt for this pass.
- No extra phases, no feature creep, no speculative additions, and no broad backend expansion.
- Backend changes are allowed only if they are narrowly required to support the approved UX scope.

## Execution Rules

- Active execution contains only Phase 1 and Phase 2 below.
- Older roadmap phases are not part of the current implementation plan.
- Do not preserve old unfinished-phase planning for history inside this spec.
- If work is not listed here, it is out of scope.
- Branding references should use the supplied BetMate logo and BetMate Bob assets only.
- Do not interpret raw image files; describe asset placement only.

## Phase 1 — V2 UX / Interaction / Layout Fixes

### Scope

- Fix the AFL log selection click glitch and flicker issue.
- Make `Log Selection` and `Cancel` more prominent and readable.
- Ensure those controls stand out from the background.
- Hover-state improvement is acceptable if it is clearly defined and improves visibility.
- When a selection is logged, the paper betslip must remain minimized.
- The bet must still be added successfully to the slip.
- Apply this layout pattern consistently across AFL, Racing, and NBA where relevant:
  - left = `Log Selection Home`
  - middle = event, game, or race info
  - right = `Log Selection Away`

### Acceptance

- Logging a selection no longer flickers or misfires in AFL.
- `Log Selection` and `Cancel` are visually obvious against their background.
- Logged selections are added successfully without expanding the paper betslip.
- The left, middle, right interaction pattern is consistent across the applicable AFL, Racing, and NBA views.

## Phase 2 — V2 Brand / Racing Coverage / Homepage Improvements

### Scope

- Update logo direction so it aligns with the supplied BetMate logo style.
- Add the supplied BetMate Bob asset to the Ask Bob section.
- Add the supplied BetMate Bob asset to the homepage, preferably below the menu or navigation.
- Users must be able to place paper bets on all Australian races, even where no prediction exists.
- Prediction cards should focus on main races only:
  - Melbourne
  - Sydney
  - WA and Brisbane where relevant
- Those predictions should remain visible until next-day refresh so night users can still see what the ML produced.
- Predicted races must support direct add or copy into the betslip.
- Below predictions there should be full race listings for all races, with paper-bet placement available.

### Acceptance

- Brand direction matches the supplied BetMate logo asset closely enough for owner review.
- Ask Bob includes the supplied BetMate Bob asset.
- The homepage includes the supplied BetMate Bob asset in the approved placement area.
- Users can place paper bets across all Australian races regardless of prediction coverage.
- Prediction cards remain limited to main races while full race listings remain available below.
- Main-race predictions stay visible until next-day refresh.
- Predicted races support direct add or copy into the betslip.

## Backlog Only

### Phase 7 — Model Learning / Personalization

- Status: Deferred
- Gate: Requires 4 weeks of data
- Instruction: Backlog only, not active implementation

## Out Of Scope

- New features beyond the approved V2 cleanup items
- Extra phases
- Old roadmap preservation
- Unrelated refactors
- Broad backend redesign
- Speculative ML or personalization work before the data gate is met
