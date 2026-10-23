import re

with open("apps/web/app/components/VariantA_CyberpunkTerminal.tsx", "r") as f:
    content = f.read()

memo_logic = """
  const targetVenues = ["randwick", "rosehill", "warwick farm", "canterbury", "flemington", "caulfield", "moonee valley", "sandown", "doomben", "eagle farm", "morphettville", "gawler", "sydney", "melbourne", "brisbane", "adelaide", "brissy"];
  const displayRaces = React.useMemo(() => {
    const filtered = racesData.filter(r => targetVenues.some(v => (r.venue || "").toLowerCase().includes(v)));
    return filtered.length > 0 ? filtered : racesData;
  }, [racesData]);
"""

# Find the end of nextSportsData memo
# It looks like:
#   const nextSportsData = React.useMemo(() => {
# ...
#     return combined.slice(0, 5);
#   }, [aflGames, nbaGames, nrlGames, soccerGames, golfTournaments, mmaMatchups]);
# We want to replace `combined.slice(0, 5)` with `combined.slice(0, 4)` first
content = content.replace("return combined.slice(0, 5);", "return combined.slice(0, 4);")

# Inject memo_logic right before it
inject_target = "  const nextSportsData = React.useMemo(() => {"
content = content.replace(inject_target, memo_logic + "\n" + inject_target)

# Change map calls
content = content.replace("{racesData.slice(0, 5).map(", "{displayRaces.slice(0, 4).map(")
content = content.replace("Array.from({ length: 3 }).map", "Array.from({ length: 4 }).map")

# Update classNames
old_card_class = "bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col h-full min-h-[300px]"
new_card_class = "bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-3 md:p-4 shadow-xl flex flex-col h-[340px] md:h-[350px] overflow-hidden"

old_bb_class = "bg-slate-900/70 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col min-h-[300px]"
new_bb_class = "bg-slate-900/70 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-3 md:p-4 shadow-xl flex flex-col h-[340px] md:h-[350px] overflow-hidden"

old_ev_class = "bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl flex-1 flex flex-col min-h-[300px]"
new_ev_class = "bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-3 md:p-4 shadow-xl flex-1 flex flex-col h-[340px] md:h-[350px] overflow-hidden"

content = content.replace(old_card_class, new_card_class)
content = content.replace(old_bb_class, new_bb_class)
content = content.replace(old_ev_class, new_ev_class)

# Update BB layout to expand fully
content = content.replace("min-h-[142px]", "min-h-[220px]")

with open("apps/web/app/components/VariantA_CyberpunkTerminal.tsx", "w") as f:
    f.write(content)

