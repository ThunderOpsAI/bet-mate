import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.race.deleteMany({});
  console.log(`Deleted ${result.count} races.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
