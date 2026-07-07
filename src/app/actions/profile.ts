"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getUserProfile() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      studentProfile: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          groups: {
            include: {
              group: { select: { id: true, name: true } },
            },
          },
        },
      },
      homeroomOf: {
        where: { deletedAt: null },
        select: { id: true, name: true },
      },
      teacherGroups: {
        where: { group: { deletedAt: null } },
        select: {
          group: { select: { id: true, name: true } },
        },
      },
    },
  });

  return user;
}
