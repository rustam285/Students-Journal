/**
 * Обёртка для запуска приложения со встроенным PostgreSQL.
 *
 * Использование:
 *   node scripts/with-pg.mjs --setup-only          # первичная настройка БД и выход
 *   node scripts/with-pg.mjs -- pnpm dev           # поднять БД и запустить команду
 *   node scripts/with-pg.mjs --prod                # поднять БД, сделать build и запустить start:all
 *   node scripts/with-pg.mjs -- pnpm db:studio     # любая другая команда
 *
 * Что делает при запуске:
 *   1. Создаёт .env из .env.example (сгенерировав секреты), если его нет
 *   2. Инициализирует встроенный PostgreSQL (./pgdata), если не был инициализирован
 *   3. Запускает сервер (порт по умолчанию 5433, чтобы не конфликтовать с локальным 5432)
 *   4. Создаёт базу students_journal, если её нет
 *   5. Применяет схему Prisma (db push), если таблиц ещё нет
 *   6. Если БД пуста:
 *        - есть старый SQLite (SQLITE_DATABASE_URL) → переносит данные
 *        - иначе → заливает тестовые данные (seed)
 *   7. Запускает переданную команду; при её завершении останавливает сервер
 *      (в режиме --prod сначала выполнит pnpm build, а затем pnpm start:all)
 *
 * Надёжность (обработка аварийных завершений):
 *   - PID обёртки-владельца хранится в pgdata/.wrapper.pid
 *   - если после креша/закрытия окна остались осиротевшие процессы встроенного
 *     PostgreSQL (порт занят, shared memory блокирована) — они корректно
 *     завершаются, сервер стартует заново (самовосстановление).
 *     Важно: завершаются ТОЛЬКО процессы из node_modules/embedded-postgres,
 *     другие установленные PostgreSQL-серверы не затрагиваются
 *   - если запущена вторая копия обёртки (например, dev + studio) — она
 *     подключается к уже работающему серверу и не останавливает его по завершении
 *
 * Если DATABASE_URL указывает на внешний сервер (не localhost:5433),
 * встроенный PostgreSQL не запускается — команда просто выполняется.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync, spawn } from "child_process";
import { randomBytes } from "crypto";
import net from "net";
import EmbeddedPostgres from "embedded-postgres";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// --- Конфигурация встроенного кластера ------------------------------------
const PG_PORT = Number(process.env.PG_EMBEDDED_PORT || 5433);
const PG_USER = process.env.PG_EMBEDDED_USER || "journal";
const PG_PASSWORD = process.env.PG_EMBEDDED_PASSWORD || "journal";
const PG_DATABASE = process.env.PG_EMBEDDED_DATABASE || "students_journal";
const PG_DATA_DIR = resolve(ROOT, "pgdata");
const ENV_PATH = resolve(ROOT, ".env");
const WRAPPER_PID_FILE = resolve(PG_DATA_DIR, ".wrapper.pid");
const POSTMASTER_PID_FILE = resolve(PG_DATA_DIR, "postmaster.pid");

function log(msg) {
  console.log(`[pg] ${msg}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function errText(e) {
  if (!e) return "неизвестная ошибка";
  return e.message || String(e);
}

// Жив ли процесс с данным PID (process.kill с сигналом 0 — только проверка)
function isAlive(pid) {
  if (!pid || Number.isNaN(pid)) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPidFile(file) {
  try {
    return Number(readFileSync(file, "utf8").split("\n")[0].trim());
  } catch {
    return null;
  }
}

function killPid(pid) {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(pid), "/f", "/t"], { shell: true });
  } else {
    try {
      process.kill(pid, "SIGKILL");
    } catch {}
  }
}

// Есть ли активный слушатель на порту (быстрая TCP-проверка)
function isPortOpen(port) {
  return new Promise((resolvePromise) => {
    const socket = new net.Socket();
    const finish = (result) => {
      clearTimeout(timer);
      socket.destroy();
      resolvePromise(result);
    };
    const timer = setTimeout(() => finish(false), 1500);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.connect(port, "127.0.0.1");
  });
}

// Завершить ТОЛЬКО процессы postgres, запущенные из node_modules/embedded-postgres.
// Опознание по пути или командной строке (ExecutablePath бывает скрыт служебными
// процессами SYSTEM — их не трогаем, это может быть системный PostgreSQL).
// Скрипт передаётся через -EncodedCommand (base64 UTF-16LE), чтобы cmd.exe
// не интерпретировал пайпы и кавычки внутри PowerShell-кода.
function killEmbeddedPostgresProcesses() {
  let killed = 0;
  if (process.platform === "win32") {
    const script =
      "$ps = Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | " +
      "Where-Object { ($_.ExecutablePath -like '*embedded-postgres*') -or ($_.CommandLine -like '*embedded-postgres*') }; " +
      "$ps | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }; " +
      "Write-Output $ps.Count";
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const res = spawnSync("powershell", ["-NoProfile", "-EncodedCommand", encoded], {
      encoding: "utf8",
    });
    if (res.status !== 0) console.error(`[pg] очистка не удалась: ${(res.stderr || "").trim().slice(0, 300)}`);
    killed = Number((res.stdout || "").trim()) || 0;
  } else {
    // unix: завершаем по совпадению пути в командной строке процесса
    spawnSync("pkill", ["-f", "embedded-postgres.*[/\\]postgres"]);
    killed = -1; // точное число недоступно
  }
  return killed;
}

// --- Загрузка .env (dependency-free) --------------------------------------
function loadEnv() {
  if (!existsSync(ENV_PATH)) return;
  for (const line of readFileSync(ENV_PATH, "utf8").split("\n")) {
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

// Создаёт .env из примера, подставляя сгенерированные секреты
function ensureEnvFile() {
  if (existsSync(ENV_PATH)) return;
  const examplePath = resolve(ROOT, ".env.example");
  if (!existsSync(examplePath)) {
    log("⚠️  Не найден ни .env, ни .env.example — продолжаю без файла");
    return;
  }
  let content = readFileSync(examplePath, "utf8");
  content = content
    .replace(/^NEXTAUTH_SECRET=.*$/m, `NEXTAUTH_SECRET="${randomBytes(32).toString("base64")}"`)
    .replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET="${randomBytes(32).toString("base64")}"`);
  writeFileSync(ENV_PATH, content, "utf8");
  log("Создан .env из .env.example (секреты сгенерированы автоматически)");
}

// Указывает ли DATABASE_URL на наш встроенный экземпляр
function isEmbeddedTarget() {
  const url = process.env.DATABASE_URL || "";
  try {
    const u = new URL(url);
    const port = u.port ? Number(u.port) : 5432;
    return port === PG_PORT && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

// --- Выполнение команд (shell — для .cmd на Windows) -----------------------
function run(command, args, label) {
  log(`▶ ${label || `${command} ${args.join(" ")}`}`);
  const res = spawnSync(command, args, { stdio: "inherit", shell: true, cwd: ROOT });
  if (res.status !== 0) {
    throw new Error(`Команда не удалась (код ${res.status}): ${command} ${args.join(" ")}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const setupOnly = args.includes("--setup-only");
  const prodMode = args.includes("--prod");
  const dashDash = args.indexOf("--");
  // Если передан --prod и нет явной команды после --, используем "pnpm start"
  const command = dashDash !== -1 ? args.slice(dashDash + 1) : (prodMode ? ["pnpm", "start"] : []);

  ensureEnvFile();
  loadEnv();

  // Внешняя БД — просто выполняем команду без встроенного сервера
  if (!isEmbeddedTarget()) {
    log("DATABASE_URL указывает на внешний сервер — встроенный PostgreSQL не нужен");
    if (setupOnly || command.length === 0) {
      log("Нечего выполнять. Выход.");
      return;
    }
    run(command[0], command.slice(1));
    return;
  }

  const pg = new EmbeddedPostgres({
    databaseDir: PG_DATA_DIR,
    port: PG_PORT,
    user: PG_USER,
    password: PG_PASSWORD,
    authMethod: "scram-sha-256",
    persistent: true,
    onLog: () => {},
    onError: (m) => console.error(`[pg:stderr] ${m}`),
  });

  let ownsPostgres = true;

  // --- Определяем состояние кластера и чистим «сирот» ----------------------
  const portOpen = await isPortOpen(PG_PORT);
  const wrapperPid = readPidFile(WRAPPER_PID_FILE);
  const anotherWrapperAlive = isAlive(wrapperPid) && wrapperPid !== process.pid;
  const postmasterPid = readPidFile(POSTMASTER_PID_FILE);
  const postmasterAlive = isAlive(postmasterPid);

  if (portOpen && anotherWrapperAlive) {
    // порт открыт другой живой обёрткой — работаем с её сервером
    log(`PostgreSQL уже запущен (обёртка PID ${wrapperPid}) — использую его`);
    ownsPostgres = false;
  } else if (portOpen || postmasterAlive) {
    // сервер/остатки работают, но владелец мёртв — это «сироты» после креша
    const parts = [];
    if (postmasterAlive) parts.push(`postmaster PID ${postmasterPid}`);
    if (portOpen) parts.push(`порт ${PG_PORT} занят`);
    log(`Найдены осиротевшие процессы встроенного PostgreSQL (${parts.join(", ")}) от аварийно завершённой обёртки — завершаю их`);
    const killed = killEmbeddedPostgresProcesses();
    if (killed > 0) log(`Завершено процессов: ${killed}`);
    if (isAlive(postmasterPid)) killPid(postmasterPid);
    // postgres при жёстком завершении не успевает удалить свои lock-файлы
    for (const f of [POSTMASTER_PID_FILE, WRAPPER_PID_FILE]) {
      try {
        if (existsSync(f)) rmSync(f, { force: true });
      } catch {}
    }
    await sleep(2500);
  }

  if (ownsPostgres) {
    // 1. Инициализация кластера при первом запуске
    if (!existsSync(resolve(PG_DATA_DIR, "PG_VERSION"))) {
      if (existsSync(PG_DATA_DIR)) {
        log("Обнаружены остатки незавершённой инициализации — очищаю pgdata/");
        rmSync(PG_DATA_DIR, { recursive: true, force: true });
      }
      mkdirSync(PG_DATA_DIR, { recursive: true });
      log("Первый запуск: инициализирую PostgreSQL в ./pgdata…");
      await pg.initialise();
      log("Кластер инициализирован");
    }

    // 2. Запуск сервера
    log(`Запускаю PostgreSQL на порту ${PG_PORT}…`);
    try {
      await pg.start();
    } catch (e) {
      // повторная попытка после очистки (могли остаться процессы между проверками)
      log(`Первый запуск не удался (${errText(e)}) — пробую очистить и повторить…`);
      killEmbeddedPostgresProcesses();
      try {
        if (existsSync(POSTMASTER_PID_FILE)) rmSync(POSTMASTER_PID_FILE, { force: true });
      } catch {}
      await sleep(2000);
      try {
        await pg.start();
      } catch (e2) {
        throw new Error(
          `Не удалось запустить PostgreSQL на порту ${PG_PORT}. ` +
            `Возможно, порт занят другим приложением — сменить порт можно переменной ` +
            `PG_EMBEDDED_PORT (и DATABASE_URL). Причина: ${errText(e2)}`
        );
      }
    }
    writeFileSync(WRAPPER_PID_FILE, String(process.pid), "utf8");
    log("PostgreSQL запущен");
  }

  try {
    // 3. База данных
    const admin = pg.getPgClient("postgres");
    await admin.connect();
    const dbExists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [PG_DATABASE]);
    if (dbExists.rowCount === 0) {
      log(`Создаю базу данных ${PG_DATABASE}…`);
      await admin.end();
      await pg.createDatabase(PG_DATABASE);
    } else {
      await admin.end();
    }

    // 4. Схема Prisma
    const client = pg.getPgClient(PG_DATABASE);
    await client.connect();
    const tables = await client.query(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'User'`
    );
    if (tables.rows[0].n === 0) {
      await client.end();
      log("Применяю схему Prisma (db push)…");
      run("pnpm", ["prisma", "db", "push"], "prisma db push");
    } else {
      await client.end();
    }

    // 5. Данные: миграция из SQLite или seed
    const check = pg.getPgClient(PG_DATABASE);
    await check.connect();
    const counts = await check.query(
      `SELECT
         (SELECT COUNT(*)::int FROM "User") AS users,
         (SELECT COUNT(*)::int FROM "Student") AS students,
         (SELECT COUNT(*)::int FROM "Group") AS groups`
    );
    await check.end();
    const isEmpty =
      counts.rows[0].users === 0 && counts.rows[0].students === 0 && counts.rows[0].groups === 0;

    if (isEmpty) {
      const sqliteUrl = process.env.SQLITE_DATABASE_URL || "";
      const sqlitePath = sqliteUrl.replace(/^file:/, "");
      if (sqlitePath && existsSync(sqlitePath)) {
        log(`БД пуста и найден старый SQLite (${sqlitePath}) — переношу данные…`);
        run("pnpm", ["db:migrate-from-sqlite"], "миграция данных из SQLite");
      } else {
        log("БД пуста — заливаю тестовые данные (seed)…");
        run("pnpm", ["db:seed"], "prisma seed");
      }
    } else {
      log(`БД уже содержит данные (users=${counts.rows[0].users}) — пропускаю заполнение`);
    }
  } catch (e) {
    console.error(`❌ Ошибка настройки: ${errText(e)}`);
    if (ownsPostgres) await pg.stop();
    process.exit(1);
  }

  if (setupOnly || command.length === 0) {
    if (ownsPostgres) {
      log("Настройка завершена. Останавливаю PostgreSQL…");
      await pg.stop();
    } else {
      log("Настройка завершена (сервером управляет другая обёртка — не останавливаю)");
    }
    log("Готово.");
    return;
  }

  // --- НОВЫЙ БЛОК: Сборка проекта для прод-режима ---------------------------
  if (prodMode) {
    log("▶ Запускаю сборку проекта (pnpm build)…");
    try {
      // Используем существующую функцию run (она синхронная)
      run("pnpm", ["build"], "pnpm build");
    } catch (e) {
      console.error(`❌ Ошибка сборки: ${errText(e)}`);
      if (ownsPostgres) await pg.stop();
      process.exit(1);
    }
  }

  // 6. Запуск целевой команды; по завершении — остановка сервера (если мы владелец)
  log(`▶ Запуск: ${command.join(" ")}`);
  const child = spawn(command[0], command.slice(1), {
    stdio: "inherit",
    shell: true,
    cwd: ROOT,
  });

  child.on("exit", async (code) => {
    if (ownsPostgres) {
      log(`Команда завершена (код ${code}). Останавливаю PostgreSQL…`);
      try {
        await pg.stop();
      } finally {
        process.exit(code ?? 0);
      }
    } else {
      log(`Команда завершена (код ${code}). Сервером управляет другая обёртка — не останавливаю.`);
      process.exit(code ?? 0);
    }
  });
}

main().catch((e) => {
  console.error("❌", errText(e));
  process.exit(1);
});
