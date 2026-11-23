/**
 * Отпечаток исходников — чтобы `pnpm prod` не пересобирал проект при каждом
 * запуске, а собирал только когда код изменился с прошлой успешной сборки.
 *
 * Как работает:
 *   - считается SHA-256 по содержимому всех файлов, влияющих на сборку
 *     (src, prisma/schema.prisma, конфиги, package.json + lock-файл);
 *   - после успешной сборки отпечаток вместе с BUILD_ID сохраняется в .build-checksum
 *     (это делает postbuild-скрипт и обёртка with-pg.mjs);
 *   - перед сборкой with-pg.mjs сравнивает текущий отпечаток с сохранённым:
 *     совпал (и .next/BUILD_ID на месте) — сборка пропускается.
 *
 * Использование:
 *   node scripts/build-fingerprint.mjs        # показать текущий и сохранённый отпечаток
 *   node scripts/build-fingerprint.mjs --mark # записать текущий отпечаток (postbuild)
 *
 * Форсировать пересборку: удалить файл .build-checksum (или папку .next).
 */
import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from "fs";
import { resolve, dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKSUM_FILE = resolve(ROOT, ".build-checksum");
const BUILD_ID_FILE = resolve(ROOT, ".next", "BUILD_ID");

// Что влияет на результат сборки (отсутствующие файлы/папки просто пропускаются)
const INPUTS = [
  "src",
  "public",
  "prisma/schema.prisma",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "next-env.d.ts",
  "next.config.mjs",
  "tailwind.config.ts",
  "postcss.config.mjs",
  "tsconfig.json",
  "components.json",
];

function collectFiles(file, acc) {
  if (!existsSync(file)) return;
  if (statSync(file).isDirectory()) {
    for (const name of readdirSync(file).sort()) collectFiles(join(file, name), acc);
  } else {
    acc.push(file);
  }
}

// Отпечаток содержимого исходников: путь + хэш каждого файла (порядок стабильный)
export function computeFingerprint() {
  const files = [];
  for (const input of INPUTS) collectFiles(resolve(ROOT, input), files);
  files.sort();
  const hash = createHash("sha256");
  for (const f of files) {
    hash.update(relative(ROOT, f).replace(/\\/g, "/"));
    hash.update("\0");
    hash.update(createHash("sha256").update(readFileSync(f)).digest("hex"));
    hash.update("\0");
  }
  return hash.digest("hex");
}

// Сохранённые данные о последней сборке: { fingerprint, buildId } | null
export function readStoredFingerprint() {
  try {
    return JSON.parse(readFileSync(CHECKSUM_FILE, "utf8"));
  } catch {
    return null;
  }
}

// Записать отпечаток текущего состояния (вызывается после успешной сборки)
export function markBuild() {
  let buildId = null;
  try {
    buildId = readFileSync(BUILD_ID_FILE, "utf8").trim();
  } catch {}
  writeFileSync(CHECKSUM_FILE, JSON.stringify({ fingerprint: computeFingerprint(), buildId }, null, 2), "utf8");
  return CHECKSUM_FILE;
}

// Собран ли .next уже из этого кода: отпечаток совпал и BUILD_ID не тронут
// (проверка BUILD_ID отсекает случай, когда после сборки запускали `next dev`,
// который перезаписал .next своими dev-артефактами)
export function isBuildUpToDate() {
  const stored = readStoredFingerprint();
  if (!stored || !existsSync(BUILD_ID_FILE)) return false;
  let currentBuildId = null;
  try {
    currentBuildId = readFileSync(BUILD_ID_FILE, "utf8").trim();
  } catch {}
  return stored.fingerprint === computeFingerprint() && stored.buildId !== null && stored.buildId === currentBuildId;
}

// --- запуск из командной строки --------------------------------------------
const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes("--mark")) {
    console.log(`[build-checksum] записан ${markBuild()}`);
  } else {
    const stored = readStoredFingerprint();
    console.log(`текущий отпечаток: ${computeFingerprint()}`);
    console.log(`сохранённый:       ${stored ? stored.fingerprint + " (buildId: " + stored.buildId + ")" : "— сборки ещё не было"}`);
    console.log(`актуально:         ${isBuildUpToDate() ? "да, сборку можно пропустить" : "нет, нужна сборка"}`);
  }
}
