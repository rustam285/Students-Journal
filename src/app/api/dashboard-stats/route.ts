import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    let stats = { groups: 0, students: 0, lessons: 0, records: 0 };

    if (role === "ADMIN") {
      const [groups, students, lessons, records] = await Promise.all([
        prisma.group.count({ where: { deletedAt: null } }),
        prisma.student.count({ where: { deletedAt: null } }),
        prisma.lesson.count({ where: { deletedAt: null } }),
        prisma.attendanceRecord.count({ where: { deletedAt: null } }),
      ]);
      stats = { groups, students, lessons, records };
    } else if (role === "TEACHER") {
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

      const [groups, students, lessons] = await Promise.all([
        Promise.resolve(teacherGroups.length),
        prisma.student.count({
          where: {
            deletedAt: null,
            groups: { some: { groupId: { in: groupIds } } },
          },
        }),
        prisma.lesson.count({
          where: { teacherId: session.user.id, deletedAt: null },
        }),
      ]);
      stats = { groups, students, lessons, records: 0 };
    } else if (role === "STUDENT") {
      const studentProfile = await prisma.student.findFirst({
        where: { userId: session.user.id, deletedAt: null },
        include: { groups: true },
      });

      if (studentProfile) {
        const records = await prisma.attendanceRecord.count({
          where: {
            studentId: studentProfile.id,
            deletedAt: null,
          },
        });
        stats = {
          groups: studentProfile.groups.length,
          students: 1,
          lessons: 0,
          records,
        };
      }
    }

    return NextResponse.json({
      stats,
      userName: session.user.name,
      userRole: role,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
