/**
 * Одноразовая миграция данных SQLite → PostgreSQL.
 *
 * Запуск (из корня проекта):
 *   1. Поднять PostgreSQL (docker compose up -d)
 *   2. Создать схему:            pnpm prisma db push
 *   3. Запустить перенос данных: pnpm db:migrate-from-sqlite
 *
 * Скрипт читает старую SQLite-БД (SQLITE_DATABASE_URL) и переносит все записи
 * в текущую PostgreSQL-БД (DATABASE_URL), сохраняя оригинальные id (cuid),
 * связи, soft-delete и переименованные email.
 *
 * Безопасность: перед запуском убеждается, что целевая БД пуста (иначе --force).
 */
import Database from "better-sqlite3";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";

// --- Загрузка .env (dependency-free) -------------------------------------
function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

// --- Конфигурация моделей -------------------------------------------------
// Порядок вставки = порядок разрешения внешних ключей.
// boolFields / dateFields нужны для конвертации SQLite-представления (0/1, epoch-мс).
type ModelSpec = {
  table: string;
  model: keyof PrismaClient;
  boolFields: string[];
  dateFields: string[];
};

const MODELS: ModelSpec[] = [
  { table: "Term", model: "term", boolFields: ["isActive"], dateFields: ["startDate", "endDate"] },
  { table: "User", model: "user", boolFields: ["mustChangePassword"], dateFields: ["lockedUntil", "createdAt", "deletedAt"] },
  { table: "Group", model: "group", boolFields: [], dateFields: ["deletedAt"] },
  { table: "TeacherGroup", model: "teacherGroup", boolFields: [], dateFields: [] },
  { table: "Student", model: "student", boolFields: [], dateFields: ["deletedAt"] },
  { table: "StudentGroup", model: "studentGroup", boolFields: [], dateFields: [] },
  { table: "Subject", model: "subject", boolFields: [], dateFields: ["createdAt"] },
  { table: "Lesson", model: "lesson", boolFields: [], dateFields: ["date", "deletedAt"] },
  { table: "AttendanceRecord", model: "attendanceRecord", boolFields: [], dateFields: ["deletedAt"] },
  { table: "GroupAccessRequest", model: "groupAccessRequest", boolFields: [], dateFields: ["createdAt"] },
  { table: "AuditLog", model: "auditLog", boolFields: [], dateFields: ["createdAt"] },
];

// Превращаем сырую строку SQLite в объект, пригодный для prisma.createMany.
function convertRow(row: Record<string, unknown>, spec: ModelSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null) {
      out[key] = null;
    } else if (spec.boolFields.includes(key)) {
      // SQLite хранит BOOLEAN как 0/1
      out[key] = value === 1 || value === true || value === "1" || value === "true";
    } else if (spec.dateFields.includes(key)) {
      // SQLite/Prisma хранит DateTime как epoch-миллисекунды (число) либо ISO-строку
      const num = typeof value === "string" ? Number(value) : value;
      out[key] = typeof num === "number" && !Number.isNaN(num) ? new Date(num) : new Date(value as string);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function main() {
  const sqliteUrl = process.env.SQLITE_DATABASE_URL;
  if (!sqliteUrl) {
    console.error("❌ SQLITE_DATABASE_URL не задан в .env (например: SQLITE_DATABASE_URL=\"file:C:/.../dev.db\")");
    process.exit(1);
  }
  const sqlitePath = sqliteUrl.replace(/^file:/, "");

  if (!existsSync(sqlitePath)) {
    console.error(`❌ Файл SQLite не найден: ${sqlitePath}`);
    process.exit(1);
  }

  const force = process.argv.includes("--force");

  const prisma = new PrismaClient();
  const sqlite = new Database(sqlitePath, { readonly: true });

  try {
    // Защита от повторного запуска в непустую БД
    const existing = await prisma.user.count();
    if (existing > 0 && !force) {
      console.error(`⚠️  Целевая БД уже содержит ${existing} пользователей. Останавливаюсь, чтобы избежать дубликатов.`);
      console.error("   Если это осознанный повторный прогон, запустите с флагом --force (БД должна быть предварительно очищена).");
      process.exit(1);
    }

    console.log(`\n📦 Источник:  ${sqlitePath}`);
    console.log(`📦 Приёмник:  PostgreSQL (DATABASE_URL)\n`);

    const summary: { table: string; migrated: number }[] = [];

    for (const spec of MODELS) {
      const rows = sqlite.prepare(`SELECT * FROM "${spec.table}"`).all() as Record<string, unknown>[];
      if (rows.length === 0) {
        console.log(`   ${spec.table.padEnd(22)} 0 rows (пропуск)`);
        summary.push({ table: spec.table, migrated: 0 });
        continue;
      }

      const delegate = prisma[spec.model] as unknown as {
        createMany: (args: { data: Record<string, unknown>[]; skipDuplicates?: boolean }) => Promise<{ count: number }>;
      };

      const converted = rows.map((row) => convertRow(row, spec));
      const result = await delegate.createMany({ data: converted, skipDuplicates: true });

      console.log(`   ${spec.table.padEnd(22)} ${result.count}/${rows.length} rows`);
      summary.push({ table: spec.table, migrated: result.count });
    }

    const total = summary.reduce((s, x) => s + x.migrated, 0);
    console.log(`\n✅ Готово. Перенесено записей всего: ${total}\n`);
  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("❌ Ошибка миграции:", e);
  process.exit(1);
});
