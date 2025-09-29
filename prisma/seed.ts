import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPass = await argon2.hash('admin123');
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: adminPass,
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMIN,
    },
  });

  // Categories
  const electronics = await prisma.category.upsert({
    where: { name: 'Electronics' },
    update: {},
    create: { name: 'Electronics' },
  });
  const books = await prisma.category.upsert({
    where: { name: 'Books' },
    update: {},
    create: { name: 'Books' },
  });

  // Products
  await prisma.product.createMany({
    data: [
      { name: 'Smartphone', description: 'Great phone', priceCents: 69900, taxRatePct: 10, stock: 50, categoryId: electronics.id },
      { name: 'Laptop', description: 'Powerful laptop', priceCents: 129900, taxRatePct: 10, stock: 25, categoryId: electronics.id },
      { name: 'Headphones', description: 'Noise cancelling', priceCents: 19900, taxRatePct: 10, stock: 100, categoryId: electronics.id },
      { name: 'Novel', description: 'Bestseller', priceCents: 1500, taxRatePct: 0, stock: 200, categoryId: books.id },
      { name: 'Textbook', description: 'Learn things', priceCents: 4500, taxRatePct: 0, stock: 80, categoryId: books.id },
    ],
    skipDuplicates: true,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
