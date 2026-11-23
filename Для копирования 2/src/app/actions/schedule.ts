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
  normalizeTitle,
  splitDateRange,
  type ScheduleDayLesson,
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

const fillAllSchema = z
  .object({
    scheduleTeacherId: z.number().int().positive(),
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

/** Группы пользователя для заполнения: TEACHER — свои (классные + доп.), ADMIN — все. */
async function getFillableGroups(userId: string, role: string) {
  const where: Record<string, unknown> = { deletedAt: null };
  if (role === "TEACHER") {
    where.OR = [
      { homeroomTeacherId: userId },
      { additionalTeachers: { some: { teacherId: userId } } },
    ];
  }
  return prisma.group.findMany({
    where,
    select: { id: true, name: true, scheduleGroupId: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Данные для диалога автозаполнения: справочники расписания + предвыбор
 * преподавателя (сохранённый id, иначе сопоставление по ФИО) и группы
 * (сохранённый id, иначе совпадение названия без регистра/е/ё).
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
  const matchedGroup =
    scheduleGroups.find((g) => normalizeTitle(g.title) === normalizeTitle(group.name)) ?? null;

  return {
    scheduleTeacherId: (storedTeacher ?? matchedTeacher)?.id ?? null,
    scheduleGroupId: (storedGroup ?? matchedGroup)?.id ?? null,
    teachers: [...scheduleTeachers].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    groups: [...scheduleGroups].sort((a, b) => a.title.localeCompare(b.title, "ru")),
  };
}

// --- Общее ядро заполнения -------------------------------------------------

interface WantedLesson {
  date: string;
  lessonNumber: number;
  discipline: string;
  notes: string | null;
}

/**
 * Отбор пар группы из расписания преподавателя: совпадение названия
 * (без регистра/е/ё), дедуп по «дата + номер пары», «ЭКЗ»-слоты пропускаются.
 */
function pickWantedLessons(scheduleLessons: ScheduleDayLesson[], groupTitle: string) {
  const normalizedTitle = normalizeTitle(groupTitle);
  const seen = new Set<string>();
  const wanted: WantedLesson[] = [];
  let examSlotsSkipped = 0;

  for (const lesson of scheduleLessons) {
    if (!lesson.groups.some((g) => normalizeTitle(g) === normalizedTitle)) continue;
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
  return { wanted, examSlotsSkipped };
}

/** Существующие занятия группы за период → ключи «дата|пара» (для пропуска дублей). */
async function loadExistingKeys(groupId: string, dateFrom: string, dateTo: string) {
  const existing = await prisma.lesson.findMany({
    where: {
      groupId,
      deletedAt: null,
      date: { gte: new Date(`${dateFrom}T00:00:00Z`), lte: new Date(`${dateTo}T00:00:00Z`) },
    },
    select: { date: true, lessonNumber: true },
  });
  return new Set(existing.map((l) => `${l.date.toISOString().slice(0, 10)}|${l.lessonNumber}`));
}

/**
 * Личные предметы преподавателя: существующие находятся, недостающие создаются
 * (у Subject уникальность (name, teacherId)).
 */
async function ensureSubjects(userId: string, disciplines: string[]) {
  const distinct = Array.from(new Set(disciplines));
  const owned = await prisma.subject.findMany({
    where: { teacherId: userId, name: { in: distinct } },
    select: { id: true, name: true },
  });
  const ids = new Map(owned.map((s) => [s.name, s.id]));
  let created = 0;
  for (const name of distinct) {
    if (ids.has(name)) continue;
    const subject = await prisma.subject.create({ data: { name, teacherId: userId } });
    ids.set(name, subject.id);
    created += 1;
  }
  return { ids, created };
}

/** Создание занятий + отметок «Присутствует» всем студентам группы. */
async function createLessonsWithAttendance(params: {
  userId: string;
  groupId: string;
  termId: string;
  lessons: WantedLesson[];
  subjectIds: Map<string, string>;
}) {
  const studentIds = (
    await prisma.studentGroup.findMany({
      where: { groupId: params.groupId },
      select: { studentId: true },
    })
  ).map((s) => s.studentId);

  if (params.lessons.length === 0) return 0;

  return prisma.$transaction(async (tx) => {
    let count = 0;
    for (const lesson of params.lessons) {
      const newLesson = await tx.lesson.create({
        data: {
          groupId: params.groupId,
          termId: params.termId,
          teacherId: params.userId,
          subjectId: params.subjectIds.get(lesson.discipline) ?? null,
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

// --- Одногрупповое заполнение ----------------------------------------------

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

  const { wanted, examSlotsSkipped } = pickWantedLessons(scheduleLessons, groupTitle);

  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term) throw new Error("Нет активного учебного периода");

  const existingKeys = await loadExistingKeys(group.id, parsed.dateFrom, parsed.dateTo);
  const toCreate = wanted.filter((l) => !existingKeys.has(`${l.date}|${l.lessonNumber}`));
  const skipped = wanted.length - toCreate.length;

  const { ids: subjectIds, created: subjectsCreated } = await ensureSubjects(
    user.id,
    toCreate.map((l) => l.discipline)
  );

  const created = await createLessonsWithAttendance({
    userId: user.id,
    groupId: group.id,
    termId: term.id,
    lessons: toCreate,
    subjectIds,
  });

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
  revalidatePath("/calendar");

  return {
    created,
    skipped,
    subjectsCreated,
    scheduleLessonsFound: wanted.length,
  };
}

// --- Заполнение всех групп преподавателя -----------------------------------

export interface FillGroupResult {
  name: string;
  scheduleGroupTitle: string;
  created: number;
  skipped: number;
}

export interface FillAllResult {
  groups: FillGroupResult[];
  unmapped: string[];
  created: number;
  skipped: number;
  subjectsCreated: number;
}

/**
 * Автозаполнение журнала сразу по всем группам пользователя: расписание
 * преподавания скачивается один раз, занятия разносятся по группам
 * (сопоставление — сохранённое или по названию). Группы без сопоставления
 * с расписанием пропускаются и перечисляются в unmapped.
 */
export async function fillAllGroupsFromSchedule(input: {
  scheduleTeacherId: number;
  dateFrom: string;
  dateTo: string;
}): Promise<FillAllResult> {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const parsed = fillAllSchema.parse(input);

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new Error("Unauthorized");

  if (user.scheduleTeacherId !== parsed.scheduleTeacherId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { scheduleTeacherId: parsed.scheduleTeacherId },
    });
  }

  const [groups, scheduleGroups] = await Promise.all([
    getFillableGroups(user.id, user.role),
    fetchScheduleGroups(),
  ]);

  // Сопоставление: сохранённый id, иначе совпадение названия; запоминаем матчи
  const unmapped: string[] = [];
  const mapped: Array<{ id: string; name: string; scheduleGroupTitle: string }> = [];
  for (const group of groups) {
    const stored = group.scheduleGroupId
      ? scheduleGroups.find((g) => g.id === group.scheduleGroupId) ?? null
      : null;
    const matched =
      stored ??
      (scheduleGroups.find(
        (g) => normalizeTitle(g.title) === normalizeTitle(group.name)
      ) ?? null);
    if (!matched) {
      unmapped.push(group.name);
      continue;
    }
    if (group.scheduleGroupId !== matched.id) {
      await prisma.group.update({
        where: { id: group.id },
        data: { scheduleGroupId: matched.id },
      });
    }
    mapped.push({ id: group.id, name: group.name, scheduleGroupTitle: matched.title });
  }

  const result: FillAllResult = {
    groups: [],
    unmapped,
    created: 0,
    skipped: 0,
    subjectsCreated: 0,
  };
  if (mapped.length === 0) return result;

  const scheduleLessons = (
    await Promise.all(
      splitDateRange(parsed.dateFrom, parsed.dateTo).map(([from, to]) =>
        fetchTeacherSchedule(parsed.scheduleTeacherId, from, to)
      )
    )
  ).flat();

  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term) throw new Error("Нет активного учебного периода");

  // Сначала отбираем пары по всем группам, затем один проход по предметам
  const perGroup = mapped.map((m) => {
    const { wanted } = pickWantedLessons(scheduleLessons, m.scheduleGroupTitle);
    return { ...m, wanted };
  });
  const { ids: subjectIds, created: subjectsCreated } = await ensureSubjects(
    user.id,
    perGroup.flatMap((g) => g.wanted.map((l) => l.discipline))
  );
  result.subjectsCreated = subjectsCreated;

  for (const g of perGroup) {
    const existingKeys = await loadExistingKeys(g.id, parsed.dateFrom, parsed.dateTo);
    const toCreate = g.wanted.filter((l) => !existingKeys.has(`${l.date}|${l.lessonNumber}`));
    const skipped = g.wanted.length - toCreate.length;
    const created = await createLessonsWithAttendance({
      userId: user.id,
      groupId: g.id,
      termId: term.id,
      lessons: toCreate,
      subjectIds,
    });
    result.groups.push({
      name: g.name,
      scheduleGroupTitle: g.scheduleGroupTitle,
      created,
      skipped,
    });
    result.created += created;
    result.skipped += skipped;
  }

  await logAudit(user.id, "CREATE", "Lesson", "batch", {
    автозаполнение_всех_групп: {
      период: `${parsed.dateFrom} — ${parsed.dateTo}`,
      групп_заполнено: result.groups.length,
      не_сопоставлено: unmapped,
      создано_занятий: result.created,
      пропущено_существующих: result.skipped,
      создано_предметов: subjectsCreated,
    },
  });

  revalidatePath("/journal");
  revalidatePath("/calendar");

  return result;
}
