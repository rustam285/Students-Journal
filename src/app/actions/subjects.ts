"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getSubjects() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  if (session.user.role === "ADMIN") {
    return prisma.subject.findMany({
      orderBy: { name: "asc" },
      include: {
        teacher: { select: { id: true, name: true } },
      },
    });
  }

  return prisma.subject.findMany({
    where: { teacherId: session.user.id },
    orderBy: { name: "asc" },
  });
}

export async function createSubject(name: string) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const existing = await prisma.subject.findFirst({
    where: { name, teacherId: session.user.id },
  });

  if (existing) {
    throw new Error("Предмет с таким названием уже существует");
  }

  await prisma.subject.create({
    data: { name, teacherId: session.user.id },
  });

  revalidatePath("/subjects");
  revalidatePath("/journal");
}

export async function deleteSubject(id: string) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const subject = await prisma.subject.findUnique({ where: { id } });
  if (!subject || subject.teacherId !== session.user.id) {
    throw new Error("Forbidden");
  }

  await prisma.subject.delete({ where: { id } });

  revalidatePath("/subjects");
  revalidatePath("/journal");
}
