"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Period = "day" | "week" | "month" | "year" | "custom";

function getDateRange(period: Period, startDate?: string, endDate?: string) {
  const now = new Date();
  let from: Date;
  let to: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  switch (period) {
    case "day":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
      break;
    case "month":
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case "custom":
      from = startDate ? new Date(startDate) : new Date(now.getFullYear(), 0, 1);
      to = endDate ? new Date(new Date(endDate).setHours(23, 59, 59)) : to;
      break;
    default:
      from = new Date(now.getFullYear(), 0, 1);
  }

  return { from, to };
}

export async function getAttendanceStats(
  period: Period = "year",
  startDate?: string,
  endDate?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const { from, to } = getDateRange(period, startDate, endDate);

  const lessonWhere: Record<string, unknown> = {
    deletedAt: null,
    date: { gte: from, lte: to },
  };

  if (session.user.role === "TEACHER") {
    lessonWhere.teacherId = session.user.id;
  }

  if (session.user.role === "STUDENT") {
    const studentProfile = await prisma.student.findFirst({
      where: { userId: session.user.id, deletedAt: null },
    });
    if (!studentProfile) return [];

    const records = await prisma.attendanceRecord.findMany({
      where: {
        deletedAt: null,
        studentId: studentProfile.id,
        lesson: lessonWhere,
      },
      include: {
        lesson: { include: { group: { select: { name: true } } } },
      },
    });

    const grouped = records.reduce((acc, r) => {
      const groupName = r.lesson.group.name;
      if (!acc[groupName]) {
        acc[groupName] = { PRESENT: 0, ABSENT: 0, LATE: 0 };
      }
      acc[groupName][r.status]++;
      return acc;
    }, {} as Record<string, { PRESENT: number; ABSENT: number; LATE: number }>);

    return Object.entries(grouped).map(([name, counts]) => ({
      name,
      ...counts,
      total: counts.PRESENT + counts.ABSENT + counts.LATE,
    }));
  }

  const groups = await prisma.group.findMany({
    where: {
      deletedAt: null,
      ...(session.user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { homeroomTeacherId: session.user.id },
              { additionalTeachers: { some: { teacherId: session.user.id } } },
            ],
          }),
    },
    include: {
      lessons: {
        where: lessonWhere,
        include: {
          records: { where: { deletedAt: null } },
        },
      },
    },
  });

  return groups
    .filter((group) => group.lessons.length > 0)
    .map((group) => {
      const allRecords = group.lessons.flatMap((l) => l.records);
      const PRESENT = allRecords.filter((r) => r.status === "PRESENT").length;
      const ABSENT = allRecords.filter((r) => r.status === "ABSENT").length;
      const LATE = allRecords.filter((r) => r.status === "LATE").length;

      return {
        name: group.name,
        PRESENT,
        ABSENT,
        LATE,
        total: PRESENT + ABSENT + LATE,
      };
    });
}

export async function getGradeDynamics(
  period: Period = "year",
  startDate?: string,
  endDate?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const { from, to } = getDateRange(period, startDate, endDate);

  const lessonWhere: Record<string, unknown> = {
    deletedAt: null,
    date: { gte: from, lte: to },
  };

  if (session.user.role === "TEACHER") {
    lessonWhere.teacherId = session.user.id;
  }

  if (session.user.role === "STUDENT") {
    const studentProfile = await prisma.student.findFirst({
      where: { userId: session.user.id, deletedAt: null },
    });
    if (!studentProfile) return [];

    const records = await prisma.attendanceRecord.findMany({
      where: {
        deletedAt: null,
        studentId: studentProfile.id,
        grade: { not: null },
        lesson: lessonWhere,
      },
      include: {
        lesson: { select: { date: true } },
      },
      orderBy: { lesson: { date: "asc" } },
    });

    return records.map((r) => ({
      date: r.lesson.date.toISOString().split("T")[0],
      grade: r.grade,
    }));
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      deletedAt: null,
      grade: { not: null },
      lesson: lessonWhere,
    },
    include: {
      lesson: { select: { date: true } },
    },
    orderBy: { lesson: { date: "asc" } },
  });

  const byDate = records.reduce((acc, r) => {
    const dateStr = r.lesson.date.toISOString().split("T")[0];
    if (!acc[dateStr]) {
      acc[dateStr] = { sum: 0, count: 0 };
    }
    acc[dateStr].sum += r.grade!;
    acc[dateStr].count++;
    return acc;
  }, {} as Record<string, { sum: number; count: number }>);

  return Object.entries(byDate).map(([date, { sum, count }]) => ({
    date,
    grade: Math.round((sum / count) * 10) / 10,
  }));
}

export async function getWeekdayActivity(
  period: Period = "year",
  startDate?: string,
  endDate?: string
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const { from, to } = getDateRange(period, startDate, endDate);

  const lessonWhere: Record<string, unknown> = {
    deletedAt: null,
    date: { gte: from, lte: to },
  };

  if (session.user.role === "TEACHER") {
    lessonWhere.teacherId = session.user.id;
  }

  if (session.user.role === "STUDENT") {
    const studentProfile = await prisma.student.findFirst({
      where: { userId: session.user.id, deletedAt: null },
    });
    if (!studentProfile) return [];

    const records = await prisma.attendanceRecord.findMany({
      where: {
        deletedAt: null,
        studentId: studentProfile.id,
        lesson: lessonWhere,
      },
      include: {
        lesson: { select: { date: true } },
      },
    });

    const weekdayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    records.forEach((r) => {
      const day = new Date(r.lesson.date).getDay();
      const index = day === 0 ? 6 : day - 1;
      counts[index]++;
    });

    return weekdayNames.map((name, i) => ({ name, count: counts[i] }));
  }

  const lessons = await prisma.lesson.findMany({
    where: lessonWhere,
    select: { date: true },
  });

  const weekdayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const counts = [0, 0, 0, 0, 0, 0, 0];

  lessons.forEach((l) => {
    const day = new Date(l.date).getDay();
    const index = day === 0 ? 6 : day - 1;
    counts[index]++;
  });

  return weekdayNames.map((name, i) => ({ name, count: counts[i] }));
}
