"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  fetchScheduleGroups,
  fetchScheduleTeachers,
  fetchTeacherSchedule,
  matchScheduleTeacher,
  splitDateRange,
} from "@/lib/schedule-api";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILL_RANGE_DAYS = 366;

const fillSchema = z
  .object({
    groupId: z.string().min(1),
    scheduleTeacherId: z.number().int().positive(),
    scheduleGroupId: z.number().int().positive(),
    dateFrom: z.string().regex(dateRe),
    dateTo: z.string().regex(dateRe),
  })
  .refine((v) => v.dateFrom <= v.dateTo, { message: "Дата «с» не может быть позже даты «по»" })
  .refine(
    (v) =>
      (new Date(`${v.dateTo}T00:00:00Z`).getTime() - new Date(`${v.dateFrom}T00:00:00Z`).getTime()) /
        (24 * 60 * 60 * 1000) <
      MAX_FILL_RANGE_DAYS,
    { message: "Период автозаполнения не может превышать год" }
  );

/** Проверка доступа преподавателя к группе (как в createLesson). */
async function checkTeacherGroupAccess(userId: string, role: string, groupId: string) {
  if (role === "TEACHER") {
    const hasAccess = await prisma.group.findFirst({
      where: {
        id: groupId,
        deletedAt: null,
        OR: [
          { homeroomTeacherId: userId },
          { additionalTeachers: { some: { teacherId: userId } } },
        ],
      },
    });
    if (!hasAccess) throw new Error("Forbidden");
  }
}

/**
 * Данные для диалога автозаполнения: справочники расписания + предвыбор
 * преподавателя (сохранённый id, иначе сопоставление по ФИО) и группы
 * (сохранённый id, иначе совпадение названия).
 */
export async function getFillSetup(groupId: string) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const [group, user, scheduleGroups, scheduleTeachers] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
    fetchScheduleGroups(),
    fetchScheduleTeachers(),
  ]);

  if (!group || group.deletedAt) throw new Error("Группа не найдена");
  if (!user) throw new Error("Unauthorized");

  await checkTeacherGroupAccess(user.id, user.role, groupId);

  const storedTeacher = user.scheduleTeacherId
    ? scheduleTeachers.find((t) => t.id === user.scheduleTeacherId) ?? null
    : null;
  const matchedTeacher = matchScheduleTeacher(user.name, scheduleTeachers);

  const storedGroup = group.scheduleGroupId
    ? scheduleGroups.find((g) => g.id === group.scheduleGroupId) ?? null
    : null;
  const matchedGroup = scheduleGroups.find(
    (g) => g.title.trim() === group.name.trim()
  ) ?? null;

  return {
    scheduleTeacherId: (storedTeacher ?? matchedTeacher)?.id ?? null,
    scheduleGroupId: (storedGroup ?? matchedGroup)?.id ?? null,
    teachers: [...scheduleTeachers].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    groups: [...scheduleGroups].sort((a, b) => a.title.localeCompare(b.title, "ru")),
  };
}

export interface FillResult {
  created: number;
  skipped: number;
  subjectsCreated: number;
  scheduleLessonsFound: number;
}

/**
 * Автозаполнение журнала занятиями из расписания преподавателя за период:
 * создаются только свои пары выбранной группы (постоянное расписание +
 * замены), отсутствующие предметы создаются автоматически, посещаемость —
 * всем «Присутствует». Уже существующие занятия (группа + дата + пара)
 * пропускаются — повторное заполнение ничего не дублирует.
 */
export async function fillJournalFromSchedule(input: {
  groupId: string;
  scheduleTeacherId: number;
  scheduleGroupId: number;
  dateFrom: string;
  dateTo: string;
}): Promise<FillResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const parsed = fillSchema.parse(input);

  const [group, user] = await Promise.all([
    prisma.group.findUnique({ where: { id: parsed.groupId } }),
    prisma.user.findUnique({ where: { id: session.user.id } }),
  ]);
  if (!group || group.deletedAt) throw new Error("Группа не найдена");
  if (!user) throw new Error("Unauthorized");

  await checkTeacherGroupAccess(user.id, user.role, group.id);

  // Запоминаем выбранное сопоставление (даже если пар не найдётся)
  if (user.scheduleTeacherId !== parsed.scheduleTeacherId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { scheduleTeacherId: parsed.scheduleTeacherId },
    });
  }
  if (group.scheduleGroupId !== parsed.scheduleGroupId) {
    await prisma.group.update({
      where: { id: group.id },
      data: { scheduleGroupId: parsed.scheduleGroupId },
    });
  }

  const scheduleGroups = await fetchScheduleGroups();
  const groupTitle = scheduleGroups.find((g) => g.id === parsed.scheduleGroupId)?.title;
  if (!groupTitle) {
    throw new Error("Группа с таким id не найдена на сайте расписания");
  }

  // Расписание берём окнами ≤ 31 дня (лимит API)
  const scheduleLessons = (
    await Promise.all(
      splitDateRange(parsed.dateFrom, parsed.dateTo).map(([from, to]) =>
        fetchTeacherSchedule(parsed.scheduleTeacherId, from, to)
      )
    )
  ).flat();

  // Свои пары этой группы; номера пар журнала — целые 1–8 («ЭКЗ» пропускаем)
  type WantedLesson = {
    date: string;
    lessonNumber: number;
    discipline: string;
    notes: string | null;
  };
  const seen = new Set<string>();
  const wanted: WantedLesson[] = [];
  let examSlotsSkipped = 0;

  for (const lesson of scheduleLessons) {
    if (!lesson.groups.includes(groupTitle)) continue;
    const lessonNumber = Number.parseInt(lesson.number, 10);
    if (!Number.isInteger(lessonNumber) || lessonNumber < 1 || lessonNumber > 8) {
      examSlotsSkipped += 1; // экзаменационный слот «ЭКЗ» и прочие нестандартные
      continue;
    }
    const key = `${lesson.date}|${lessonNumber}`;
    if (seen.has(key)) continue; // дубль номера в этот день — оставляем первый
    seen.add(key);

    const discipline = (lesson.discipline || "").trim() || "Занятие";
    const noteParts = [
      (lesson.format || "").trim(),
      lesson.auditorium != null ? `ауд. ${lesson.auditorium}` : null,
      lesson.isSpecial ? "по спец. объявлению" : null,
    ].filter((part): part is string => Boolean(part));

    wanted.push({
      date: lesson.date,
      lessonNumber,
      discipline,
      notes: noteParts.length > 0 ? noteParts.join(", ") : null,
    });
  }

  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term) throw new Error("Нет активного учебного периода");

  const existingLessons = await prisma.lesson.findMany({
    where: {
      groupId: group.id,
      deletedAt: null,
      date: { gte: new Date(`${parsed.dateFrom}T00:00:00Z`), lte: new Date(`${parsed.dateTo}T00:00:00Z`) },
    },
    select: { date: true, lessonNumber: true },
  });
  const existingKeys = new Set(
    existingLessons.map((l) => `${l.date.toISOString().slice(0, 10)}|${l.lessonNumber}`)
  );

  const toCreate = wanted.filter((l) => !existingKeys.has(`${l.date}|${l.lessonNumber}`));
  const skipped = wanted.length - toCreate.length;

  // Предметы: недостающие создаём как личные предметы преподавателя
  // (у Subject уникальность (name, teacherId))
  const distinctDisciplines = Array.from(new Set(toCreate.map((l) => l.discipline)));
  const ownedSubjects = await prisma.subject.findMany({
    where: { teacherId: user.id, name: { in: distinctDisciplines } },
    select: { id: true, name: true },
  });
  const subjectIds = new Map(ownedSubjects.map((s) => [s.name, s.id]));
  let subjectsCreated = 0;
  for (const name of distinctDisciplines) {
    if (subjectIds.has(name)) continue;
    const created = await prisma.subject.create({
      data: { name, teacherId: user.id },
    });
    subjectIds.set(name, created.id);
    subjectsCreated += 1;
  }

  const studentIds = (
    await prisma.studentGroup.findMany({
      where: { groupId: group.id },
      select: { studentId: true },
    })
  ).map((s) => s.studentId);

  let created = 0;
  if (toCreate.length > 0) {
    created = await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const lesson of toCreate) {
        const newLesson = await tx.lesson.create({
          data: {
            groupId: group.id,
            termId: term.id,
            teacherId: user.id,
            subjectId: subjectIds.get(lesson.discipline) ?? null,
            date: new Date(`${lesson.date}T00:00:00Z`),
            lessonNumber: lesson.lessonNumber,
            topic: lesson.discipline,
            notes: lesson.notes,
          },
        });
        count += 1;
        if (studentIds.length > 0) {
          await tx.attendanceRecord.createMany({
            data: studentIds.map((studentId) => ({
              lessonId: newLesson.id,
              studentId,
              status: "PRESENT" as const,
            })),
            skipDuplicates: true,
          });
        }
      }
      return count;
    });
  }

  await logAudit(user.id, "CREATE", "Lesson", group.id, {
    автозаполнение: {
      период: `${parsed.dateFrom} — ${parsed.dateTo}`,
      группа_расписания: groupTitle,
      создано_занятий: created,
      пропущено_существующих: skipped,
      создано_предметов: subjectsCreated,
      пропущено_экз_слотов: examSlotsSkipped,
    },
  });

  revalidatePath("/journal");

  return {
    created,
    skipped,
    subjectsCreated,
    scheduleLessonsFound: wanted.length,
  };
}
