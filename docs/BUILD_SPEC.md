# BetMate
## Vibe Coder Build Specification
### V2 → V3 → V4 Phase Plan | April 2026

Current baseline: V1.5 complete (87 tests passing, commit 181f6b4)

> ℹ️ Sequencing decision: Compliance before Payments. Stripe flags gambling-adjacent apps at onboarding. App stores reject without correct disclosures. Complete V2 compliance foundations first, then unlock Stripe in V3.

---

## Current State — V1.5 Baseline
Treat V1.5 as complete and stable. Do not touch unless a V2 task explicitly requires a backend change.

| Branch | Commit | Test suite | Production health |
| :--- | :--- | :--- | :--- |
| codex/venue-registry-multi-settlement | 181f6b4 — Expand venue registry and settle multi bets | 87 passed (racing, API, strategy, storage, nightly, AFL, NBA) | https://bet-mateprediction-engine-production.up.railway.app/health → {status:ok} |

---

## Phase V2 — Branding, Auth & Compliance Foundations
**Goal:** Ship a working authenticated product with all mandatory compliance posture in place before any monetisation or store submission.

> ⚠️ Do NOT skip or defer the compliance tasks in this phase. They are P0 blockers for V3 (Stripe) and app store submission.

### V2 — Branding
| Feature / Task | Detail / Acceptance Criteria | Priority |
| :--- | :--- | :--- |
| BetMate Bob mascot | Design and implement logo/mascot in app header, loading screens, and email templates. SVG preferred. | P1 |
| Brand system | Finalise colour palette, typography, and component style tokens in Tailwind config. All existing screens updated. | P1 |

### V2 — Auth
| Feature / Task | Detail / Acceptance Criteria | Priority |
| :--- | :--- | :--- |
| Email login | Email + password auth via Supabase Auth. Magic link already scoped — extend to email/password or keep magic link. Confirm with owner. | P0 |
| Google OAuth | Google sign-in via Supabase OAuth provider. Correct redirect URIs, PKCE flow, error states covered. | P0 |
| User profiles | Profile table in Supabase. Store: display name, email, created_at, plan tier (default: free). RLS locked to user. | P0 |
| Personalised strategy settings | User can set preferences (sports, risk level, max stake). Stored in user_settings table. Drives recommendation filtering. | P1 |
| Session management | Secure token refresh, auto-logout on expiry, protected route guards on all authenticated pages. | P0 |

### V2 — Compliance Foundations (BLOCKERS)
| Feature / Task | Detail / Acceptance Criteria | Priority |
| :--- | :--- | :--- |
| Age gate | 18+ confirmation on first launch / account creation. Hard block if declined. Log confirmation timestamp in DB. Required for app store + responsible gambling. | P0 |
| Terms of Service | Draft ToS reflecting: informational/stats product only, no wagering, no guaranteed returns. Must be accepted at signup. Store acceptance timestamp. | P0 |
| Privacy Policy | Covers: data collected (email, profile, strategy prefs, usage), third parties (Supabase, Stripe future, analytics), user rights. Accessible in-app and via URL. | P0 |
| Responsible gambling notice | Persistent notice in app UI (footer or settings). Link to Gambling Help Online. Required for AU store approval. | P0 |
| Disclaimer on recommendations | Every recommendation card must show: 'This is informational only. BetMate does not accept wagers or provide betting services.' Non-negotiable. | P0 |
| No-KYC confirmation | BetMate does not accept funds or place bets — KYC/ID verification not required at this stage. Document this decision in README for legal reference. | P1 |

### V2 — Production Ops Carry-over from V1.5
These are V1.5 loose ends. Complete at the start of V2.

| Feature / Task | Detail / Acceptance Criteria | Priority |
| :--- | :--- | :--- |
| Production scheduler | Set BETMATE_NIGHTLY_SCHEDULER_ENABLED=true on Railway FastAPI service. Confirm BETMATE_NIGHTLY_SCHEDULER_TIME=05:00 Melbourne. Verify single instance running. Check logs show one cycle per day. | P0 |
| Railway auth setup | Railway auth was unavailable during V1.5 session. Confirm env vars are set this session. | P0 |

---

## Phase V3 — UI Polish, Payments & Privacy Compliance
**Goal:** Monetise the product. Compliance from V2 makes this safe to do. Stripe onboarding references your ToS and Privacy Policy — they must already exist.

> ℹ️ Stripe context: BetMate is a stats/information app. Declare this clearly in Stripe onboarding. Do not describe it as gambling. Your V2 ToS and positioning copy is your evidence.

### V3 — UI & UX
| Feature / Task | Detail / Acceptance Criteria | Priority |
| :--- | :--- | :--- |
| Mobile UX improvements | Audit all screens on iOS and Android viewport sizes. Fix overflow, tap targets, spacing. Priority: dashboard, recommendation cards, settings. | P0 |
| Onboarding flow | Step-by-step onboarding: age gate → ToS accept → Google/email auth → sport prefs → first recommendation. Max 4 steps. | P0 |
| Recommendation explanation screens | Each recommendation shows: why this pick, what data drove it, confidence band. No guaranteed return language. | P1 |
| General UI polish | Visual consistency pass: spacing, shadows, empty states, loading skeletons, error states. | P1 |

### V3 — Payments
| Feature / Task | Detail / Acceptance Criteria | Priority |
| :--- | :--- | :--- |
| Stripe integration | Stripe Checkout for subscription creation. Webhook handler for subscription events (created, updated, cancelled, payment_failed). Store plan tier in user profile. | P0 |
| Solo tier ($24/mo) | Feature set TBD by owner. Unlock via Stripe subscription. Gated routes/components check plan tier from Supabase. | P0 |
| Edge tier ($39/mo) | Feature set TBD by owner. Same gate mechanism, higher tier check. | P0 |
| Free tier limits | Define what free users can see. Enforce limits server-side (not just UI). e.g. X recommendations/day. | P1 |
| Billing portal | Stripe Customer Portal for plan changes, cancellation, invoice history. Link from user settings. | P1 |

### V3 — Privacy & Data Safety
| Feature / Task | Detail / Acceptance Criteria | Priority |
| :--- | :--- | :--- |
| Apple Privacy Nutrition Label | Audit all data collected. Complete App Privacy Details in App Store Connect before submission. | P0 |
| Google Play Data Safety | Complete Data Safety form in Play Console. Must match actual data collection behaviour. | P0 |
| Admin logs | Log admin actions (user plan changes, manual overrides) with timestamp and actor. Supabase table, RLS admin-only. | P1 |
| Analytics hygiene | Ensure analytics data (if any) is separate from PII. No sensitive account data in event logs. | P1 |

---

## Phase V4 — App Store Hardening & Legal Review
**Goal:** Get BetMate live on Apple App Store and Google Play. This phase is about approval, not new features.

> ⚠️ Engage an Australian lawyer familiar with gambling-adjacent app regulation and ACMA before final submission. Budget for this.

### V4 — Legal Review
| Feature / Task | Detail / Acceptance Criteria | Priority |
| :--- | :--- | :--- |
| AU lawyer review | Legal review of: ToS, Privacy Policy, store listing copy, in-app disclaimers, affiliate/ad strategy (if any). Confirm ACMA positioning as informational product. | P0 |
| Store copy review | App Store and Play Store listing must not present BetMate as a wagering operator. Avoid: 'bet', 'wager', 'gambling' in primary copy. Use: 'sports statistics, tracking and recommendations'. | P0 |
| Affiliate/ad decision | Decide now: will V4+ include bookmaker affiliate links or gambling ads? If yes, legal and platform risk increases materially. Document the decision. | P0 |

### V4 — Store Hardening
| Feature / Task | Detail / Acceptance Criteria | Priority |
| :--- | :--- | :--- |
| App Store classification | Apple requires authorization for apps facilitating licensed gambling. BetMate should NOT be classified as a real-money gambling app. Store submission must reflect informational nature. | P0 |
| Play Store classification | Google has a real-money gambling policy. Same principle — avoid triggering gambling app classification. Category: Sports. | P0 |
| Age rating | Set 17+ (Apple) / Mature (Google) for gambling-adjacent content. No family/child-directed signals anywhere. | P0 |
| Australian age rating | Apple is rolling out regional age ratings for AU. Ensure compliance with upcoming AU-specific age rating requirements. | P1 |
| Developer verification | Google identity verification deadlines are active in 2026. Complete developer account verification before submission. | P0 |

### V4 — Security Hardening
| Feature / Task | Detail / Acceptance Criteria | Priority |
| :--- | :--- | :--- |
| API key protection | No secrets in client bundles. All keys server-side or Railway env vars. Audit before store submission. | P0 |
| Google OAuth hardening | Confirm PKCE flow, correct redirect URIs in production, no implicit flow. | P0 |
| Rate limiting | API rate limiting on all public endpoints. Bot/abuse protection on auth flows. | P1 |
| Crash monitoring | Error/crash monitoring (Sentry or equivalent) without leaking PII in payloads. | P1 |
| Certificate pinning | Consider for V4+ if handling sensitive user data. Evaluate post-MVP. | P2 |
| MFA for admin | MFA on any admin accounts. Not required for standard users at this stage. | P1 |

### V4 — Responsible Gambling Hardening
| Feature / Task | Detail / Acceptance Criteria | Priority |
| :--- | :--- | :--- |
| Complaint/contact process | In-app and website contact method for users with complaints or responsible gambling concerns. | P0 |
| Geo strategy | Document which markets BetMate targets. Gambling-adjacent rules vary by country. AU only for V1 store launch. | P1 |
| Incident response plan | Basic plan: what happens if accounts are compromised. Who does what, how users are notified. | P1 |

---

## Compliance Reference Notes
These are confirmed positions for the build. Reference if questions arise during implementation.

### Legal framing — use this everywhere
BetMate is a sports statistics, tracking, and recommendation platform. It does not accept wagers or provide betting services. Reflect this in: website copy, app store listing, onboarding, ToS, Privacy Policy, disclaimers inside the product.

### KYC / ID verification
Not required for V2-V4 if BetMate remains informational — no bet acceptance, no fund holding, no bet placement. Document this decision. Reassess if affiliate flows are added.

### Advertising and affiliate risk
If bookmaker affiliate links or gambling promotions are added later, platform and legal risk increases materially. Google restricts gambling-related ads. AU wagering ad reforms are active (2025-26). Decide before any affiliate integration and get legal sign-off.

### ACMA position
The Interactive Gambling Act targets illegal/prohibited gambling services and advertising of prohibited or unlicensed services. A pure stats/information product sits outside this — but the line moves fast if deep bookmaker links, affiliate promotions, or facilitation-style UX is added.

---

## Known Backlog — Not In Scope for V2-V4
These items exist and are documented. Do not build them unless explicitly tasked.

* Multi settlement: broader market types (racing place/quinella, other composites) — needs richer result ingestion
* Venue registry: ongoing alias expansion as new Betfair naming variants appear
* Moderation/admin tools — only required if user-generated content is added
* Push notification security hardening — post-V4
