"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const termSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  startDate: z.string(),
  endDate: z.string(),
});

export async function getTerms() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return prisma.term.findMany({
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { lessons: true } },
    },
  });
}

export async function createTerm(data: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const parsed = termSchema.parse({
    name: data.get("name"),
    startDate: data.get("startDate"),
    endDate: data.get("endDate"),
  });

  await prisma.term.create({
    data: {
      name: parsed.name,
      startDate: new Date(parsed.startDate),
      endDate: new Date(parsed.endDate),
    },
  });

  revalidatePath("/terms");
  revalidatePath("/dashboard");
}

export async function updateTerm(id: string, data: FormData) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const parsed = termSchema.parse({
    name: data.get("name"),
    startDate: data.get("startDate"),
    endDate: data.get("endDate"),
  });

  await prisma.term.update({
    where: { id },
    data: {
      name: parsed.name,
      startDate: new Date(parsed.startDate),
      endDate: new Date(parsed.endDate),
    },
  });

  revalidatePath("/terms");
  revalidatePath("/dashboard");
}

export async function deleteTerm(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const term = await prisma.term.findUnique({
    where: { id },
    include: { _count: { select: { lessons: true } } },
  });

  if (!term) throw new Error("Период не найден");

  if (term._count.lessons > 0) {
    throw new Error("Нельзя удалить период с занятиями");
  }

  await prisma.term.delete({ where: { id } });

  revalidatePath("/terms");
  revalidatePath("/dashboard");
}

export async function setActiveTerm(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.term.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  await prisma.term.update({
    where: { id },
    data: { isActive: true },
  });

  revalidatePath("/terms");
  revalidatePath("/dashboard");
  revalidatePath("/journal");
}
