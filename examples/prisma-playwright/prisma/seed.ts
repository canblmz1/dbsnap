import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

await prisma.user.upsert({
  where: { email: "demo@example.com" },
  update: { name: "Demo User" },
  create: {
    email: "demo@example.com",
    name: "Demo User",
  },
});

await prisma.$disconnect();
