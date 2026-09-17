import sys
import re

with open("apps/web/app/components/VariantA_CyberpunkTerminal.tsx", "r") as f:
    content = f.read()

# Add the filtered races logic right after nextSportsData useMemo
memo_logic = """
  const targetVenues = ["randwick", "rosehill", "warwick farm", "canterbury", "flemington", "caulfield", "moonee valley", "sandown", "doomben", "eagle farm", "morphettville", "gawler", "sydney", "melbourne", "brisbane", "adelaide", "brissy"];
  const displayRaces = React.useMemo(() => {
    const filtered = racesData.filter(r => targetVenues.some(v => (r.venue || "").toLowerCase().includes(v)));
    return filtered.length > 0 ? filtered : racesData;
  }, [racesData]);
"""

# Replace all 4 cards' wrapper divs to have a fixed height of ~350px (which is about 6% smaller than standard 5 items auto-height)
# and use displayRaces instead of racesData
content = content.replace("  useEffect(() => {", memo_logic + "\n  useEffect(() => {")
content = content.replace("{racesData.slice(0, 5).map(", "{displayRaces.slice(0, 4).map(")

# Update the cards to have exactly the same height and smaller padding
old_card_class = "bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col h-full min-h-[300px]"
new_card_class = "bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-3 md:p-4 shadow-xl flex flex-col h-[340px] md:h-[350px] overflow-hidden"

old_bb_class = "bg-slate-900/70 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-4 md:p-6 shadow-xl flex flex-col min-h-[300px]"
new_bb_class = "bg-slate-900/70 backdrop-blur-md border border-cyan-500/20 rounded-2xl p-3 md:p-4 shadow-xl flex flex-col h-[340px] md:h-[350px] overflow-hidden"

old_ev_class = "bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-4 md:p-6 shadow-xl flex-1 flex flex-col min-h-[300px]"
new_ev_class = "bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-3 md:p-4 shadow-xl flex-1 flex flex-col h-[340px] md:h-[350px] overflow-hidden"


content = content.replace(old_card_class, new_card_class)
content = content.replace(old_bb_class, new_bb_class)
content = content.replace(old_ev_class, new_ev_class)

# Next Sport items change slice from 5 to 4 so it matches height of others
content = content.replace("return combined.slice(0, 5);", "return combined.slice(0, 4);")

# Change EV feed from 3 to 4 if we want them all to have 4 items? The EV feed says "capped at 3 items".
# We can change it to 4 so all columns look identical.
content = content.replace("Array.from({ length: 3 }).map", "Array.from({ length: 4 }).map")

# Change Blackbooker to be more vertically expansive to fill the space
content = content.replace("min-h-[142px]", "min-h-[220px]")

with open("apps/web/app/components/VariantA_CyberpunkTerminal.tsx", "w") as f:
    f.write(content)

print("Updates applied.")
