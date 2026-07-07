"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const attendanceSchema = z.object({
  studentId: z.string(),
  status: z.enum(["PRESENT", "ABSENT", "LATE"]),
  grade: z.number().min(1).max(5).nullable().optional(),
  comment: z.string().nullable().optional(),
});

const lessonSchema = z.object({
  groupId: z.string(),
  date: z.string(),
  lessonNumber: z.number().min(1).max(8),
  topic: z.string().min(1),
  subjectId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export async function getTeacherGroups() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role === "ADMIN") {
    return prisma.group.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  return prisma.group.findMany({
    where: {
      deletedAt: null,
      OR: [
        { homeroomTeacherId: session.user.id },
        { additionalTeachers: { some: { teacherId: session.user.id } } },
      ],
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getGroupStudents(groupId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role === "TEACHER") {
    const hasAccess = await prisma.group.findFirst({
      where: {
        id: groupId,
        deletedAt: null,
        OR: [
          { homeroomTeacherId: session.user.id },
          { additionalTeachers: { some: { teacherId: session.user.id } } },
        ],
      },
    });
    if (!hasAccess) throw new Error("Forbidden");
  }

  return prisma.studentGroup.findMany({
    where: { groupId },
    include: {
      student: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
    ],
  });
}

export async function getLessons(groupId: string, termId?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role === "TEACHER") {
    const hasAccess = await prisma.group.findFirst({
      where: {
        id: groupId,
        deletedAt: null,
        OR: [
          { homeroomTeacherId: session.user.id },
          { additionalTeachers: { some: { teacherId: session.user.id } } },
        ],
      },
    });
    if (!hasAccess) throw new Error("Forbidden");
  }

  if (session.user.role === "STUDENT") {
    const studentProfile = await prisma.student.findFirst({
      where: { userId: session.user.id, deletedAt: null },
    });
    if (!studentProfile) return [];

    const isMember = await prisma.studentGroup.findFirst({
      where: { studentId: studentProfile.id, groupId },
    });
    if (!isMember) return [];
  }

  const where: Record<string, unknown> = { groupId, deletedAt: null };
  if (termId) where.termId = termId;

  if (session.user.role === "TEACHER") {
    where.teacherId = session.user.id;
  }

  return prisma.lesson.findMany({
    where,
    include: {
      teacher: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true } },
      records: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ date: "desc" }, { lessonNumber: "asc" }],
  });
}

export async function getLesson(lessonId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      group: { select: { id: true, name: true } },
      records: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!lesson || lesson.deletedAt) throw new Error("Lesson not found");

  if (session.user.role === "TEACHER" && lesson.teacherId !== session.user.id) {
    const hasAccess = await prisma.group.findFirst({
      where: {
        id: lesson.groupId,
        deletedAt: null,
        OR: [
          { homeroomTeacherId: session.user.id },
          { additionalTeachers: { some: { teacherId: session.user.id } } },
        ],
      },
    });
    if (!hasAccess) throw new Error("Forbidden");
  }

  return lesson;
}

export async function getActiveTerm() {
  return prisma.term.findFirst({
    where: { isActive: true },
  });
}

export async function getTerms() {
  return prisma.term.findMany({
    orderBy: { startDate: "desc" },
  });
}

export async function createLesson(data: FormData) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const parsed = lessonSchema.parse({
    groupId: data.get("groupId"),
    date: data.get("date"),
    lessonNumber: Number(data.get("lessonNumber")),
    topic: data.get("topic"),
    subjectId: data.get("subjectId") || null,
    notes: data.get("notes") || undefined,
  });

  const forceCreate = data.get("forceCreate") === "true";

  if (session.user.role === "TEACHER") {
    const hasAccess = await prisma.group.findFirst({
      where: {
        id: parsed.groupId,
        deletedAt: null,
        OR: [
          { homeroomTeacherId: session.user.id },
          { additionalTeachers: { some: { teacherId: session.user.id } } },
        ],
      },
    });
    if (!hasAccess) throw new Error("Forbidden");
  }

  const term = await prisma.term.findFirst({ where: { isActive: true } });
  if (!term) throw new Error("Нет активного учебного периода");

  const sameGroupLesson = await prisma.lesson.findFirst({
    where: {
      groupId: parsed.groupId,
      date: new Date(parsed.date),
      lessonNumber: parsed.lessonNumber,
      deletedAt: null,
    },
  });

  if (sameGroupLesson) {
    throw new Error("Занятие на эту пару уже существует для этой группы");
  }

  const otherGroupLesson = await prisma.lesson.findFirst({
    where: {
      date: new Date(parsed.date),
      lessonNumber: parsed.lessonNumber,
      deletedAt: null,
      NOT: { groupId: parsed.groupId },
    },
    include: {
      group: { select: { name: true } },
    },
  });

  if (otherGroupLesson && !forceCreate) {
    const currentGroup = await prisma.group.findUnique({
      where: { id: parsed.groupId },
      select: { name: true },
    });
    return {
      warning: true,
      message: `На эту пару уже есть занятие у группы "${otherGroupLesson.group.name}". Создать занятие для "${currentGroup?.name}"?`,
    };
  }

  const lesson = await prisma.lesson.create({
    data: {
      groupId: parsed.groupId,
      termId: term.id,
      teacherId: session.user.id,
      subjectId: parsed.subjectId || null,
      date: new Date(parsed.date),
      lessonNumber: parsed.lessonNumber,
      topic: parsed.topic,
      notes: parsed.notes,
    },
  });

  const students = await prisma.studentGroup.findMany({
    where: { groupId: parsed.groupId },
    select: { studentId: true },
  });

  await prisma.attendanceRecord.createMany({
    data: students.map((s) => ({
      lessonId: lesson.id,
      studentId: s.studentId,
      status: "PRESENT" as const,
    })),
  });

  revalidatePath("/journal");
  return { lessonId: lesson.id };
}

export async function updateAttendance(
  lessonId: string,
  records: {
    studentId: string;
    status: "PRESENT" | "ABSENT" | "LATE";
    grade?: number | null;
    comment?: string | null;
  }[]
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
  });

  if (!lesson || lesson.deletedAt) throw new Error("Lesson not found");

  if (session.user.role === "TEACHER" && lesson.teacherId !== session.user.id) {
    throw new Error("Forbidden");
  }
  
  const groupStudentIds = new Set(
    (await prisma.studentGroup.findMany({
      where: { groupId: lesson.groupId },
      select: { studentId: true },
    })).map((s) => s.studentId)
  );

  for (const record of records) {
    if (!groupStudentIds.has(record.studentId)) {
      throw new Error("Student not in this group");
    }
  }
  
  for (const record of records) {
    const parsed = attendanceSchema.parse(record);

    await prisma.attendanceRecord.upsert({
      where: {
        lessonId_studentId: {
          lessonId,
          studentId: parsed.studentId,
        },
      },
      update: {
        status: parsed.status,
        grade: parsed.grade ?? null,
        comment: parsed.comment ?? null,
      },
      create: {
        lessonId,
        studentId: parsed.studentId,
        status: parsed.status,
        grade: parsed.grade ?? null,
        comment: parsed.comment ?? null,
      },
    });
  }

  await logAudit(session.user.id, "UPDATE", "Attendance", lessonId, {
    recordsCount: records.length,
  });

  revalidatePath("/journal");
}

export async function deleteLesson(lessonId: string) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
  });

  if (!lesson || lesson.deletedAt) throw new Error("Lesson not found");

  if (session.user.role === "TEACHER" && lesson.teacherId !== session.user.id) {
    throw new Error("Forbidden");
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: { deletedAt: new Date() },
  });

  await logAudit(session.user.id, "DELETE", "Lesson", lessonId, {
    topic: lesson.topic,
  });

  revalidatePath("/journal");
}

export async function updateLesson(lessonId: string, data: FormData) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
  });

  if (!lesson || lesson.deletedAt) throw new Error("Lesson not found");

  if (session.user.role === "TEACHER" && lesson.teacherId !== session.user.id) {
    throw new Error("Forbidden");
  }

  const parsed = lessonSchema.parse({
    groupId: lesson.groupId,
    date: data.get("date"),
    lessonNumber: Number(data.get("lessonNumber")),
    topic: data.get("topic"),
    notes: data.get("notes") || undefined,
  });

  const conflict = await prisma.lesson.findFirst({
    where: {
      groupId: lesson.groupId,
      date: new Date(parsed.date),
      lessonNumber: parsed.lessonNumber,
      deletedAt: null,
      NOT: { id: lessonId },
    },
  });

  if (conflict) {
    throw new Error("На эту пару уже есть занятие для этой группы");
  }

  await prisma.lesson.update({
    where: { id: lessonId },
    data: {
      date: new Date(parsed.date),
      lessonNumber: parsed.lessonNumber,
      topic: parsed.topic,
      notes: parsed.notes,
    },
  });

  revalidatePath("/journal");
}

export async function getLessonsByMonth(year: number, month: number, groupId?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const where: Record<string, unknown> = {
    date: { gte: startDate, lte: endDate },
    deletedAt: null,
  };

  if (groupId) {
    where.groupId = groupId;
  }

  if (session.user.role === "TEACHER") {
    where.teacherId = session.user.id;
  }

  if (session.user.role === "STUDENT") {
    const studentProfile = await prisma.student.findFirst({
      where: { userId: session.user.id, deletedAt: null },
    });
    if (!studentProfile) return [];

    where.records = { some: { studentId: studentProfile.id } };
  }

  return prisma.lesson.findMany({
    where,
    include: {
      group: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true } },
      records: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { lessonNumber: "asc" }],
  });
}
