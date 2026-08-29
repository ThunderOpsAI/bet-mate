import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  await prisma.user.update({
    where: { email: "thunder@betmate.com" },
    data: { emailConfirmed: true }
  });
  console.log("Updated!");
}
main();
