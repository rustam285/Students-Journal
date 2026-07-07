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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const student = await prisma.student.findFirst({
      where: { id: params.id, deletedAt: null },
      include: { user: true },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Студент не найден" },
        { status: 404 }
      );
    }

    if (student.userId) {
      return NextResponse.json(
        { error: "У студента уже есть личный кабинет" },
        { status: 400 }
      );
    }

    const email = student.email || `${student.lastName.toLowerCase()}.${student.firstName.toLowerCase()}@student.csu.ru`;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 400 }
      );
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
      where: { id: params.id },
      data: { userId: user.id },
    });

    return NextResponse.json({
      name: user.name,
      email: user.email,
      password,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
