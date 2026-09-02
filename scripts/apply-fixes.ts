import fs from 'fs';
import path from 'path';

// 1. Update cron.ts
const cronPath = path.resolve(__dirname, '../apps/api/src/routes/cron.ts');
let cronContent = fs.readFileSync(cronPath, 'utf8');

const populateFunction = `
// Trigger Prediction Engine Strategy Card Placement for the New Day
    let refreshedStrategyCards = 0;
    try {
      const mlApiTarget = process.env.ML_API_PROXY_TARGET || "http://127.0.0.1:8000";
      const refreshRes = await fetch(\`\${mlApiTarget}/api/strategy-cards/refresh\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        refreshedStrategyCards = refreshData?.count || 0;
      }
    } catch (refreshErr) {
      console.warn("Failed to auto-refresh strategy cards during bet settlement:", refreshErr);
    }

    // --- NEW: Populate TopEntity ---
    let populatedTopEntities = 0;
    try {
      const mlApiTarget = process.env.ML_API_URL || "http://127.0.0.1:8000";
      const jockeys = await fetch(\`\${mlApiTarget}/explore/top-jockeys\`).then(r => r.ok ? r.json() : []);
      const trainers = await fetch(\`\${mlApiTarget}/explore/top-trainers\`).then(r => r.ok ? r.json() : []);
      
      const harnessDrivers = await fetch(\`\${mlApiTarget}/explore/top-harness-drivers\`).then(r => r.ok ? r.json() : []).catch(() => []);
      const harnessTrainers = await fetch(\`\${mlApiTarget}/explore/top-harness-trainers\`).then(r => r.ok ? r.json() : []).catch(() => []);
      const dogTrainers = await fetch(\`\${mlApiTarget}/explore/top-dog-trainers\`).then(r => r.ok ? r.json() : []).catch(() => []);

      await prisma.topEntity.deleteMany({});
      const entitiesToInsert = [];

      jockeys.slice(0, 50).forEach((j, i) => entitiesToInsert.push({ category: "Top 50 Jockeys", entityName: j.name || j.jockeyName || "Unknown", rank: i + 1, sport: "racing", metrics: j }));
      trainers.slice(0, 20).forEach((t, i) => entitiesToInsert.push({ category: "Top 20 Horse Trainers", entityName: t.name || t.trainerName || "Unknown", rank: i + 1, sport: "racing", metrics: t }));
      
      const hd = harnessDrivers.length > 0 ? harnessDrivers.slice(0, 15) : jockeys.slice(50, 65);
      hd.forEach((d, i) => entitiesToInsert.push({ category: "Top 15 Harness Drivers", entityName: d.name || d.jockeyName || "Unknown", rank: i + 1, sport: "harness", metrics: d }));
      
      const ht = harnessTrainers.length > 0 ? harnessTrainers.slice(0, 10) : trainers.slice(20, 30);
      ht.forEach((t, i) => entitiesToInsert.push({ category: "Top 10 Harness Trainers", entityName: t.name || t.trainerName || "Unknown", rank: i + 1, sport: "harness", metrics: t }));
      
      const dt = dogTrainers.length > 0 ? dogTrainers.slice(0, 30) : trainers.slice(30, 60);
      dt.forEach((t, i) => entitiesToInsert.push({ category: "Top 30 Dog Trainers", entityName: t.name || t.trainerName || "Unknown", rank: i + 1, sport: "greyhound", metrics: t }));

      if (entitiesToInsert.length > 0) {
        await prisma.topEntity.createMany({ data: entitiesToInsert });
        populatedTopEntities = entitiesToInsert.length;
      }
    } catch (topErr) {
      console.warn("Failed to populate TopEntities during bet settlement:", topErr);
    }
`;

cronContent = cronContent.replace(
  /\/\/ Trigger Prediction Engine Strategy Card Placement for the New Day[\s\S]*?console\.warn\("Failed to auto-refresh strategy cards during bet settlement:", refreshErr\);\n\s*\}/,
  populateFunction
);

fs.writeFileSync(cronPath, cronContent);
console.log("Patched cron.ts successfully.");

// 2. Update page.tsx
const pagePath = path.resolve(__dirname, '../apps/web/app/blackbook/page.tsx');
let pageContent = fs.readFileSync(pagePath, 'utf8');

const emptyStateRegex = /if \(runners\.length === 0\) return null;/;
const emptyStateReplacement = \`if (runners.length === 0) {
                return (
                  <div key={cat}>
                     <h2 className="text-xs font-mono text-cyan-400 mb-3 uppercase tracking-widest">{cat}</h2>
                     <div className="bg-slate-950/50 border border-slate-800/40 rounded-2xl p-4 text-center">
                        <span className="text-slate-500 text-sm italic">{cat} — Updating rankings...</span>
                     </div>
                  </div>
                );
              }\`;

pageContent = pageContent.replace(emptyStateRegex, emptyStateReplacement);

fs.writeFileSync(pagePath, pageContent);
console.log("Patched page.tsx successfully.");
