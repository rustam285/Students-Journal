"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const groupCoursesSchema = z
  .object({
    course: z.number().int().min(1).max(6),
    graduationCourse: z.number().int().min(1).max(6),
  })
  .refine((data) => data.graduationCourse >= data.course, {
    message: "Выпускной курс не может быть меньше текущего",
  });

export async function getPromotionPreview() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const groups = await prisma.group.findMany({
    where: { deletedAt: null },
    include: {
      homeroomTeacher: { select: { name: true } },
      _count: {
        select: { students: { where: { student: { deletedAt: null } } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    course: g.course,
    graduationCourse: g.graduationCourse,
    studentsCount: g._count.students,
    homeroomTeacher: g.homeroomTeacher?.name || null,
  }));
}

export async function setGroupCourses(
  groupId: string,
  course: number,
  graduationCourse: number
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const parsed = groupCoursesSchema.parse({ course, graduationCourse });

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group || group.deletedAt) throw new Error("Group not found");

  await prisma.group.update({
    where: { id: groupId },
    data: {
      course: parsed.course,
      graduationCourse: parsed.graduationCourse,
    },
  });

  await logAudit(session.user.id, "UPDATE", "Group", groupId, {
    name: group.name,
    course: group.course ?? null,
    graduationCourse: group.graduationCourse ?? null,
    newCourse: parsed.course,
    newGraduationCourse: parsed.graduationCourse,
  });

  revalidatePath("/terms");
  revalidatePath("/groups");
}

export async function promoteAcademicYear() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const groups = await prisma.group.findMany({
    where: { deletedAt: null },
    include: {
      students: {
        include: { student: { select: { id: true, userId: true, email: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  const notConfigured = groups.filter(
    (g) => g.course === null || g.graduationCourse === null
  );
  if (notConfigured.length > 0) {
    const names = notConfigured.map((g) => g.name).join(", ");
    throw new Error(`Укажите курс и выпускной курс для групп: ${names}`);
  }

  const now = new Date();
  const toGraduate = groups.filter(
    (g) => (g.course as number) >= (g.graduationCourse as number)
  );
  const toPromote = groups.filter(
    (g) => (g.course as number) < (g.graduationCourse as number)
  );

  await prisma.$transaction(async (tx) => {
    for (const group of toGraduate) {
      await tx.group.update({
        where: { id: group.id },
        data: { deletedAt: now },
      });

      for (const membership of group.students) {
        const student = membership.student;
        if (!student) continue;

        const updateData: Record<string, unknown> = { deletedAt: now };
        if (student.email) {
          updateData.email = `${student.email}_deleted_${student.id}`;
        }
        if (student.userId) {
          updateData.userId = null;
        }

        await tx.student.update({
          where: { id: student.id },
          data: updateData,
        });

        if (student.userId) {
          const user = await tx.user.findUnique({
            where: { id: student.userId },
          });
          if (user && user.role === "STUDENT") {
            await tx.user.delete({ where: { id: user.id } });
          }
        }
      }
    }

    if (toPromote.length > 0) {
      await tx.group.updateMany({
        where: { id: { in: toPromote.map((g) => g.id) } },
        data: { course: { increment: 1 } },
      });
    }
  });

  const graduatedStudents = toGraduate.reduce(
    (sum, g) => sum + g.students.filter((s) => s.student).length,
    0
  );

  await logAudit(session.user.id, "UPDATE", "Group", "academic-year-promotion", {
    promoted: toPromote.map((g) => ({ name: g.name, course: g.course })),
    graduated: toGraduate.map((g) => ({ name: g.name, course: g.course })),
    graduatedStudents,
  });

  revalidatePath("/terms");
  revalidatePath("/groups");
  revalidatePath("/students");
  revalidatePath("/journal");
  revalidatePath("/dashboard");

  return {
    promotedCount: toPromote.length,
    graduatedCount: toGraduate.length,
    graduatedStudents,
  };
}
