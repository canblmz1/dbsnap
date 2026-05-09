import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

await prisma.user.createMany({
  data: Array.from({ length: 10 }, (_, index) => ({
    email: `user${index + 1}@example.com`,
    name: `User ${index + 1}`
  })),
  skipDuplicates: true
});

await prisma.$disconnect();
