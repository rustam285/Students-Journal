import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const teachers = await prisma.user.findMany({
      where: {
        role: "TEACHER",
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
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
        _count: {
          select: { lessonsCreated: { where: { deletedAt: null } } },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(teachers);
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
