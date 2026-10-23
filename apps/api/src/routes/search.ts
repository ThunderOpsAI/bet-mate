import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma: any = new PrismaClient();

export interface SearchResultItem {
  id: string;
  name: string;
  category: "RUNNER" | "JOCKEY" | "TRAINER" | "COMBINATION";
  sport?: string;
  details?: string;
  jockeyName?: string;
  trainerName?: string;
  horseName?: string;
  badge?: string;
  strikeRate?: string;
}

// Seed dataset of high-profile Australian racing entities for instant, rich fuzzy matching
const SEED_DATA: {
  runners: Array<{ name: string; sport: string; details: string; jockeyName?: string; trainerName?: string }>;
  jockeys: Array<{ name: string; details: string; strikeRate: string }>;
  trainers: Array<{ name: string; details: string }>;
  combinations: Array<{ name: string; details: string; jockeyName: string; trainerName: string }>;
} = {
  runners: [
    { name: "Bold Command", sport: "Thoroughbred", details: "Trainer: C. Maher | Jockey: J. Kah", jockeyName: "J. Kah", trainerName: "C. Maher" },
    { name: "Shadow King", sport: "Thoroughbred", details: "Trainer: J. Cummings | Jockey: D. Lane", jockeyName: "D. Lane", trainerName: "J. Cummings" },
    { name: "Apex Warrior", sport: "Thoroughbred", details: "Trainer: M. Price | Jockey: C. Williams", jockeyName: "C. Williams", trainerName: "M. Price" },
    { name: "Velocita", sport: "Thoroughbred", details: "Trainer: A. Neasham | Jockey: B. Shinn", jockeyName: "B. Shinn", trainerName: "A. Neasham" },
    { name: "Star Sentinel", sport: "Thoroughbred", details: "Trainer: G. Waterhouse | Jockey: M. Dee", jockeyName: "M. Dee", trainerName: "G. Waterhouse" },
    { name: "Ironclad Spirit", sport: "Thoroughbred", details: "Trainer: C. Waller | Jockey: J. McDonald", jockeyName: "J. McDonald", trainerName: "C. Waller" },
    { name: "Northern Glow", sport: "Thoroughbred", details: "Trainer: M. Freedman | Jockey: J. Kah", jockeyName: "J. Kah", trainerName: "M. Freedman" },
    { name: "Desert Storm", sport: "Thoroughbred", details: "Trainer: P. Moody | Jockey: C. Williams", jockeyName: "C. Williams", trainerName: "P. Moody" },
    { name: "Golden Monarch", sport: "Thoroughbred", details: "Trainer: K. Lees | Jockey: D. Lane", jockeyName: "D. Lane", trainerName: "K. Lees" },
    { name: "Titanium Knight", sport: "Thoroughbred", details: "Trainer: C. Maher | Jockey: B. Shinn", jockeyName: "B. Shinn", trainerName: "C. Maher" },
    { name: "Royal Sapphire", sport: "Thoroughbred", details: "Trainer: A. & S. Freedman | Jockey: M. Dee", jockeyName: "M. Dee", trainerName: "A. & S. Freedman" },
    { name: "Cyber Streak", sport: "Thoroughbred", details: "Trainer: C. Waller | Jockey: J. McDonald", jockeyName: "J. McDonald", trainerName: "C. Waller" },
    { name: "Vanguard", sport: "Thoroughbred", details: "Trainer: G. Waterhouse | Jockey: T. Berry", jockeyName: "T. Berry", trainerName: "G. Waterhouse" },
    { name: "Leap To Fame", sport: "Harness", details: "Trainer: G. Dixon | Driver: G. Dixon | Win Rate: 85%", jockeyName: "G. Dixon", trainerName: "G. Dixon" },
    { name: "Swayzee", sport: "Harness", details: "Trainer: J. Grimson | Driver: C. Geary", jockeyName: "C. Geary", trainerName: "J. Grimson" },
    { name: "Victa Damian", sport: "Greyhound", details: "SA Sprint Champion | Win Rate: 70%" },
    { name: "Adhana Zip", sport: "Greyhound", details: "Distance Specialist | Win Rate: 45%" },
  ],
  jockeys: [
    { name: "J. McDonald", details: "Group 1 Champion | Sydney Metro", strikeRate: "22%" },
    { name: "J. Kah", details: "Melbourne Premiership Leader", strikeRate: "18%" },
    { name: "C. Williams", details: "Veteran G1 Jockey", strikeRate: "15%" },
    { name: "B. Shinn", details: "Top-tier Metro Rider", strikeRate: "19%" },
    { name: "D. Lane", details: "International G1 Rider", strikeRate: "16%" },
    { name: "Z. Purton", details: "HK Champion Jockey", strikeRate: "24%" },
    { name: "M. Dee", details: "Big Race Specialist", strikeRate: "14%" },
    { name: "T. Berry", details: "Sydney Metro Premier Rider", strikeRate: "17%" },
    { name: "G. Dixon", details: "Grand Circuit Harness Driver", strikeRate: "40%" },
  ],
  trainers: [
    { name: "C. Waller", details: "Dominant Metro Stable | 14x Champion Trainer" },
    { name: "C. Maher", details: "National Powerhouse Stable" },
    { name: "G. Waterhouse", details: "G1 Royalty Stable (G. Waterhouse & A. Bott)" },
    { name: "A. Neasham", details: "Elite Middle Distance Stable" },
    { name: "P. Moody", details: "Moody & Coleman Racing" },
    { name: "T. Gollan", details: "Brisbane Premiership Leader" },
    { name: "J. Pride", details: "Sprint & WFA Specialist" },
    { name: "K. Lees", details: "Newcastle / Provincial Powerhouse" },
  ],
  combinations: [
    { name: "J. McDonald & C. Waller", details: "Combined Strike Rate: 28% | 14 G1 Wins", jockeyName: "J. McDonald", trainerName: "C. Waller" },
    { name: "J. Kah & M. Freedman", details: "Combined Strike Rate: 24%", jockeyName: "J. Kah", trainerName: "M. Freedman" },
    { name: "B. Shinn & C. Maher", details: "Combined Strike Rate: 22%", jockeyName: "B. Shinn", trainerName: "C. Maher" },
    { name: "G. Dixon & G. Dixon", details: "Harness Dominance | 85% Top 3 Finish", jockeyName: "G. Dixon", trainerName: "G. Dixon" },
  ],
};

const TRENDING_SEARCHES: SearchResultItem[] = [
  {
    id: "tr-1",
    name: "Leap To Fame",
    category: "RUNNER",
    sport: "Harness",
    details: "Grand Circuit Hero | 85% Win Rate",
    jockeyName: "G. Dixon",
    trainerName: "G. Dixon",
    badge: "🔥 Top Performer",
  },
  {
    id: "tr-2",
    name: "J. McDonald",
    category: "JOCKEY",
    details: "Group 1 Champion | 22% Strike Rate",
    strikeRate: "22%",
    badge: "⭐ Champion",
  },
  {
    id: "tr-3",
    name: "C. Waller",
    category: "TRAINER",
    details: "14x Premiership Winner",
    badge: "🏆 Top Stable",
  },
  {
    id: "tr-4",
    name: "J. McDonald & C. Waller",
    category: "COMBINATION",
    details: "28% Win Rate | 14 G1s",
    jockeyName: "J. McDonald",
    trainerName: "C. Waller",
    badge: "⚡ Power Combo",
  },
  {
    id: "tr-5",
    name: "Victa Damian",
    category: "GREYHOUND" as any,
    sport: "Greyhound",
    details: "SA Sprint Leader | 70% Win Rate",
    badge: "⚡ Speedster",
  },
  {
    id: "tr-6",
    name: "Ironclad Spirit",
    category: "RUNNER",
    sport: "Thoroughbred",
    details: "Trainer: C. Waller | Win Rate: 40%",
    jockeyName: "J. McDonald",
    trainerName: "C. Waller",
    badge: "📈 Form Runner",
  },
];

/**
 * GET /api/search
 * Accepts ?q=query&category=ALL|RUNNER|JOCKEY|TRAINER|COMBINATION
 */
router.get("/", async (req, res) => {
  try {
    const rawQuery = (req.query.q as string || "").trim();
    const query = rawQuery.toLowerCase();
    const requestedCategory = ((req.query.category as string) || "ALL").toUpperCase();

    // 1. Fetch DB matches if database contains entries
    let dbRunners: any[] = [];
    let dbBlackbookItems: any[] = [];

    if (query.length > 0) {
      try {
        dbRunners = await prisma.prediction_log.findMany({
          where: {
            OR: [
              { selection: { contains: rawQuery, mode: "insensitive" } },
              { event_name: { contains: rawQuery, mode: "insensitive" } },
              { sport: { contains: rawQuery, mode: "insensitive" } },
            ],
          },
          take: 20,
          orderBy: { created_at: "desc" },
        });
      } catch (dbErr) {
        // Fallback gracefully if prediction_log isn't seeded
        dbRunners = [];
      }

      try {
        dbBlackbookItems = await prisma.blackbookItem.findMany({
          where: {
            OR: [
              { targetName: { contains: rawQuery, mode: "insensitive" } },
              { jockeyName: { contains: rawQuery, mode: "insensitive" } },
              { trainerName: { contains: rawQuery, mode: "insensitive" } },
              { horseName: { contains: rawQuery, mode: "insensitive" } },
            ],
          },
          take: 20,
        });
      } catch (dbErr) {
        dbBlackbookItems = [];
      }
    }

    // 2. Perform fuzzy search across seed data & DB records
    const runnerResults: SearchResultItem[] = [];
    const jockeyResults: SearchResultItem[] = [];
    const trainerResults: SearchResultItem[] = [];
    const combinationResults: SearchResultItem[] = [];

    const seenIds = new Set<string>();

    if (query.length > 0) {
      // Search Seed Runners
      SEED_DATA.runners.forEach((r) => {
        if (
          r.name.toLowerCase().includes(query) ||
          r.sport.toLowerCase().includes(query) ||
          (r.jockeyName && r.jockeyName.toLowerCase().includes(query)) ||
          (r.trainerName && r.trainerName.toLowerCase().includes(query))
        ) {
          const id = `seed-runner-${r.name.replace(/\s+/g, "-").toLowerCase()}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            runnerResults.push({
              id,
              name: r.name,
              category: "RUNNER",
              sport: r.sport,
              details: r.details,
              jockeyName: r.jockeyName,
              trainerName: r.trainerName,
              horseName: r.name,
            });
          }
        }
      });

      // Search DB Runners
      dbRunners.forEach((pred) => {
        const id = `db-runner-${pred.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const payload = typeof pred.payload_json === "object" && pred.payload_json ? pred.payload_json : {};
          const jockey = payload.jockey_name || payload.jockeyName;
          const trainer = payload.trainer_name || payload.trainerName;
          runnerResults.push({
            id,
            name: pred.selection,
            category: "RUNNER",
            sport: pred.sport || "Racing",
            details: `Event: ${pred.event_name}${trainer ? ` | Trainer: ${trainer}` : ""}`,
            jockeyName: jockey,
            trainerName: trainer,
            horseName: pred.selection,
          });
        }
      });

      // Search Seed Jockeys
      SEED_DATA.jockeys.forEach((j) => {
        if (j.name.toLowerCase().includes(query) || j.details.toLowerCase().includes(query)) {
          const id = `seed-jockey-${j.name.replace(/\s+/g, "-").toLowerCase()}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            jockeyResults.push({
              id,
              name: j.name,
              category: "JOCKEY",
              details: j.details,
              strikeRate: j.strikeRate,
              jockeyName: j.name,
            });
          }
        }
      });

      // Search Seed Trainers
      SEED_DATA.trainers.forEach((t) => {
        if (t.name.toLowerCase().includes(query) || t.details.toLowerCase().includes(query)) {
          const id = `seed-trainer-${t.name.replace(/\s+/g, "-").toLowerCase()}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            trainerResults.push({
              id,
              name: t.name,
              category: "TRAINER",
              details: t.details,
              trainerName: t.name,
            });
          }
        }
      });

      // Search Seed Combinations
      SEED_DATA.combinations.forEach((c) => {
        if (
          c.name.toLowerCase().includes(query) ||
          c.jockeyName.toLowerCase().includes(query) ||
          c.trainerName.toLowerCase().includes(query)
        ) {
          const id = `seed-combo-${c.name.replace(/\s+/g, "-").toLowerCase()}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            combinationResults.push({
              id,
              name: c.name,
              category: "COMBINATION",
              details: c.details,
              jockeyName: c.jockeyName,
              trainerName: c.trainerName,
            });
          }
        }
      });

      // Search DB Blackbook items
      dbBlackbookItems.forEach((bb) => {
        const id = `db-bb-${bb.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          const cat = (bb.entityType || "RUNNER").toUpperCase() as "RUNNER" | "JOCKEY" | "TRAINER" | "COMBINATION";
          const item: SearchResultItem = {
            id,
            name: bb.targetName,
            category: cat,
            details: `Saved BlackBook target | Track: ${bb.trackName || "Metro"}`,
            jockeyName: bb.jockeyName || undefined,
            trainerName: bb.trainerName || undefined,
            horseName: bb.horseName || undefined,
          };
          if (cat === "JOCKEY") jockeyResults.push(item);
          else if (cat === "TRAINER") trainerResults.push(item);
          else if (cat === "COMBINATION") combinationResults.push(item);
          else runnerResults.push(item);
        }
      });
    }

    // Filter by requested category if specified
    const filteredResults = {
      RUNNER: requestedCategory === "ALL" || requestedCategory === "RUNNER" ? runnerResults : [],
      JOCKEY: requestedCategory === "ALL" || requestedCategory === "JOCKEY" ? jockeyResults : [],
      TRAINER: requestedCategory === "ALL" || requestedCategory === "TRAINER" ? trainerResults : [],
      COMBINATION: requestedCategory === "ALL" || requestedCategory === "COMBINATION" ? combinationResults : [],
    };

    return res.json({
      success: true,
      query: rawQuery,
      category: requestedCategory,
      results: filteredResults,
      trending: TRENDING_SEARCHES,
    });
  } catch (error: any) {
    console.error("Search API Error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to execute search query",
      details: error.message,
    });
  }
});

export default router;
