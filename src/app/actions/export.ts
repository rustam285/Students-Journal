"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getJournalExport(groupId: string, termId?: string) {
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

  const where: Record<string, unknown> = { groupId, deletedAt: null };
  if (termId) where.termId = termId;

  const lessons = await prisma.lesson.findMany({
    where,
    include: {
      subject: { select: { name: true } },
      records: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
    orderBy: [{ date: "asc" }, { lessonNumber: "asc" }],
  });

  const students = await prisma.studentGroup.findMany({
    where: { groupId },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
    ],
  });

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { name: true },
  });

  return {
    groupName: group?.name || "",
    students: students.map((s) => ({
      id: s.student.id,
      name: `${s.student.lastName} ${s.student.firstName}`,
    })),
    lessons: lessons.map((l) => ({
      id: l.id,
      date: l.date.toISOString().split("T")[0],
      lessonNumber: l.lessonNumber,
      topic: l.topic,
      subject: l.subject?.name || "",
      records: l.records.map((r) => ({
        studentId: r.studentId,
        status: r.status,
        grade: r.grade,
        comment: r.comment,
      })),
    })),
  };
}
