import os
import re

FILES = [
    "apps/web/app/afl/page.tsx",
    "apps/web/app/nrl/page.tsx",
    "apps/web/app/nba/page.tsx",
    "apps/web/app/soccer/page.tsx",
    "apps/web/app/mma/page.tsx",
]

SORT_HOOK_CODE = """
  const sortedGames = useMemo(() => {
    const list = games.filter(game => game.home_team !== "Team None" && game.away_team !== "Team None");
    return list.sort((a, b) => {
      if (sortMode === "time") {
        const timeA = a.date ? new Date(a.date).getTime() : Infinity;
        const timeB = b.date ? new Date(b.date).getTime() : Infinity;
        return timeA - timeB;
      }
      
      const predA = predictions[a.game_id]?.predictions;
      const predB = predictions[b.game_id]?.predictions;
      
      if (sortMode === "win_probability") {
        const maxProbA = predA ? Math.max(predA.home_win_probability ?? 50, predA.away_win_probability ?? 50) : 0;
        const maxProbB = predB ? Math.max(predB.home_win_probability ?? 50, predB.away_win_probability ?? 50) : 0;
        return maxProbB - maxProbA;
      }
      
      if (sortMode === "edge_percent") {
        const edgeAHome = predA && predA.market_odds_home && predA.home_win_probability ? ((predA.home_win_probability / 100) * predA.market_odds_home) - 1 : 0;
        const edgeAAway = predA && predA.market_odds_away && predA.away_win_probability ? ((predA.away_win_probability / 100) * predA.market_odds_away) - 1 : 0;
        const maxEdgeA = Math.max(edgeAHome, edgeAAway);
        
        const edgeBHome = predB && predB.market_odds_home && predB.home_win_probability ? ((predB.home_win_probability / 100) * predB.market_odds_home) - 1 : 0;
        const edgeBAway = predB && predB.market_odds_away && predB.away_win_probability ? ((predB.away_win_probability / 100) * predB.market_odds_away) - 1 : 0;
        const maxEdgeB = Math.max(edgeBHome, edgeBAway);
        
        return maxEdgeB - maxEdgeA;
      }
      
      return 0;
    });
  }, [games, predictions, sortMode]);
"""

SORT_UI_CODE = """
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4 px-1">
          <h2 className="text-xl font-extrabold text-slate-100 flex items-center gap-2">
            Matchups
          </h2>
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500 w-full sm:w-auto"
          >
            <option value="time">Sort by Time</option>
            <option value="win_probability">Highest Win Prob</option>
            <option value="edge_percent">Highest Edge %</option>
          </select>
        </div>
        <div className="game-cards-list">
          {sortedGames.map((game) => {"""

for filepath in FILES:
    if not os.path.exists(filepath):
        print(f"Skipping {filepath}, does not exist.")
        continue
        
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    if "const [sortMode," in content:
        print(f"Already processed {filepath}")
        continue
        
    # Add sortMode state right after setGames
    content = re.sub(
        r'(const \[games, setGames\] = useState<.*>.*)',
        r'\1\n  const [sortMode, setSortMode] = useState<"time" | "win_probability" | "edge_percent">("time");',
        content,
        count=1
    )
    
    # Check if useMemo is imported
    if "useMemo" not in content[:500]:
        content = re.sub(r'import \{([^\}]+)\} from "react";', r'import {\1, useMemo} from "react";', content, count=1)
    
    # Inject useMemo block right before `const isMountedRef = useRef(true);` or right before the main return
    # Find `const isMountedRef = useRef(true);`
    if "const isMountedRef =" in content:
        content = content.replace("  const isMountedRef =", SORT_HOOK_CODE + "\n  const isMountedRef =")
    else:
        # Fallback to right before `return (`
        # We need to be careful to hit the outer return
        # Let's just find the last `return (` before the closing tags
        # Actually it's easier to find `  return (` that starts the component render
        content = re.sub(r'(  return \(\n\s*<(?:div|ErrorBoundary|Fragment|>))', SORT_HOOK_CODE + r'\n\1', content, count=1)

    # Replace the JSX for game-cards-list
    # The original can be:
    # <div className="game-cards-list">
    #   {games.map((game) => {
    # OR
    # <div className="game-cards-list">
    #   {games
    #     .filter(...)
    #     .map((game) => {
    
    # We will use regex to find `<div className="game-cards-list">` up to `.map((game) => {`
    pattern = r'<div className="game-cards-list">\s*\{games(?:[\s\S]*?)\.map\(\(game\) => \{'
    content = re.sub(pattern, SORT_UI_CODE, content)
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
        
    print(f"Successfully updated {filepath}")

