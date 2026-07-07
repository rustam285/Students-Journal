import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { studentIds } = await request.json();

    if (!studentIds || !Array.isArray(studentIds)) {
      return NextResponse.json(
        { error: "Некорректные данные" },
        { status: 400 }
      );
    }

    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        deletedAt: null,
        userId: null,
      },
    });

    const results: { email: string; password: string; name: string }[] = [];
    let errors = 0;

    for (const student of students) {
      try {
        const email = student.email || `${student.lastName.toLowerCase()}.${student.firstName.toLowerCase()}@student.csu.ru`;

        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          errors++;
          continue;
        }

        const password = generatePassword();
        const passwordHash = await hash(password, 10);

        const user = await prisma.user.create({
          data: {
            name: `${student.lastName} ${student.firstName}`,
            email,
            passwordHash,
            role: "STUDENT",
            mustChangePassword: true,
          },
        });

        await prisma.student.update({
          where: { id: student.id },
          data: { userId: user.id },
        });

        results.push({
          email: user.email,
          password,
          name: user.name,
        });
      } catch {
        errors++;
      }
    }

    return NextResponse.json({
      created: results.length,
      errors,
      accounts: results,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
