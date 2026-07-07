import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface ImportStudent {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { groupId, students } = (await request.json()) as {
      groupId: string;
      students: ImportStudent[];
    };

    if (!groupId || !students || !Array.isArray(students)) {
      return NextResponse.json(
        { error: "Некорректные данные" },
        { status: 400 }
      );
    }

    const group = await prisma.group.findFirst({
      where: { id: groupId, deletedAt: null },
    });

    if (!group) {
      return NextResponse.json(
        { error: "Группа не найдена" },
        { status: 404 }
      );
    }

    let imported = 0;
    let errors = 0;

    for (const studentData of students) {
      try {
        const student = await prisma.student.create({
          data: {
            firstName: studentData.firstName,
            lastName: studentData.lastName,
            email: studentData.email || null,
            phone: studentData.phone || null,
          },
        });

        await prisma.studentGroup.create({
          data: {
            studentId: student.id,
            groupId,
          },
        });

        imported++;
      } catch {
        errors++;
      }
    }

    return NextResponse.json({ imported, errors });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
