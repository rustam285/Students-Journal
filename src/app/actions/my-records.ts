"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getMyRecords() {
  const session = await auth();
  if (!session?.user || session.user.role !== "STUDENT") {
    throw new Error("Unauthorized");
  }

  const studentProfile = await prisma.student.findFirst({
    where: { userId: session.user.id, deletedAt: null },
  });

  if (!studentProfile) return [];

  const records = await prisma.attendanceRecord.findMany({
    where: {
      studentId: studentProfile.id,
      deletedAt: null,
    },
    include: {
      lesson: {
        include: {
          group: { select: { name: true } },
          subject: { select: { name: true } },
        },
      },
    },
    orderBy: { lesson: { date: "desc" } },
  });

  return records.map((r) => ({
    id: r.id,
    date: r.lesson.date.toISOString().split("T")[0],
    lessonNumber: r.lesson.lessonNumber,
    topic: r.lesson.topic,
    groupName: r.lesson.group.name,
    subjectName: r.lesson.subject?.name || null,
    status: r.status,
    grade: r.grade,
    comment: r.comment,
  }));
}
