# BetMate Frontend Context

## Tech Stack
- Next.js
- React
- Tailwind CSS
- TypeScript

## UI & Styling Harness
- NEVER generate generic dark mode layouts.
- Base Theme: Deep navy (`bg-slate-950`) with electric cyan accents (`bg-cyan-500`).
- Component Structure: Always use flexbox or CSS grid. Never dump unstyled text onto the page.
- Layouts: Mimic professional sportsbooks (TAB, bet365). Use distinct container cards for distinct data feeds.
- Data Display: Wrap numerical counts and variables in styled pill badges (e.g., `<span className="bg-white/10 text-xs px-2 py-0.5 rounded-full">`).
- Spacing: Enforce strict padding and gaps (`gap-4`, `p-4`) between all major sections.
