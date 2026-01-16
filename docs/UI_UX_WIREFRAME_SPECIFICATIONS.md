# UI/UX Wireframe Specifications - PredictEdge

## Document Overview
This document provides detailed wireframes and interaction specifications for every screen in the PredictEdge application. Each wireframe includes layout descriptions, component specifications, user interactions, and responsive behavior.

---

## Design Principles

1. **Racing-First**: Horse racing is the hero feature, loaded by default
2. **Progressive Disclosure**: Show essential info first, details on demand
3. **Data-Dense but Breathable**: Pack information without overwhelming
4. **Sporty Energy + Clean Aesthetics**: Vibrant but professional
5. **Mobile-First**: Optimize for thumb-friendly interactions
6. **Contextual AI**: Floating assistant available everywhere

---

## Navigation Structure

```
PredictEdge App
│
├── 🏇 Racing (Default)
│   ├── Today's Races Feed
│   ├── Race Detail View
│   ├── Horse Detail Modal
│   └── Exotic Bet Builder
│
├── 🏀 Basketball
│   ├── Today's Games Feed
│   ├── Game Detail View
│   └── Player Props
│
├── 🏈 AFL
│   ├── This Week's Games
│   ├── Game Detail View
│   └── Player Props
│
├── 📊 Analytics
│   ├── Performance Dashboard
│   ├── Bet History
│   └── Reports
│
└── ⚙️ Settings
    ├── Account
    ├── Preferences
    ├── Bankroll
    └── Notifications

Floating: 🤖 AI Chat (accessible from all screens)
```

---

## Screen 1: Racing Feed (Home/Default)

### Layout Description

```
┌─────────────────────────────────────────────────────┐
│  PredictEdge        🔍  🔔(3)  👤                  │ ← Header (sticky)
├─────────────────────────────────────────────────────┤
│                                                     │
│  Racing Today                         [Filter 🔽]  │ ← Page title + filter
│  Wednesday, January 15, 2026                       │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ 🏇 Flemington R5          3:45 PM    ⚡ LIVE  │ │ ← Race Card 1
│  │─────────────────────────────────────────────  │ │
│  │ 1200m • Good 4 • $50,000                      │ │
│  │                                               │ │
│  │ 🥇 #5 Thunder Bolt    $4.50  ⭐⭐⭐⭐        │ │
│  │    35% Win • 67% Place  💰 Value            │ │
│  │                                               │ │
│  │ 🥈 #2 Storm Chaser    $5.00  ⭐⭐⭐          │ │
│  │    28% Win • 61% Place                       │ │
│  │                                               │ │
│  │ 🥉 #7 Lucky Seven     $7.50  ⭐⭐            │ │
│  │    18% Win • 45% Place                       │ │
│  │                                               │ │
│  │ 💡 AI: Trifecta Box 2,5,7 ($12)             │ │
│  │                                               │ │
│  │ [View Card] [Ask AI] [Track Bet]            │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ 🏇 Randwick R3            4:15 PM             │ │ ← Race Card 2
│  │ [Similar structure...]                        │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ 🏇 Caulfield R7           4:45 PM  🟡 SOON   │ │ ← Race Card 3
│  │ [Similar structure...]                        │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Load More Races]                                 │
│                                                     │
├─────────────────────────────────────────────────────┤
│  🏇  🏀  🏈  📊  ⚙️                               │ ← Bottom nav (mobile)
│   •                                                 │
└─────────────────────────────────────────────────────┘
                                             ┌────┐
                                             │ 🤖 │ ← AI Chat Bubble
                                             └────┘
```

### Component Breakdown

**Header (Sticky)**:
- Logo/App Name: "PredictEdge" (left)
- Search icon: Opens search overlay (global search for races/games)
- Notification bell: Badge shows unread count
- Avatar: Opens user menu (profile, settings, logout)
- Background: Blur effect when scrolling (glassmorphism)
- Shadow: Appears on scroll

**Page Title Section**:
- "Racing Today" - Large heading (text-2xl)
- Current date - Smaller subtext (text-sm, neutral-600)
- Filter button: Opens filter modal
  - Filter options: Venue (all/specific), Status (upcoming/live/completed), Value bets only
- Spacing: space-6 below

**Race Card** (Primary Component):
- Container: bg-white (light) / bg-neutral-900 (dark), rounded-xl, shadow-lg, p-6
- Spacing: space-4 between cards

*Card Header*:
- Venue icon + name + race number (left)
- Time (center-right)
- Status badge (right): "LIVE" (orange, pulsing), "SOON" (yellow, countdown), or hidden
- Divider below (subtle, border-neutral-200)

*Card Meta*:
- Distance, track condition, prize money
- Single line, text-sm, neutral-600
- Icons for weather if significant

*Top 3 Picks*:
- Each pick is a row with 4 columns:
  1. Medal icon (🥇🥈🥉)
  2. Horse info: Barrier # + name, Win/Place %
  3. Odds (large, font-mono, font-semibold)
  4. AI rating (star system) + value badge if applicable
- Hover effect: Subtle bg-neutral-50 highlight
- Tap: Opens horse detail modal

*AI Suggestion Box* (conditional):
- Only shows if exotic bet has good value
- bg-primary-50, rounded-lg, p-3
- Icon + text: "AI: Trifecta Box 2,5,7 ($12)"
- Tap: Opens exotic bet builder with pre-selected horses

*Action Buttons*:
- Three buttons, flex row, gap-2
- "View Card": Primary (bg-primary-600, text-white)
- "Ask AI": Secondary (border, bg-transparent)
- "Track Bet": Secondary (border, bg-transparent)

**States**:
- **Loading**: Skeleton cards (shimmer animation)
- **Empty**: "No races today" with illustration
- **Error**: Toast notification at top

### Interactions

1. **Scroll Behavior**:
   - Infinite scroll (lazy load more races)
   - Pull-to-refresh on mobile
   - Header blurs and gains shadow on scroll

2. **Tap Race Card**:
   - Navigates to Race Detail View
   - Smooth transition (slide up on mobile, push on web)

3. **Tap "View Card"**:
   - Same as tapping card body

4. **Tap "Ask AI"**:
   - Opens AI Chat with race context
   - Pre-fills: "Tell me about Flemington R5"

5. **Tap "Track Bet"**:
   - Opens Bet Logging Modal
   - Pre-fills event: Flemington R5

6. **Tap Horse Row**:
   - Opens Horse Detail Modal (overlay)
   - Shows expanded stats, form guide

7. **Tap AI Suggestion**:
   - Opens Exotic Bet Builder
   - Pre-selects suggested horses

8. **Tap Filter**:
   - Opens Filter Modal
   - Apply filters → refetch races

9. **Swipe Left on Card** (mobile):
   - Reveals quick actions: "Favorite", "Set Reminder"

### Responsive Behavior

**Mobile (<768px)**:
- Single column
- Cards full width
- Bottom navigation visible
- Reduced padding (p-4 instead of p-6)
- Font sizes scale down slightly

**Tablet (768-1024px)**:
- Two-column grid for race cards
- More horizontal space utilized

**Desktop (>1024px)**:
- Three-column grid for race cards
- Sidebar navigation (replaces bottom nav)
- AI chat can dock to right side

---

## Screen 2: Race Detail View

### Layout Description

```
┌─────────────────────────────────────────────────────┐
│  ← Back                        [★ Favorite] [Share] │ ← Header
├─────────────────────────────────────────────────────┤
│                                                     │
│  Flemington Race 5                    ⚡ LIVE      │ ← Title
│  3:45 PM AEST • 1200m • Good 4                     │
│  $50,000 Prize • Class 3                           │
│                                                     │
│  🌤️ Sunny 22°C • Rail: True • 12 Runners         │ ← Conditions
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  💡 AI Exotic Suggestions                   │   │ ← Exotic box
│  │                                             │   │
│  │  Trifecta Box: 2, 5, 7                     │   │
│  │  Cost: $12  ROI: +18%  Risk: Moderate      │   │
│  │                                             │   │
│  │  [Build Custom]  [Copy]  [Explain Why]     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Sort by: [AI Ranking▼] [Barrier] [Odds] [Name]   │ ← Sort options
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🥇 #5 Thunder Bolt            ⭐⭐⭐⭐       │   │ ← Horse Card 1 (collapsed)
│  │    J: A. Smith • T: B. Johnson   35% Win   │   │
│  │    Barrier 5 • 57kg              $4.50     │   │
│  │    Form: 1-2-1-3-4               💰 Value  │   │
│  │                                             │   │
│  │    ▼ Expand for details                    │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🥈 #2 Storm Chaser            ⭐⭐⭐         │   │ ← Horse Card 2 (expanded)
│  │    J: C. Jones • T: D. Brown     28% Win   │   │
│  │    Barrier 2 • 56kg              $5.00     │   │
│  │    Form: 2-1-3-2-1                         │   │
│  │                                             │   │
│  │    Win: 28%  Place: 61%  Show: 78%         │   │
│  │    Fair odds: $3.57 (EV: +40%)             │   │
│  │                                             │   │
│  │    Last 5 Runs:                             │   │
│  │    2nd - Flemington 1200m Good (0.8L)      │   │
│  │    1st - Caulfield 1400m Soft (2.1L)       │   │
│  │    3rd - Moonee Valley 1200m Good (1.2L)   │   │
│  │    2nd - Flemington 1200m Firm (0.5L)      │   │
│  │    1st - Caulfield 1200m Good (3.4L)       │   │
│  │                                             │   │
│  │    Track/Dist: 4-2-1 (7 starts)            │   │
│  │    Jockey: 16% WR, $1.72 ROI               │   │
│  │    Trainer: 25% WR with this horse         │   │
│  │                                             │   │
│  │    [Why this pick?]  [Add to builder]     │   │
│  │                                             │   │
│  │    △ Collapse                               │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 🥉 #7 Lucky Seven             ⭐⭐           │   │ ← Horse Card 3
│  │ [Similar structure...]                      │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [9 more horses...]                                │
│                                                     │
├─────────────────────────────────────────────────────┤
│  🏇  🏀  🏈  📊  ⚙️                               │
└─────────────────────────────────────────────────────┘
```

### Component Breakdown

**Header**:
- Back button: Returns to Racing Feed
- Favorite star: Toggle (hollow/filled)
- Share button: Opens native share sheet (web/mobile)

**Race Info Section**:
- Title: Venue + Race Number (text-2xl, font-semibold)
- Time + Status badge if live
- Meta line 1: Distance, track condition, prize, class
- Meta line 2: Weather, rail position, runner count
- Icons for weather (sun, cloud, rain)
- Spacing: space-4 below

**AI Exotic Suggestions Box**:
- Prominent placement below race info
- bg-gradient (primary-50 to primary-100)
- Shows 1-2 suggested exotic bets
- Each suggestion:
  - Bet type + horse numbers
  - Cost, estimated ROI, risk level
  - Buttons: Build Custom, Copy, Explain Why
- If no suggestions: Hide this box

**Sort Options**:
- Horizontal pill toggles
- Active: bg-primary-600, inactive: bg-neutral-200
- Icons for some options (▼ = dropdown)
- Sticky below header when scrolling

**Horse Cards**:
- Stack vertically, space-4 between
- Accordion style: Collapsed by default, expand on tap
- Medal icons (🥇🥈🥉) for top 3 AI picks

*Collapsed State*:
- Horse number + name (font-semibold)
- Jockey, trainer names (text-sm)
- Barrier, weight, odds, AI rating
- Form string, value badge if applicable
- "▼ Expand for details" (text-xs, neutral-500)

*Expanded State*:
- Everything from collapsed +
- Win/Place/Show probabilities (large, bold)
- Fair odds calculation (shows value)
- Last 5 runs table:
  - Position, venue, distance, condition, margin
  - Most recent at top
- Career stats at venue/distance
- Jockey and trainer stats
- Action buttons: "Why this pick?", "Add to builder"
- "△ Collapse" (top-right)

### Interactions

1. **Tap Back**:
   - Returns to Racing Feed
   - Preserves scroll position

2. **Tap Favorite**:
   - Toggles favorite status
   - Saves to user's favorites list (future feature)

3. **Tap Share**:
   - Opens native share
   - Shares URL: predictedge.com/races/{raceId}

4. **Tap "Build Custom"** (Exotic Suggestions):
   - Opens Exotic Bet Builder
   - Pre-selects horses from suggestion

5. **Tap "Copy"**:
   - Copies bet string to clipboard
   - Shows toast: "Copied: Trifecta Box 2,5,7"

6. **Tap "Explain Why"**:
   - Opens AI Chat
   - Pre-fills: "Why do you suggest a Trifecta Box with horses 2,5,7?"

7. **Tap Horse Card** (collapsed):
   - Expands card (smooth animation)
   - Scrolls expanded card to top of viewport

8. **Tap "▼ Expand"**:
   - Same as tapping card

9. **Tap "△ Collapse"**:
   - Collapses card back to minimal view

10. **Tap "Why this pick?"**:
    - Opens AI Chat
    - Pre-fills: "Why is horse #2 Storm Chaser a good pick?"

11. **Tap "Add to builder"**:
    - Adds horse to exotic bet builder (if open)
    - Or opens builder with this horse selected

12. **Tap Sort Option**:
    - Reorders horse list
    - Smooth reorder animation

### Responsive Behavior

**Mobile**:
- Full-width cards
- Stacked vertically
- Expanded state takes full width
- Bottom navigation

**Tablet**:
- Wider cards with more horizontal info
- Side-by-side stats in expanded view

**Desktop**:
- Two-column layout: Horse list (left 60%), Sidebar (right 40%)
- Sidebar shows: AI suggestions, quick stats, related races

---

## Screen 3: Exotic Bet Builder (Modal)

### Layout Description

```
┌─────────────────────────────────────────────────────┐
│         Exotic Bet Builder                    [X]   │ ← Header
├─────────────────────────────────────────────────────┤
│                                                     │
│  Bet Type:                                          │
│  [Exacta] [Trifecta] [First 4] [Quinella]         │ ← Bet type pills
│                                                     │
│  Strategy:                                          │
│  [Box] [Banker] [Roving Banker]                    │ ← Strategy pills
│                                                     │
│  ─────────────────────────────────────────────     │
│                                                     │
│  Select Horses:                                     │
│                                                     │
│  ☑️ #2 Storm Chaser                   $5.00       │ ← Horse selection
│  ☐ #3 Fast Lane                       $8.00       │
│  ☑️ #5 Thunder Bolt                   $4.50       │
│  ☐ #6 Quick Silver                    $9.50       │
│  ☑️ #7 Lucky Seven                    $7.50       │
│  ☐ #8 Dark Horse                      $12.00      │
│  ☐ #9 Speed Demon                     $6.00       │
│  ... (more horses)                                 │
│                                                     │
│  ─────────────────────────────────────────────     │
│                                                     │
│  📊 Cost Breakdown:                                │ ← Live calculator
│                                                     │
│  Bet Type: Trifecta Box                            │
│  Horses Selected: 3 (2, 5, 7)                      │
│  Combinations: 6                                   │
│  Formula: 3 × 2 × 1 = 6                            │
│                                                     │
│  Cost per $1: $6.00                                │
│  Your stake: [$ 10.00 ▼]                           │ ← Editable
│  Total cost: $60.00                                │
│                                                     │
│  💰 Potential Return: $180 - $540                  │
│      (if any combination hits)                     │
│                                                     │
│  ─────────────────────────────────────────────     │
│                                                     │
│  [Copy to Clipboard]  [Clear All]  [Explain AI]   │ ← Actions
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Component Breakdown

**Modal Container**:
- Centered on screen (web), full height (mobile)
- Max width: 600px (web)
- bg-white (light) / bg-neutral-900 (dark)
- rounded-xl (web), sharp corners (mobile)
- shadow-2xl
- Backdrop: Semi-transparent dark overlay

**Header**:
- Title: "Exotic Bet Builder" (text-xl, font-semibold)
- Close button (X): Top-right, tap to close

**Bet Type Pills**:
- Horizontal row, wrap if needed
- Pill style: rounded-full, px-4, py-2
- Active: bg-primary-600, text-white
- Inactive: bg-neutral-200, text-neutral-700
- Tap to switch bet type

**Strategy Pills**:
- Same style as bet type
- Affects how selections work:
  - Box: All selected horses in all positions
  - Banker: One horse locked (must select which), others fill remaining
  - Roving Banker: One horse must appear somewhere

**Horse Selection List**:
- Scrollable (max-height: 40vh)
- Each row: Checkbox + Horse name + Odds
- Checkbox: Custom styled (not native)
  - Checked: bg-primary-600, white checkmark
  - Unchecked: border-neutral-300
- Hover: bg-neutral-50 highlight
- Tap anywhere on row to toggle checkbox

**Cost Breakdown Box**:
- Prominent, bg-primary-50 (light) / bg-primary-900/20 (dark)
- rounded-lg, p-4
- Updates live as selections change
- Shows:
  - Bet type name
  - Horses selected (numbers only)
  - Total combinations
  - Formula explanation
  - Cost per $1
  - User's stake (editable dropdown or input)
  - Total cost (stake × combinations)
  - Potential return range (optimistic/pessimistic)

**Action Buttons**:
- Three buttons, flex row, gap-2
- "Copy to Clipboard": Primary (bg-primary-600)
  - Copies formatted string: "Trifecta Box: 2,5,7 (6 combos, $60)"
- "Clear All": Secondary (border)
  - Deselects all horses
- "Explain AI": Secondary (border)
  - Opens AI chat with question about the selection

### Interactions

1. **Open Modal**:
   - Triggered from Race Detail ("Build Custom" button)
   - Or from AI suggestion tap
   - Smooth fade + scale animation

2. **Close Modal**:
   - Tap [X], tap backdrop, or swipe down (mobile)
   - Confirms if user has made selections: "Discard selections?"

3. **Select Bet Type**:
   - Taps pill → switches bet type
   - Resets selections (with confirmation if any exist)
   - Updates cost formula

4. **Select Strategy**:
   - Taps pill → switches strategy
   - If "Banker", prompts: "Which horse is the banker?"
   - Shows banker selection UI

5. **Toggle Horse**:
   - Tap row or checkbox → toggles selection
   - Immediate visual feedback (check appears)
   - Cost breakdown updates instantly (live calculation)

6. **Edit Stake**:
   - Tap on stake amount
   - Opens dropdown with presets ($5, $10, $20, $50, $100)
   - Or allows manual input
   - Updates total cost

7. **Copy to Clipboard**:
   - Copies bet details
   - Shows toast: "✓ Copied to clipboard"
   - User can paste in bookmaker app

8. **Clear All**:
   - Deselects all horses
   - Resets cost to $0

9. **Explain AI**:
   - Opens AI chat in split view or overlay
   - Pre-fills: "Why are these horses a good Trifecta combination?"

### Live Calculation Logic

```typescript
function calculateExoticCost(
  betType: 'exacta' | 'trifecta' | 'first4' | 'quinella',
  strategy: 'box' | 'banker' | 'rovingBanker',
  horses: string[],
  banker?: string
): { combinations: number; cost: number } {
  const n = horses.length;
  
  switch (betType) {
    case 'exacta':
      return strategy === 'box' 
        ? { combinations: n * (n - 1), cost: n * (n - 1) }
        : { combinations: 0, cost: 0 }; // Add banker logic
    
    case 'trifecta':
      return strategy === 'box'
        ? { combinations: n * (n - 1) * (n - 2), cost: n * (n - 1) * (n - 2) }
        : { combinations: 0, cost: 0 };
    
    case 'first4':
      return strategy === 'box'
        ? { combinations: n * (n - 1) * (n - 2) * (n - 3), cost: n * (n - 1) * (n - 2) * (n - 3) }
        : { combinations: 0, cost: 0 };
    
    case 'quinella':
      return { combinations: (n * (n - 1)) / 2, cost: (n * (n - 1)) / 2 };
  }
}
```

### States

- **Empty**: No horses selected, cost shows $0
- **Invalid**: < minimum horses for bet type, show warning
- **Valid**: All requirements met, "Copy" button enabled
- **Too Expensive**: Cost > user's bankroll, show warning

---

## Screen 4: AI Chat Interface

### Minimized State

```
                                                ┌────┐
                                                │ 🤖 │ ← Bubble
                                                └────┘
                                                  (3) ← Badge (unread)
```

**Specifications**:
- Position: Fixed bottom-right (web: 24px from edges, mobile: 16px)
- Size: 56x56px circle
- Background: Gradient (primary-500 → primary-600)
- Icon: Robot emoji or AI icon
- Badge: Red circle with count (if unread messages)
- Shadow: shadow-xl
- Z-index: 1000 (above all content)

### Expanded State

```
┌─────────────────────────────────────────────────────┐
│  🤖 AI Assistant             [Minimize] [X]         │ ← Header
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ You: Why is horse #5 favored in this race?   │ │ ← User message
│  │ 2:30 PM                                       │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ AI: Horse #5 "Thunder Bolt" is favored for   │ │ ← AI message
│  │ several reasons:                              │ │
│  │                                               │ │
│  │ 1. Strong recent form (1-2-1 in last 3)      │ │
│  │ 2. Excellent track/distance record (2 wins)  │ │
│  │ 3. Draw barrier 5 (ideal position)           │ │
│  │ 4. Jockey has 18% win rate at this venue     │ │
│  │                                               │ │
│  │ [View race details] [See full form]          │ │ ← Action buttons
│  │                                               │ │
│  │ 2:30 PM                                       │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ You: Should I box a trifecta with 2,5,7?     │ │
│  │ 2:31 PM                                       │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ AI: Yes, that's a solid trifecta box. Here's │ │
│  │ why:                                          │ │
│  │                                               │ │
│  │ • All three horses have strong win prob...   │ │
│  │ [Streaming response...]                      │ │ ← Typing indicator
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ▼▼▼ Scroll to see more ▼▼▼                       │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Type a message...                   [📎] [Send]   │ ← Input area
└─────────────────────────────────────────────────────┘
```

### Component Breakdown

**Modal/Overlay**:
- **Mobile**: Full-screen overlay (slides up from bottom)
- **Web**: Positioned overlay (bottom-right, 400px wide, 70vh high)
- Background: bg-white (light) / bg-neutral-900 (dark)
- rounded-tl-xl, rounded-tr-xl (mobile), rounded-xl (web)
- Shadow: shadow-2xl

**Header**:
- Title: "🤖 AI Assistant"
- Minimize button: Collapses to bubble
- Close button: Closes chat entirely (clears session)
- bg-primary-600, text-white
- Sticky at top

**Message Area**:
- Scrollable container (flex-1, overflow-auto)
- Messages stack vertically, space-3 between
- Auto-scroll to bottom when new message
- Padding: p-4

**User Message**:
- Right-aligned (ml-auto)
- Max-width: 80% of container
- bg-primary-600, text-white
- rounded-2xl (speech bubble style)
- Padding: px-4, py-3
- Timestamp below (text-xs, neutral-500)

**AI Message**:
- Left-aligned (mr-auto)
- Max-width: 80% of container
- bg-neutral-100 (light) / bg-neutral-800 (dark)
- rounded-2xl
- Padding: px-4, py-3
- Timestamp below
- Action buttons (if applicable): Below message, gap-2
  - Examples: "View race details", "Open bet builder", "See full form"
  - Style: bg-primary-100, text-primary-700, rounded-lg, px-3, py-1.5

**Typing Indicator**:
- Shows while AI is generating response
- Three animated dots: "● ● ●" (bounce animation)
- Same position as AI message

**Input Area**:
- Fixed at bottom
- bg-neutral-50 (light) / bg-neutral-800 (dark)
- Flex row: Input field + Attach button + Send button
- Input: Flex-1, text-base, placeholder: "Type a message..."
- Attach button: Paper clip icon (📎), opens race/game picker
- Send button: Enabled when input has text, bg-primary-600

### Interactions

1. **Open Chat** (from bubble):
   - Taps bubble → Expands to overlay
   - Smooth scale + fade animation
   - Focus on input field

2. **Minimize**:
   - Taps minimize → Collapses to bubble
   - Conversation preserved

3. **Close**:
   - Taps X → Confirms: "Clear this conversation?"
   - If confirmed, clears and closes

4. **Send Message**:
   - Types message, taps Send (or hits Enter)
   - Message appears immediately (optimistic UI)
   - AI response streams in token by token
   - Input clears after send

5. **Attach Context**:
   - Taps 📎 → Opens picker modal
   - User selects: Current race, specific race, or game
   - Picker closes, input field updates with context indicator
   - Example: "🏇 Flemington R5 attached"

6. **Tap Action Button** (in AI message):
   - "View race details" → Navigates to race detail
   - "Open bet builder" → Opens exotic bet builder
   - "See full form" → Opens horse detail modal

7. **Long Press Message**:
   - Shows context menu: Copy, Delete, Share

8. **Scroll Behavior**:
   - Auto-scrolls to bottom when new message
   - User can scroll up to view history
   - "Scroll to bottom" button appears when scrolled up

### Context Awareness

The AI chat knows:
- Current page user is on (race, game, analytics)
- Current race/game being viewed
- User's recent bets and performance
- Time of day (greeting: "Good morning")

**Example Context Injection**:
```typescript
const context = {
  page: 'race-detail',
  raceId: 'flemington-r5',
  race: {
    venue: 'Flemington',
    raceNumber: 5,
    postTime: '3:45 PM',
    topPicks: ['#5 Thunder Bolt', '#2 Storm Chaser', '#7 Lucky Seven']
  },
  user: {
    recentBets: [...],
    profitToday: +120,
    winRate: 0.68
  }
};
```

### Streaming Response

AI responses stream token-by-token using Server-Sent Events (SSE):

```typescript
// Client-side
const eventSource = new EventSource('/api/ai/chat');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'token') {
    appendToMessage(data.content); // Append token to message
  }
  
  if (data.type === 'done') {
    markMessageComplete();
    eventSource.close();
  }
};
```

---

## Screen 5: Performance Dashboard (Analytics)

### Layout Description

```
┌─────────────────────────────────────────────────────┐
│  ← Analytics          📥 Export  🔄 Refresh         │ ← Header
├─────────────────────────────────────────────────────┤
│                                                     │
│  Your Performance                                   │
│                                                     │
│  [7 Days] [30 Days] [90 Days] [All Time]          │ ← Period selector
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │   +$847     │  │    68%      │  │   3 W     │  │ ← Stat cards (row 1)
│  │  💰 Profit  │  │  📊 Win Rate│  │ 🔥 Streak │  │
│  └─────────────┘  └─────────────┘  └───────────┘  │
│                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │     24      │  │   $2,120    │  │  +34%     │  │ ← Stat cards (row 2)
│  │   Total Bets│  │   Staked    │  │   ROI     │  │
│  └─────────────┘  └─────────────┘  └───────────┘  │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  📈 Bankroll Over Time                             │ ← Chart section
│  ┌─────────────────────────────────────────────┐   │
│  │                                     5,847 •│   │ ← Line chart
│  │                                 •           │   │
│  │                            •                │   │
│  │                       •                     │   │
│  │ 5,000 •───────────•                        │   │
│  │                                             │   │
│  │ Jan 1   Jan 5   Jan 10   Jan 15   Today   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  📊 Profit by Sport                                │
│  ┌─────────────────────────────────────────────┐   │
│  │  Racing    ████████████████  +$520         │   │ ← Bar chart
│  │  Basketball ████████          +$227         │   │
│  │  AFL        ████              +$100         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  🎯 AI Comparison                                  │
│  ┌─────────────────────────────────────────────┐   │
│  │  AI Followed:     +$620  |  72% WR         │   │ ← Comparison box
│  │  AI Ignored:      +$227  |  61% WR         │   │
│  │                                             │   │
│  │  💡 Insight: You've made $393 more when    │   │
│  │     following AI recommendations            │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [View Bet History]  [Export Report]               │ ← Action buttons
│                                                     │
├─────────────────────────────────────────────────────┤
│  🏇  🏀  🏈  📊  ⚙️                               │
│              •                                      │
└─────────────────────────────────────────────────────┘
```

### Component Breakdown

**Header**:
- Back button (mobile only)
- Title: "Analytics"
- Export button: Downloads report (CSV/PDF)
- Refresh button: Refetches data

**Period Selector**:
- Pills: 7 Days, 30 Days, 90 Days, All Time
- Active: bg-primary-600, text-white
- Tap to switch period → refetch data

**Stat Cards (Grid)**:
- Grid: 3 columns (desktop), 2 columns (mobile)
- Each card:
  - Large number (text-4xl, font-bold)
  - Label below (text-sm, neutral-600)
  - Icon (emoji or Lucide icon)
  - Color-coded:
    - Green: Positive profit, winning streak
    - Red: Negative profit, losing streak
    - Blue/Neutral: Stats (win rate, ROI, total bets, staked)
  - bg-white (light) / bg-neutral-900 (dark)
  - rounded-xl, shadow-md, p-6

**Chart Sections**:
- Each chart has:
  - Title (text-lg, font-semibold)
  - Chart container (rounded-lg, bg-neutral-50)
  - Legend if needed

*Bankroll Over Time (Line Chart)*:
- X-axis: Dates
- Y-axis: Bankroll amount
- Line: Gradient fill below (primary-200 to transparent)
- Tooltip on hover: Shows exact date and balance
- Data points: Small circles on line

*Profit by Sport (Bar Chart)*:
- X-axis: Sport names
- Y-axis: Profit amount
- Bars: Horizontal, colored by sport
  - Racing: primary-600
  - Basketball: accent-purple
  - AFL: accent-orange
- Show exact profit value at end of each bar

**AI Comparison Box**:
- Prominent, bg-gradient (primary-50 to primary-100)
- Two rows:
  - Row 1: AI Followed (profit, win rate)
  - Row 2: AI Ignored (profit, win rate)
- Divider between rows
- Insight below: Auto-generated text comparing the two
  - Examples:
    - "You've made $393 more when following AI"
    - "Your win rate is 11% higher with AI picks"
    - "Consider following AI more often for better results"

**Action Buttons**:
- "View Bet History": Navigates to Bet History page
- "Export Report": Opens export modal

### Interactions

1. **Switch Period**:
   - Taps pill → Refetches data for that period
   - Smooth data transition (crossfade)
   - Loading skeleton while fetching

2. **Hover Stat Card** (web):
   - Subtle scale up (1.02x)
   - Shadow increases

3. **Hover Chart** (web):
   - Tooltip appears with exact values
   - Crosshair on line chart

4. **Tap Export**:
   - Opens Export Modal
   - Options: Format (CSV, PDF), Date range
   - Generates and downloads file

5. **Tap Refresh**:
   - Refetches all data
   - Shows loading spinner
   - Success toast

6. **Tap "View Bet History"**:
   - Navigates to Bet History page

### States

- **Loading**: Skeleton screens for all cards/charts
- **Empty**: "No bets recorded yet" with CTA: "Log your first bet"
- **Error**: Toast notification, retry button

---

## Screen 6: Bet History

### Layout Description

```
┌─────────────────────────────────────────────────────┐
│  ← Bet History                    [+ Log Bet]       │ ← Header
├─────────────────────────────────────────────────────┤
│                                                     │
│  Filters: [All] [Pending] [Won] [Lost]            │ ← Filter pills
│  Sport:   [All] [Racing] [Basketball] [AFL]        │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Flemington R5 - Thunder Bolt        WON ✅  │   │ ← Bet card 1
│  │ Jan 15, 3:45 PM                             │   │
│  │                                             │   │
│  │ Win • $4.50 • Stake: $20                   │   │
│  │ Return: $90.00 • Profit: +$70.00           │   │
│  │                                             │   │
│  │ ⭐ AI Recommended (85% confidence)          │   │
│  │                                             │   │
│  │ [View Race] [Edit] [Delete]                │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Lakers vs Celtics               PENDING ⏳  │   │ ← Bet card 2
│  │ Jan 16, 7:30 PM                             │   │
│  │                                             │   │
│  │ Lakers ML • $2.10 • Stake: $50             │   │
│  │ Potential return: $105.00                   │   │
│  │                                             │   │
│  │ [View Game] [Edit] [Delete]                │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Randwick R3 - Trifecta           LOST ❌   │   │ ← Bet card 3
│  │ Jan 14, 4:15 PM                             │   │
│  │                                             │   │
│  │ Trifecta Box 2,5,7 • Stake: $12            │   │
│  │ Return: $0.00 • Loss: -$12.00              │   │
│  │                                             │   │
│  │ Notes: Close, 5 came 2nd, 7 came 4th       │   │
│  │                                             │   │
│  │ [View Race] [Delete]                       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Load More]                                       │
│                                                     │
├─────────────────────────────────────────────────────┤
│  🏇  🏀  🏈  📊  ⚙️                               │
└─────────────────────────────────────────────────────┘
```

### Component Breakdown

**Header**:
- Back button: Returns to Analytics
- Title: "Bet History"
- "+ Log Bet" button: Opens Bet Logging Modal

**Filter Pills**:
- Two rows:
  - Row 1: Status filters (All, Pending, Won, Lost)
  - Row 2: Sport filters (All, Racing, Basketball, AFL)
- Active: bg-primary-600, inactive: bg-neutral-200
- Tap to filter list

**Bet Cards**:
- Stack vertically, space-4 between
- Each card:
  - Header: Event name + Status badge (right)
  - Sub-header: Date and time
  - Details: Bet type, odds, stake
  - Result: Return/profit (won), potential return (pending), loss (lost)
  - Optional: AI recommended badge, notes
  - Action buttons: View event, Edit (pending only), Delete

*Status Badges*:
- Won: bg-green-500, text-white, "WON ✅"
- Lost: bg-red-500, text-white, "LOST ❌"
- Pending: bg-yellow-500, text-white, "PENDING ⏳"
- Void: bg-neutral-500, text-white, "VOID"

*AI Recommended Badge*:
- Only if bet was AI recommended
- bg-primary-100, text-primary-700
- Icon: ⭐
- Shows confidence score

### Interactions

1. **Tap Filter**:
   - Applies filter → refetch bets
   - Can combine status + sport filters

2. **Tap Bet Card**:
   - Expands to show full details (if collapsed)
   - Or navigates to event (if expanded)

3. **Tap "View Event"**:
   - Navigates to race/game detail
   - Preserves context (can return to bet history)

4. **Tap "Edit"** (pending only):
   - Opens Bet Logging Modal in edit mode
   - Pre-fills bet details
   - Save updates bet

5. **Tap "Delete"**:
   - Confirms: "Delete this bet?"
   - If confirmed, removes bet
   - Toast: "Bet deleted"

6. **Tap "+ Log Bet"**:
   - Opens Bet Logging Modal (empty)

7. **Load More**:
   - Infinite scroll or "Load More" button
   - Fetches next page of bets

### States

- **Loading**: Skeleton cards
- **Empty**: "No bets found" with CTA
- **Error**: Toast + retry

---

## Screen 7: Bet Logging Modal

### Layout Description

```
┌─────────────────────────────────────────────────────┐
│           Log Your Bet                       [X]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Event *                                            │
│  [Search races/games...]                    [🔍]   │ ← Search field
│                                                     │
│  Selected: Flemington R5 - Thunder Bolt            │ ← Selection display
│                                                     │
│  Bet Type *                                         │
│  [Win ▼]                                            │ ← Dropdown
│                                                     │
│  Selection *                                        │
│  [#5 Thunder Bolt]                                  │ ← Text input
│                                                     │
│  Odds *                                             │
│  [4.50]                                             │ ← Number input
│                                                     │
│  Stake *                                            │
│  [$ 20.00]                                          │ ← Currency input
│  💡 Recommended: $18.50 (Kelly Criterion)          │ ← Suggestion
│                                                     │
│  Potential Return                                   │
│  $90.00                                             │ ← Calculated
│                                                     │
│  ☑️ This was an AI recommendation                  │ ← Checkbox
│                                                     │
│  Notes (optional)                                   │
│  [Add notes...]                                     │ ← Textarea
│                                                     │
│  ─────────────────────────────────────────────     │
│                                                     │
│  [Cancel]                      [Save Bet]          │ ← Actions
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Component Breakdown

**Modal Container**:
- Centered (web), full-screen (mobile)
- Max-width: 500px
- bg-white / bg-neutral-900
- rounded-xl, shadow-2xl

**Form Fields**:
- Vertical stack, space-4 between
- Each field:
  - Label (text-sm, font-medium, required marked with *)
  - Input (text-base, border-neutral-300, rounded-lg, p-3)
  - Error message below (if invalid)

*Event Search*:
- Text input with search icon
- As user types, shows dropdown with matching races/games
- Select from dropdown → populates "Selected" display

*Bet Type Dropdown*:
- Options: Win, Place, Each Way, Exacta, Trifecta, First 4, Quinella, Moneyline, Spread, Total, Player Prop, Custom
- Changes based on sport

*Selection Input*:
- Text input
- For racing: Horse name
- For sports: Team name or Over/Under

*Odds Input*:
- Number input, min 1.01
- Format: Decimal (e.g., 4.50)
- Validates on blur

*Stake Input*:
- Currency input ($)
- Validates: Must be > 0, <= user's bankroll
- Shows warning if > recommended size

*Kelly Suggestion*:
- Only shows if event has prediction data
- Calculates recommended bet using Kelly Criterion
- User can tap to auto-fill

*Potential Return*:
- Read-only, calculated: stake × odds
- Updates live as odds/stake change

*AI Recommendation Checkbox*:
- User indicates if this bet was AI recommended
- Enables performance comparison

*Notes Textarea*:
- Optional
- Placeholder: "Add notes..."
- Max 500 chars

### Interactions

1. **Type in Event Search**:
   - Shows dropdown with matching results
   - Debounced (300ms)
   - Up/down arrows navigate, Enter selects

2. **Select Event**:
   - Populates "Selected" display
   - Auto-fills Selection (if horse/team obvious)
   - Fetches prediction data (for Kelly suggestion)

3. **Change Bet Type**:
   - Updates Selection placeholder
   - Hides/shows relevant fields

4. **Input Odds/Stake**:
   - Live calculation of Potential Return
   - Validates on blur
   - Shows error if invalid

5. **Tap Kelly Suggestion**:
   - Auto-fills Stake field with recommended amount
   - Explanation tooltip on hover

6. **Check "AI Recommendation"**:
   - Toggles checkbox
   - Enables confidence score (future)

7. **Tap "Save Bet"**:
   - Validates all required fields
   - If valid: Saves bet, closes modal, shows toast
   - If invalid: Highlights errors

8. **Tap "Cancel"**:
   - Confirms if form has data: "Discard changes?"
   - Closes modal

### Validation Rules

- Event: Required
- Bet Type: Required
- Selection: Required
- Odds: Required, >= 1.01
- Stake: Required, > 0, <= bankroll

**Warnings (not blocking)**:
- Stake > Kelly suggestion: "This exceeds recommended bet size"
- Stake > 5% of bankroll: "High risk bet (>5% of bankroll)"

---

## Screen 8: Onboarding Flow

### Screen 1: Welcome

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
│              🏇 PredictEdge                         │ ← Logo
│                                                     │
│          Make Smarter Bets with                     │
│         AI-Powered Predictions                      │ ← Tagline
│                                                     │
│  • Get expert predictions for racing, basketball,  │
│    and AFL                                          │
│  • Track your betting performance                   │
│  • Learn from AI-powered insights                   │ ← Features
│                                                     │
│                                                     │
│  [Get Started]                                      │ ← CTA
│                                                     │
│  Already have an account? [Sign In]                │
│                                                     │
│  ●○○○○                                              │ ← Progress dots
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Screen 2: Bankroll Setup

```
┌─────────────────────────────────────────────────────┐
│                                         [Skip]      │
│                                                     │
│  Set Your Starting Bankroll                         │
│                                                     │
│  This helps us track your betting performance      │
│  and suggest appropriate bet sizes.                │ ← Explanation
│                                                     │
│  Don't worry, this doesn't connect to your         │
│  bookmaker - it's just for tracking! 🔒            │
│                                                     │
│  Starting Balance                                   │
│  [$ 5,000.00 ]                                      │ ← Input
│                                                     │
│  💡 Tip: Start with what you're comfortable        │
│  betting over the next few months                   │
│                                                     │
│                                                     │
│  [Continue]                                         │
│                                                     │
│  ○●○○○                                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Screen 3: Sport Selection

```
┌─────────────────────────────────────────────────────┐
│                                         [Skip]      │
│                                                     │
│  Which Sports Interest You?                         │
│                                                     │
│  Select at least one (you can change this later)   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         🏇                                   │   │
│  │    Horse Racing                             │   │ ← Sport card
│  │  Get predictions for races across Australia │   │
│  │                                             │   │
│  │              [✓ Selected]                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         🏀                                   │   │
│  │     Basketball                              │   │
│  │   NBA & NBL game predictions               │   │
│  │                                             │   │
│  │              [ ] Select                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         🏈                                   │   │
│  │        AFL                                   │   │
│  │   AFL game and player prop predictions     │   │
│  │                                             │   │
│  │              [ ] Select                     │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  [Continue]                                         │
│                                                     │
│  ○○●○○                                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Screen 4: Tutorial (Swipeable)

**Slide 1:**
```
┌─────────────────────────────────────────────────────┐
│                                         [Skip]      │
│                                                     │
│          [Illustration: Race card]                  │ ← Image/animation
│                                                     │
│  How Predictions Work                               │
│                                                     │
│  We analyze thousands of data points including     │
│  form, jockey stats, track conditions, and more    │
│  to give you win probabilities for every race.     │
│                                                     │
│                                                     │
│  [Next]                                             │
│                                                     │
│  ○○○●○                                              │
│  Swipe to continue →                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Slide 2:**
```
┌─────────────────────────────────────────────────────┐
│                                         [Skip]      │
│                                                     │
│          [Illustration: Exotic bet builder]         │
│                                                     │
│  Building Exotic Bets                               │
│                                                     │
│  Tap any race to see our exotic bet suggestions.   │
│  Use the bet builder to create custom trifectas,   │
│  exactas, and more with live cost calculation.     │
│                                                     │
│                                                     │
│  [Next]                                             │
│                                                     │
│  ○○○○●                                              │
│  Swipe to continue →                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Screen 5: Sample Walkthrough

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  Try It Out!                                        │
│                                                     │
│  Here's a sample race. Tap on the race card to     │
│  explore the predictions.                           │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ 🏇 Flemington R5          3:45 PM             │ │
│  │─────────────────────────────────────────────  │ │
│  │ 1200m • Good 4 • $50,000                      │ │
│  │                                  👆 Tap here  │ │ ← Prompt
│  │ 🥇 #5 Thunder Bolt    $4.50  ⭐⭐⭐⭐        │ │
│  │    35% Win • 67% Place  💰 Value            │ │
│  │                                               │ │
│  │ 🥈 #2 Storm Chaser    $5.00  ⭐⭐⭐          │ │
│  │ 🥉 #7 Lucky Seven     $7.50  ⭐⭐            │ │
│  │                                               │ │
│  │ [View Card] [Ask AI] [Track Bet]            │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  [Skip Tutorial]         [Done]                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Interactions

1. **Screen 1** (Welcome):
   - Tap "Get Started" → Next screen
   - Tap "Sign In" → Navigate to login

2. **Screen 2** (Bankroll):
   - Input bankroll (validates: > $50)
   - Tap "Continue" → Next screen
   - Tap "Skip" → Uses default ($1,000)

3. **Screen 3** (Sports):
   - Tap sport card → Toggles selection
   - Must select at least one
   - Tap "Continue" → Next screen

4. **Screen 4** (Tutorial Slides):
   - Swipe left/right to navigate
   - Tap "Next" → Next slide
   - Tap "Skip" → Jump to end

5. **Screen 5** (Sample Walkthrough):
   - Interactive: User can tap and explore sample race
   - Tap "Done" → Complete onboarding, navigate to home

### States

- **Progress Dots**: Show current step
- **Skip Button**: Available on all screens except first
- **Back Button**: Not shown (encourage forward progress)

---

## Screen 9: Settings

### Layout Description

```
┌─────────────────────────────────────────────────────┐
│  ← Settings                                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Account                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │  👤 Profile          john@example.com   →   │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  💰 Bankroll        $5,847            →   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Preferences                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │  🏇 Preferred Sports                    →   │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  📊 Risk Preference  Moderate          →   │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  🌙 Theme           Auto               →   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Notifications                                      │
│  ┌─────────────────────────────────────────────┐   │
│  │  Race Starting Soon            [Toggle ON]  │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Bet Settled                   [Toggle ON]  │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  High Value Opportunity        [Toggle OFF] │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Data & Privacy                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  📥 Export My Data                      →   │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  🗑️ Clear Cache                         →   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Support                                            │
│  ┌─────────────────────────────────────────────┐   │
│  │  ❓ Help & FAQ                          →   │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  📧 Contact Support                     →   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  🚪 Sign Out                                │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Version 1.0.0                                      │
│                                                     │
├─────────────────────────────────────────────────────┤
│  🏇  🏀  🏈  📊  ⚙️                               │
│                    •                                │
└─────────────────────────────────────────────────────┘
```

---

## Responsive Design Rules

### Breakpoints

```css
/* Mobile First */
@media (min-width: 640px) { /* sm */ }
@media (min-width: 768px) { /* md - tablet */ }
@media (min-width: 1024px) { /* lg - laptop */ }
@media (min-width: 1280px) { /* xl - desktop */ }
```

### Layout Adjustments

**Mobile (<768px)**:
- Single column
- Bottom navigation (5 tabs)
- Full-width cards
- Reduced padding (16px → 12px)
- Smaller fonts (scale down 10%)
- Stacked buttons (vertical)
- Floating AI chat bubble

**Tablet (768-1024px)**:
- Two-column grid for cards
- Side navigation (optional)
- Larger cards with more info
- Normal padding (16px)
- Standard fonts

**Desktop (>1024px)**:
- Three-column grid for dashboards
- Persistent sidebar navigation
- AI chat can dock to side
- Larger padding (24px)
- Max-width containers (1280px)

### Touch Targets

- Minimum size: 44x44px (iOS), 48x48px (Android)
- Spacing between targets: 8px minimum
- Buttons: min-height 44px

---

## Animation & Transitions

### Micro-interactions

- Button hover: Scale 1.02x, shadow increase (200ms ease)
- Card hover: Shadow lg → xl (200ms ease)
- Toggle switch: Slide ball, color change (300ms ease)
- Checkbox: Checkmark draw animation (300ms)
- Loading spinner: Rotate continuously (1s linear infinite)
- Toast notification: Slide in from top (300ms ease-out)

### Page Transitions

- Navigate forward: Slide left (300ms ease-in-out)
- Navigate back: Slide right (300ms ease-in-out)
- Modal open: Fade + scale from 0.95 to 1 (200ms ease-out)
- Modal close: Fade + scale to 0.95 (150ms ease-in)

### Data Updates

- Live odds change: Flash yellow → fade (1s)
- New prediction: Gentle pulse (500ms)
- Bankroll update: Count up animation (1s)

---

## Accessibility

### WCAG 2.1 AA Compliance

- Color contrast: 4.5:1 (normal), 3:1 (large text)
- Focus indicators: 2px solid outline on all interactive elements
- Alt text: All images, icons have descriptive text
- ARIA labels: Buttons, links, form inputs
- Semantic HTML: nav, main, section, article, aside

### Keyboard Navigation

- Tab order: Logical and predictable
- Escape: Closes modals/overlays
- Arrow keys: Navigate lists, toggles
- Enter/Space: Activate buttons, checkboxes

### Screen Reader Support

- Live regions: Announce dynamic updates (odds, notifications)
- Role attributes: button, link, checkbox, radiogroup
- State attributes: aria-expanded, aria-checked, aria-selected

### Motion Preferences

- Respect `prefers-reduced-motion`
- Disable animations if set
- Keep essential transitions (page nav)

---

This completes the comprehensive UI/UX wireframe specification document! 🎨
