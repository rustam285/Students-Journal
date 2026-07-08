import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Очищаем данные
  await prisma.attendanceRecord.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.studentGroup.deleteMany();
  await prisma.teacherGroup.deleteMany();
  await prisma.student.deleteMany();
  await prisma.group.deleteMany();
  await prisma.term.deleteMany();
  await prisma.user.deleteMany();

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

  // Создаём учебный период
  const term = await prisma.term.create({
    data: {
      name: '2025-2026',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-01-31'),
      isActive: true,
    },
  });

  // Создаём группу ТФИ-101 с одним студентом
  const group = await prisma.group.create({
    data: {
      name: 'ТФИ-101',
      description: 'Технологии будущего, 1 курс, 1 группа',
    },
  });

  const student = await prisma.student.create({
    data: {
      firstName: 'Иван',
      lastName: 'Петров',
      email: 'petrov@student.csu.ru',
      phone: '+7(900)123-45-67',
    },
  });

  await prisma.studentGroup.create({
    data: {
      studentId: student.id,
      groupId: group.id,
    },
  });

  console.log('✅ Seed completed!');
  console.log('');
  console.log('📋 Admin account:');
  console.log(`   Email: ${admin.email}`);
  console.log(`   Password: admin123`);
  console.log('');
  console.log(`📚 Created:`);
  console.log(`   Term: ${term.name}`);
  console.log(`   Group: ${group.name}`);
  console.log(`   Student: ${student.lastName} ${student.firstName}`);
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
