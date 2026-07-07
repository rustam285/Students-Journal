import { PrismaClient, Role, AttendanceStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Очищаем данные (порядок важен для foreign keys)
  await prisma.attendanceRecord.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.studentGroup.deleteMany();
  await prisma.teacherGroup.deleteMany();
  await prisma.student.deleteMany();
  await prisma.group.deleteMany();
  await prisma.term.deleteMany();
  await prisma.user.deleteMany();

  const password = await hash('password123', 10);

  // === Пользователи ===
  const admin = await prisma.user.create({
    data: {
      name: 'Администратор Системы',
      email: 'admin@csu.ru',
      passwordHash: password,
      role: Role.ADMIN,
      mustChangePassword: false,
    },
  });

  const teacher = await prisma.user.create({
    data: {
      name: 'Иванов Петр Сергеевич',
      email: 'ivanov@csu.ru',
      passwordHash: password,
      role: Role.TEACHER,
      mustChangePassword: false,
    },
  });

  const studentUser1 = await prisma.user.create({
    data: {
      name: 'Петрова Анна Ивановна',
      email: 'petrova@student.csu.ru',
      passwordHash: password,
      role: Role.STUDENT,
      mustChangePassword: false,
    },
  });

  const studentUser2 = await prisma.user.create({
    data: {
      name: 'Сидоров Дмитрий Алексеевич',
      email: 'sidorov@student.csu.ru',
      passwordHash: password,
      role: Role.STUDENT,
      mustChangePassword: false,
    },
  });

  // === Учебный период ===
  const term = await prisma.term.create({
    data: {
      name: '2025-2026 Осень',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-01-31'),
      isActive: true,
    },
  });

  // === Группы ===
  const group1 = await prisma.group.create({
    data: {
      name: 'ТФИ-301',
      description: 'Технологии будущего, 3 курс, 1 группа',
      homeroomTeacherId: teacher.id,
    },
  });

  const group2 = await prisma.group.create({
    data: {
      name: 'ПМИ-201',
      description: 'Прикладная математика и информатика, 2 курс, 1 группа',
    },
  });

  // === Студенты (карточки в справочнике) ===
  const students = await Promise.all([
    prisma.student.create({
      data: {
        firstName: 'Анна',
        lastName: 'Петрова',
        email: 'petrova@student.csu.ru',
        phone: '+7(900)123-45-67',
        userId: studentUser1.id,
      },
    }),
    prisma.student.create({
      data: {
        firstName: 'Дмитрий',
        lastName: 'Сидоров',
        email: 'sidorov@student.csu.ru',
        phone: '+7(900)234-56-78',
        userId: studentUser2.id,
      },
    }),
    prisma.student.create({
      data: {
        firstName: 'Елена',
        lastName: 'Козлова',
        email: 'kozlova@student.csu.ru',
        phone: '+7(900)345-67-89',
      },
    }),
    prisma.student.create({
      data: {
        firstName: 'Алексей',
        lastName: 'Новиков',
        email: 'novikov@student.csu.ru',
        phone: '+7(900)456-78-90',
      },
    }),
    prisma.student.create({
      data: {
        firstName: 'Мария',
        lastName: 'Смирнова',
        email: 'smirnova@student.csu.ru',
        phone: '+7(900)567-89-01',
      },
    }),
  ]);

  // === Распределяем студентов по группам ===
  // Группа 1 (ТФИ-301): Петрова, Сидоров, Козлова
  await prisma.studentGroup.createMany({
    data: [
      { studentId: students[0].id, groupId: group1.id },
      { studentId: students[1].id, groupId: group1.id },
      { studentId: students[2].id, groupId: group1.id },
    ],
  });

  // Группа 2 (ПМИ-201): Новиков, Смирнова, Петрова (в двух группах)
  await prisma.studentGroup.createMany({
    data: [
      { studentId: students[3].id, groupId: group2.id },
      { studentId: students[4].id, groupId: group2.id },
      { studentId: students[0].id, groupId: group2.id },
    ],
  });

  // === Занятия ===
  const lessonDates = [
    '2025-09-01', '2025-09-03', '2025-09-08', '2025-09-10',
    '2025-09-15', '2025-09-17', '2025-09-22', '2025-09-24',
    '2025-09-29', '2025-10-01',
  ];

  const topics = [
    'Введение в предмет. Силлабус.',
    'Основы алгоритмизации',
    'Структуры данных: массивы и списки',
    'Структуры данных: деревья и графы',
    'Алгоритмы сортировки',
    'Алгоритмы поиска',
    'Рекурсия и итерация',
    'Динамическое программирование',
    'Жадные алгоритмы',
    'Итоговое повторение',
  ];

  const lessons = [];
  for (let i = 0; i < 10; i++) {
    const groupId = i < 5 ? group1.id : group2.id;
    const lesson = await prisma.lesson.create({
      data: {
        groupId,
        termId: term.id,
        teacherId: teacher.id,
        date: new Date(lessonDates[i]),
        topic: topics[i],
        notes: i === 0 ? 'Раздать силлабусы' : null,
      },
    });
    lessons.push(lesson);
  }

  // === Записи посещаемости ===
  const statuses: AttendanceStatus[] = [
    AttendanceStatus.PRESENT,
    AttendanceStatus.ABSENT,
    AttendanceStatus.LATE,
  ];

  // Для занятий 0-4 (группа 1) — студенты 0,1,2
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 3; j++) {
      await prisma.attendanceRecord.create({
        data: {
          lessonId: lessons[i].id,
          studentId: students[j].id,
          status: statuses[Math.floor(Math.random() * 3)],
          grade: Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 3 : null,
          comment: j === 1 && i === 2 ? 'Отсутствовал по болезни' : null,
        },
      });
    }
  }

  // Для занятий 5-9 (группа 2) — студенты 0,3,4
  for (let i = 5; i < 10; i++) {
    for (const j of [0, 3, 4]) {
      await prisma.attendanceRecord.create({
        data: {
          lessonId: lessons[i].id,
          studentId: students[j].id,
          status: statuses[Math.floor(Math.random() * 3)],
          grade: Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 3 : null,
        },
      });
    }
  }

  console.log('✅ Seed completed!');
  console.log('');
  console.log('📋 Test accounts (password: password123):');
  console.log(`   Admin:   ${admin.email}`);
  console.log(`   Teacher: ${teacher.email}`);
  console.log(`   Student: ${studentUser1.email}`);
  console.log(`   Student: ${studentUser2.email}`);
  console.log('');
  console.log(`📚 Created: 1 Term, 2 Groups, 5 Students, 10 Lessons`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
