import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ML_API_URL = process.env.ML_API_URL || "http://127.0.0.1:8000";

async function fetchFromML(endpoint: string) {
  try {
    const res = await fetch(`${ML_API_URL}${endpoint}`);
    if (!res.ok) throw new Error(`ML API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch ${endpoint}:`, err);
    return [];
  }
}

async function main() {
  console.log("Seeding TopEntity table from ML API...");

  // Fetch data
  const horses = await fetchFromML("/explore/top-horses");
  const jockeys = await fetchFromML("/explore/top-jockeys");
  const trainers = await fetchFromML("/explore/top-trainers");
  
  // Try to fetch harness/dog specific if available
  const harnessDrivers = await fetchFromML("/explore/top-harness-drivers").catch(() => []);
  const harnessTrainers = await fetchFromML("/explore/top-harness-trainers").catch(() => []);
  const dogTrainers = await fetchFromML("/explore/top-dog-trainers").catch(() => []);

  // Clear existing
  await prisma.topEntity.deleteMany({});
  console.log("Cleared existing TopEntity records.");

  const entitiesToInsert: any[] = [];

  // Top 50 Horses
  const topHorses = horses.slice(0, 50);
  topHorses.forEach((h: any, i: number) => {
    entitiesToInsert.push({
      category: "Top 50 Horses",
      entityName: h.name || h.entityName || "Unknown",
      rank: i + 1,
      sport: "racing",
      metrics: h,
    });
  });

  // Top 30 Jockeys
  const topJockeys = jockeys.slice(0, 30);
  topJockeys.forEach((j: any, i: number) => {
    entitiesToInsert.push({
      category: "Top 30 Jockeys",
      entityName: j.name || j.jockeyName || "Unknown",
      rank: i + 1,
      sport: "racing",
      metrics: j,
    });
  });

  // Top 20 Horse Trainers
  const topTrainers = trainers.slice(0, 20);
  topTrainers.forEach((t: any, i: number) => {
    entitiesToInsert.push({
      category: "Top 20 Horse Trainers",
      entityName: t.name || t.trainerName || "Unknown",
      rank: i + 1,
      sport: "racing",
      metrics: t,
    });
  });

  // Top 15 Harness Drivers
  const topHarnessDrivers = harnessDrivers.slice(0, 15);
  topHarnessDrivers.forEach((d: any, i: number) => {
    entitiesToInsert.push({
      category: "Top 15 Harness Drivers",
      entityName: d.name || d.jockeyName || "Unknown",
      rank: i + 1,
      sport: "harness",
      metrics: d,
    });
  });

  // Top 10 Harness Trainers
  const topHarnessTrainers = harnessTrainers.slice(0, 10);
  topHarnessTrainers.forEach((t: any, i: number) => {
    entitiesToInsert.push({
      category: "Top 10 Harness Trainers",
      entityName: t.name || t.trainerName || "Unknown",
      rank: i + 1,
      sport: "harness",
      metrics: t,
    });
  });

  // Top 30 Dog Trainers
  const topDogTrainers = dogTrainers.slice(0, 30);
  topDogTrainers.forEach((t: any, i: number) => {
    entitiesToInsert.push({
      category: "Top 30 Dog Trainers",
      entityName: t.name || t.trainerName || "Unknown",
      rank: i + 1,
      sport: "greyhound",
      metrics: t,
    });
  });

  if (entitiesToInsert.length > 0) {
    await prisma.topEntity.createMany({
      data: entitiesToInsert,
    });
    console.log(`Successfully seeded ${entitiesToInsert.length} TopEntity records.`);
  } else {
    console.log("No entities to insert.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
