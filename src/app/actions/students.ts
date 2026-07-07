"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const studentSchema = z.object({
  firstName: z.string().min(1, "Имя обязательно"),
  lastName: z.string().min(1, "Фамилия обязательна"),
  email: z.string().email("Некорректный email").optional().nullable(),
  phone: z.string().optional().nullable(),
  groupId: z.string().optional(),
});

export async function getStudents(groupId?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role === "STUDENT") {
    const studentProfile = await prisma.student.findFirst({
      where: { userId: session.user.id, deletedAt: null },
      include: {
        groups: { include: { group: true } },
      },
    });
    return studentProfile ? [studentProfile] : [];
  }

  const baseFilter: Record<string, unknown> = { deletedAt: null };

  if (groupId) {
    baseFilter.groups = { some: { groupId } };
  }

  if (session.user.role === "TEACHER") {
    const teacherGroups = await prisma.group.findMany({
      where: {
        deletedAt: null,
        OR: [
          { homeroomTeacherId: session.user.id },
          { additionalTeachers: { some: { teacherId: session.user.id } } },
        ],
      },
      select: { id: true },
    });

    const groupIds = teacherGroups.map((g) => g.id);

    if (groupIds.length === 0) return [];

    baseFilter.groups = groupId
      ? { some: { AND: [{ groupId }, { groupId: { in: groupIds } }] } }
      : { some: { groupId: { in: groupIds } } };
  }

  return prisma.student.findMany({
    where: baseFilter,
    include: {
      groups: { include: { group: true } },
      user: { select: { id: true, email: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getStudent(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      groups: { include: { group: true } },
      user: { select: { id: true, email: true } },
    },
  });

  if (!student || student.deletedAt) throw new Error("Student not found");

  if (session.user.role === "STUDENT" && student.userId !== session.user.id) {
    throw new Error("Forbidden");
  }

  return student;
}

export async function createStudent(data: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const parsed = studentSchema.parse({
    firstName: data.get("firstName"),
    lastName: data.get("lastName"),
    email: data.get("email") || null,
    phone: data.get("phone") || null,
    groupId: data.get("groupId") || undefined,
  });

  const student = await prisma.student.create({
    data: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email,
      phone: parsed.phone,
    },
  });

  if (parsed.groupId) {
    await prisma.studentGroup.create({
      data: { studentId: student.id, groupId: parsed.groupId },
    });
  }

  await logAudit(session.user.id, "CREATE", "Student", student.id, {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    email: parsed.email,
  });

  revalidatePath("/students");
  return student.id;
}

export async function updateStudent(id: string, data: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const parsed = studentSchema.parse({
    firstName: data.get("firstName"),
    lastName: data.get("lastName"),
    email: data.get("email") || null,
    phone: data.get("phone") || null,
  });

  await prisma.student.update({
    where: { id },
    data: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email,
      phone: parsed.phone,
    },
  });

  await logAudit(session.user.id, "UPDATE", "Student", id, {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    email: parsed.email,
  });

  revalidatePath("/students");
}

export async function deleteStudent(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const student = await prisma.student.findUnique({ where: { id } });
  if (!student) throw new Error("Student not found");

  const updateData: Record<string, unknown> = { deletedAt: new Date() };

  if (student.email) {
    updateData.email = `${student.email}_deleted_${id}`;
  }

  await prisma.student.update({
    where: { id },
    data: updateData,
  });

  await logAudit(session.user.id, "DELETE", "Student", id, {
    firstName: student.firstName,
    lastName: student.lastName,
  });

  revalidatePath("/students");
}

export async function addStudentToGroup(studentId: string, groupId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.studentGroup.create({
    data: { studentId, groupId },
  });

  revalidatePath("/students");
  revalidatePath("/groups");
}

export async function removeStudentFromGroup(studentId: string, groupId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.studentGroup.deleteMany({
    where: { studentId, groupId },
  });

  revalidatePath("/students");
  revalidatePath("/groups");
}
