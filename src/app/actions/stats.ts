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

export async function getTopStudents(
  period: Period = "year",
  startDate?: string,
  endDate?: string,
  limit: number = 5
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const { from, to } = getDateRange(period, startDate, endDate);

  const lessonWhere: Record<string, unknown> = {
    deletedAt: null,
    date: { gte: from, lte: to },
  };

  if (session.user.role === "TEACHER") {
    lessonWhere.teacherId = session.user.id;
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      deletedAt: null,
      grade: { not: null },
      lesson: lessonWhere,
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const byStudent = records.reduce((acc, r) => {
    const id = r.studentId;
    if (!acc[id]) {
      acc[id] = {
        student: r.student,
        sum: 0,
        count: 0,
      };
    }
    acc[id].sum += r.grade!;
    acc[id].count++;
    return acc;
  }, {} as Record<string, { student: { id: string; firstName: string; lastName: string }; sum: number; count: number }>);

  const ranked = Object.values(byStudent)
    .map((s) => ({
      id: s.student.id,
      name: `${s.student.lastName} ${s.student.firstName}`,
      avgGrade: Math.round((s.sum / s.count) * 10) / 10,
      gradesCount: s.count,
    }))
    .sort((a, b) => b.avgGrade - a.avgGrade);

  return {
    top: ranked.slice(0, limit),
    bottom: ranked.slice(-limit).reverse(),
  };
}

export async function getLessonNumberStats(
  period: Period = "year",
  startDate?: string,
  endDate?: string
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const { from, to } = getDateRange(period, startDate, endDate);

  const lessonWhere: Record<string, unknown> = {
    deletedAt: null,
    date: { gte: from, lte: to },
  };

  if (session.user.role === "TEACHER") {
    lessonWhere.teacherId = session.user.id;
  }

  const lessons = await prisma.lesson.findMany({
    where: lessonWhere,
    include: {
      records: { where: { deletedAt: null } },
    },
  });

  const byNumber: Record<number, { total: number; absent: number }> = {};

  for (let i = 1; i <= 8; i++) {
    byNumber[i] = { total: 0, absent: 0 };
  }

  lessons.forEach((l) => {
    byNumber[l.lessonNumber].total += l.records.length;
    byNumber[l.lessonNumber].absent += l.records.filter((r) => r.status === "ABSENT").length;
  });

  return Object.entries(byNumber).map(([num, data]) => ({
    lessonNumber: parseInt(num),
    label: `${num} пара`,
    total: data.total,
    absent: data.absent,
    absenceRate: data.total > 0 ? Math.round((data.absent / data.total) * 100) : 0,
  }));
}

export async function getGradeDistribution(
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
    });

    const dist = [0, 0, 0, 0, 0];
    records.forEach((r) => {
      if (r.grade && r.grade >= 1 && r.grade <= 5) {
        dist[r.grade - 1]++;
      }
    });

    return dist.map((count, i) => ({ grade: i + 1, count }));
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      deletedAt: null,
      grade: { not: null },
      lesson: lessonWhere,
    },
  });

  const dist = [0, 0, 0, 0, 0];
  records.forEach((r) => {
    if (r.grade && r.grade >= 1 && r.grade <= 5) {
      dist[r.grade - 1]++;
    }
  });

  return dist.map((count, i) => ({ grade: i + 1, count }));
}

export async function getAtRiskStudents(
  period: Period = "year",
  startDate?: string,
  endDate?: string,
  absenceThreshold: number = 30,
  gradeThreshold: number = 3
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const { from, to } = getDateRange(period, startDate, endDate);

  const lessonWhere: Record<string, unknown> = {
    deletedAt: null,
    date: { gte: from, lte: to },
  };

  if (session.user.role === "TEACHER") {
    lessonWhere.teacherId = session.user.id;
  }

  const records = await prisma.attendanceRecord.findMany({
    where: {
      deletedAt: null,
      lesson: lessonWhere,
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const byStudent: Record<string, {
    student: { id: string; firstName: string; lastName: string };
    total: number;
    absent: number;
    gradeSum: number;
    gradeCount: number;
  }> = {};

  records.forEach((r) => {
    if (!byStudent[r.studentId]) {
      byStudent[r.studentId] = {
        student: r.student,
        total: 0,
        absent: 0,
        gradeSum: 0,
        gradeCount: 0,
      };
    }
    byStudent[r.studentId].total++;
    if (r.status === "ABSENT") byStudent[r.studentId].absent++;
    if (r.grade) {
      byStudent[r.studentId].gradeSum += r.grade;
      byStudent[r.studentId].gradeCount++;
    }
  });

  return Object.values(byStudent)
    .map((s) => ({
      id: s.student.id,
      name: `${s.student.lastName} ${s.student.firstName}`,
      absenceRate: s.total > 0 ? Math.round((s.absent / s.total) * 100) : 0,
      avgGrade: s.gradeCount > 0 ? Math.round((s.gradeSum / s.gradeCount) * 10) / 10 : null,
      totalLessons: s.total,
    }))
    .filter((s) => s.absenceRate >= absenceThreshold || (s.avgGrade !== null && s.avgGrade < gradeThreshold))
    .sort((a, b) => b.absenceRate - a.absenceRate);
}

export async function getGroupComparison(
  period: Period = "year",
  startDate?: string,
  endDate?: string
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const { from, to } = getDateRange(period, startDate, endDate);

  const groups = await prisma.group.findMany({
    where: {
      deletedAt: null,
      ...(session.user.role === "TEACHER"
        ? {
            OR: [
              { homeroomTeacherId: session.user.id },
              { additionalTeachers: { some: { teacherId: session.user.id } } },
            ],
          }
        : {}),
    },
    include: {
      lessons: {
        where: { deletedAt: null, date: { gte: from, lte: to } },
        include: {
          records: { where: { deletedAt: null } },
        },
      },
      students: { where: { student: { deletedAt: null } } },
    },
  });

  return groups
    .filter((g) => g.lessons.length > 0)
    .map((g) => {
      const allRecords = g.lessons.flatMap((l) => l.records);
      const present = allRecords.filter((r) => r.status === "PRESENT").length;
      const total = allRecords.length;
      const gradesRecords = allRecords.filter((r) => r.grade !== null);
      const avgGrade = gradesRecords.length > 0
        ? Math.round(gradesRecords.reduce((sum, r) => sum + r.grade!, 0) / gradesRecords.length * 10) / 10
        : null;

      return {
        name: g.name,
        studentsCount: g.students.length,
        lessonsCount: g.lessons.length,
        attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
        avgGrade,
      };
    });
}
