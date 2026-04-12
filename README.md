# BetMate

BetMate is an AI-powered multi-sport prediction and analytics platform focused on horse racing, basketball (NBA/NBL), and AFL.

The application provides:
- Data-driven predictions and probabilities
- Explainable AI insights via Gemini
- Racing market calculators and strategy tools
- Paper-only bankroll tracking and performance analytics

**Important:**  
BetMate is a **NO BETTING** product. It does not place, accept, route, facilitate, or settle real-money wagers. It does not connect to bookmakers for transaction execution and does not handle deposits, withdrawals, or wagering payments. The app is for information, analysis, and paper/simulated tracking only.

---

## Tech Stack (Planned)

- **Frontend:** Next.js (Web), React Native + Expo (Mobile)
- **Backend:** Node.js (API Gateway), Python FastAPI (Prediction Engine)
- **Database:** PostgreSQL + Prisma
- **Caching & Jobs:** Redis + BullMQ
- **AI:** Google Gemini API
- **Monorepo:** pnpm + Turborepo

---

## Project Status

🚧 **Early Development / Architecture Locked**  
This repository currently contains the project scaffold and design documentation. Implementation will follow a phased roadmap.

---

## Legal & Responsible Use

- This project does not accept wagers, stakes, deposits, withdrawals, or wagering payments
- No feature should place or facilitate real-money betting
- Any "bet", "stake", or "bankroll" language in the product refers to paper/simulated tracking only
- Predictions are not guarantees
- Users must be 18+
- Please gamble responsibly

Australian users: https://www.gamblinghelponline.org.au

## V2 Auth And Compliance Notes

BetMate uses Supabase Auth for email/password and Google OAuth sign-in. OAuth must use the PKCE callback route at `/auth/callback`.

Configure Supabase redirect URLs for each environment:
- Local: `http://localhost:3000/auth/callback`
- Production: `https://your-production-domain/auth/callback`

Run the Supabase SQL migration in `supabase/migrations/202604120001_auth_profiles_compliance.sql` before enabling production auth. It creates `profiles` and `user_settings`, enables RLS, and stores age confirmation and Terms acceptance timestamps.

No KYC or identity verification is required at this stage because BetMate remains informational only. BetMate does not accept funds, hold balances, place bets, route wagers, or provide betting services. Reassess this decision before adding payments, bookmaker links, affiliate links, or any facilitation-style betting UX.
