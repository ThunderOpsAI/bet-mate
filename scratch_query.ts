import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const bets = await prisma.system_bets.findMany();
  console.log("Total bets:", bets.length);
  const thisWeekBets = bets.filter(b => b.created_at && new Date(b.created_at) > new Date('2026-08-31'));
  console.log("Bets this week:", thisWeekBets.length);
  if (thisWeekBets.length > 0) {
     console.log(thisWeekBets.slice(0, 5));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
