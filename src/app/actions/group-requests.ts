"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getGroupAccessRequests() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  return prisma.groupAccessRequest.findMany({
    where: { status: "PENDING" },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      group: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getMyGroupAccessRequests() {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  return prisma.groupAccessRequest.findMany({
    where: { teacherId: session.user.id },
    include: {
      group: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function requestGroupAccess(groupId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "TEACHER") {
    throw new Error("Unauthorized");
  }

  const existing = await prisma.groupAccessRequest.findFirst({
    where: {
      teacherId: session.user.id,
      groupId,
      status: "PENDING",
    },
  });

  if (existing) {
    throw new Error("Запрос уже отправлен");
  }

  const hasAccess = await prisma.teacherGroup.findFirst({
    where: { teacherId: session.user.id, groupId },
  });

  if (hasAccess) {
    throw new Error("У вас уже есть доступ к этой группе");
  }

  await prisma.groupAccessRequest.create({
    data: {
      teacherId: session.user.id,
      groupId,
    },
  });

  revalidatePath("/groups");
}

export async function approveGroupAccessRequest(requestId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  const request = await prisma.groupAccessRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) throw new Error("Request not found");

  await prisma.teacherGroup.create({
    data: {
      teacherId: request.teacherId,
      groupId: request.groupId,
    },
  });

  await prisma.groupAccessRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED" },
  });

  revalidatePath("/groups");
}

export async function rejectGroupAccessRequest(requestId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized");
  }

  await prisma.groupAccessRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED" },
  });

  revalidatePath("/groups");
}
