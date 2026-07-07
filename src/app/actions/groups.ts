"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const groupSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  description: z.string().optional(),
  homeroomTeacherId: z.string().optional().nullable(),
});

export async function getGroups() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return prisma.group.findMany({
    where: { deletedAt: null },
    include: {
      homeroomTeacher: { select: { id: true, name: true } },
      additionalTeachers: {
        include: { teacher: { select: { id: true, name: true } } },
      },
      students: {
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
    orderBy: { name: "asc" },
  });
}

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

export async function getGroup(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      homeroomTeacher: { select: { id: true, name: true } },
      additionalTeachers: {
        include: { teacher: { select: { id: true, name: true } } },
      },
      students: {
        include: { student: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });

  if (!group || group.deletedAt) throw new Error("Group not found");

  if (session.user.role === "TEACHER") {
    const hasAccess =
      group.homeroomTeacherId === session.user.id ||
      group.additionalTeachers.some((t) => t.teacherId === session.user.id);
    if (!hasAccess) throw new Error("Forbidden");
  }

  return group;
}

export async function createGroup(data: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const parsed = groupSchema.parse({
    name: data.get("name"),
    description: data.get("description") || undefined,
    homeroomTeacherId: data.get("homeroomTeacherId") || null,
  });

  const group = await prisma.group.create({ data: parsed });

  await logAudit(session.user.id, "CREATE", "Group", group.id, { name: parsed.name });

  revalidatePath("/groups");
}

export async function updateGroup(id: string, data: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const parsed = groupSchema.parse({
    name: data.get("name"),
    description: data.get("description") || undefined,
    homeroomTeacherId: data.get("homeroomTeacherId") || null,
  });

  await prisma.group.update({ where: { id }, data: parsed });

  await logAudit(session.user.id, "UPDATE", "Group", id, { name: parsed.name });

  revalidatePath("/groups");
}

export async function deleteGroup(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const group = await prisma.group.findUnique({ where: { id } });

  await prisma.group.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAudit(session.user.id, "DELETE", "Group", id, { name: group?.name });

  revalidatePath("/groups");
}

export async function getTeachers() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  return prisma.user.findMany({
    where: { role: "TEACHER", deletedAt: null },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}

export async function addTeacherToGroup(groupId: string, teacherId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.teacherGroup.create({
    data: { groupId, teacherId },
  });

  revalidatePath("/groups");
}

export async function removeTeacherFromGroup(groupId: string, teacherId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.teacherGroup.deleteMany({
    where: { groupId, teacherId },
  });

  revalidatePath("/groups");
}
