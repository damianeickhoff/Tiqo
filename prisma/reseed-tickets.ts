import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Clears tickets (comments and activities cascade) and rewinds every ticket
 * counter, so `prisma db seed` can lay the demo queue down again from 0001. Users,
 * projects and labels are left alone. Development convenience only.
 */
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const { count } = await prisma.ticket.deleteMany({});

  // Every ticket counter, not just the instance-wide one: each type and month
  // keeps its own sequence for the reference (`ticket:INC:2609`), and leaving
  // those standing would restart the demo queue at 0003.
  const { count: counters } = await prisma.counter.deleteMany({
    where: { id: { startsWith: "ticket" } },
  });

  console.log(`Removed ${count} tickets and rewound ${counters} counters.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
