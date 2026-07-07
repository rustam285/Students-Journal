import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const password = await hash('admin123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Администратор',
      email: 'admin@csu.ru',
      passwordHash: password,
      role: Role.ADMIN,
      mustChangePassword: false,
    },
  });

  console.log('✅ Seed completed!');
  console.log('');
  console.log('📋 Admin account:');
  console.log(`   Email: ${admin.email}`);
  console.log(`   Password: admin123`);
  console.log('');
  console.log('⚠️  Смените пароль после первого входа!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
