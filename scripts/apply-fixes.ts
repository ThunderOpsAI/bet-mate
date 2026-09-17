import fs from 'fs';
import path from 'path';

console.log("Starting patch process...");

// 1. Update cron.ts
const cronPath = path.resolve(__dirname, '../apps/api/src/routes/cron.ts');
if (fs.existsSync(cronPath)) {
  let cronContent = fs.readFileSync(cronPath, 'utf8');

  const populateFunction = `
    // --- NEW: Populate TopEntity ---
    try {
      const mlApiTarget = process.env.ML_API_URL || "http://127.0.0.1:8000";
      const jockeys = await fetch(\`\${mlApiTarget}/explore/top-jockeys\`).then(r => r.ok ? r.json() : []);
      const trainers = await fetch(\`\${mlApiTarget}/explore/top-trainers\`).then(r => r.ok ? r.json() : []);
      
      const harnessDrivers = await fetch(\`\${mlApiTarget}/explore/top-harness-drivers\`).then(r => r.ok ? r.json() : []).catch(() => []);
      const harnessTrainers = await fetch(\`\${mlApiTarget}/explore/top-harness-trainers\`).then(r => r.ok ? r.json() : []).catch(() => []);
      const dogTrainers = await fetch(\`\${mlApiTarget}/explore/top-dog-trainers\`).then(r => r.ok ? r.json() : []).catch(() => []);

      await prisma.topEntity.deleteMany({});
      const entitiesToInsert = [];

      jockeys.slice(0, 50).forEach((j: any, i: number) => entitiesToInsert.push({ category: "Top 50 Jockeys", entityName: j.name || j.jockeyName || "Unknown", rank: i + 1, sport: "racing", metrics: j }));
      trainers.slice(0, 20).forEach((t: any, i: number) => entitiesToInsert.push({ category: "Top 20 Horse Trainers", entityName: t.name || t.trainerName || "Unknown", rank: i + 1, sport: "racing", metrics: t }));
      
      harnessDrivers.slice(0, 15).forEach((d: any, i: number) => entitiesToInsert.push({ category: "Top 15 Harness Drivers", entityName: d.name || d.jockeyName || "Unknown", rank: i + 1, sport: "harness", metrics: d }));
      harnessTrainers.slice(0, 10).forEach((t: any, i: number) => entitiesToInsert.push({ category: "Top 10 Harness Trainers", entityName: t.name || t.trainerName || "Unknown", rank: i + 1, sport: "harness", metrics: t }));
      dogTrainers.slice(0, 30).forEach((t: any, i: number) => entitiesToInsert.push({ category: "Top 30 Dog Trainers", entityName: t.name || t.trainerName || "Unknown", rank: i + 1, sport: "greyhound", metrics: t }));

      if (entitiesToInsert.length > 0) {
        await prisma.topEntity.createMany({ data: entitiesToInsert });
        console.log(\`Successfully auto-populated \${entitiesToInsert.length} TopEntities for the new day.\`);
      }
    } catch (topErr) {
      console.warn("Failed to populate TopEntities during bet settlement:", topErr);
    }
`;

  // Look for the end of the settle-bets block before the return/res.status(200)
  if (!cronContent.includes("Populate TopEntity")) {
    // Attempt to inject right before res.status(200).json({ message: "Settlement process complete"
    const targetString = 'res.status(200).json({';
    if (cronContent.includes(targetString)) {
      cronContent = cronContent.replace(targetString, populateFunction + '\n    ' + targetString);
      fs.writeFileSync(cronPath, cronContent);
      console.log("✅ Patched cron.ts successfully.");
    } else {
      console.log("⚠️ Could not find exact injection point in cron.ts. You may need to paste the code manually.");
    }
  } else {
    console.log("ℹ️ cron.ts is already patched.");
  }
} else {
  console.log("❌ cron.ts not found at", cronPath);
}

// 2. Update page.tsx
const pagePath = path.resolve(__dirname, '../apps/web/app/blackbook/page.tsx');
if (fs.existsSync(pagePath)) {
  let pageContent = fs.readFileSync(pagePath, 'utf8');

  const emptyStateRegex = /if \(runners\.length === 0\) return null;/;
  const emptyStateReplacement = `if (runners.length === 0) {
                return (
                  <div key={cat}>
                     <h2 className="text-xs font-mono text-cyan-400 mb-3 uppercase tracking-widest">{cat}</h2>
                     <div className="bg-slate-950/50 border border-slate-800/40 rounded-2xl p-4 text-center">
                        <span className="text-slate-500 text-sm italic">{cat} — Updating rankings...</span>
                     </div>
                  </div>
                );
              }`;

  if (emptyStateRegex.test(pageContent)) {
    pageContent = pageContent.replace(emptyStateRegex, emptyStateReplacement);
    fs.writeFileSync(pagePath, pageContent);
    console.log("✅ Patched page.tsx successfully.");
  } else {
    console.log("ℹ️ page.tsx already patched or target string not found.");
  }
} else {
  console.log("❌ page.tsx not found at", pagePath);
}

console.log("Patch process finished!");
