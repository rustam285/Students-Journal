// Клиент JSON-API сайта расписания ТФ ЧелГУ (Django, main/views/api_views.py).
// Только GET-запросы без авторизации; формат дат — ГГГГ-ММ-ДД; ошибки API
// приходят как {"error": "текст на русском"} — показываем их как есть.

import { z } from "zod";

const API_URL = process.env.SCHEDULE_API_URL || "http://127.0.0.1:8100";
const REQUEST_TIMEOUT_MS = 15_000;
// Справочники (группы/преподаватели) маленькие и меняются редко — кэшируем
const LISTS_CACHE_TTL_MS = 5 * 60 * 1000;
// Лимит API расписания: не больше 31 дня на запрос (включая границы)
const MAX_RANGE_DAYS_PER_REQUEST = 31;

const dateStrSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Некорректная дата (ожидался ГГГГ-ММ-ДД)");

const scheduleGroupSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
});

const scheduleTeacherSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
});

const scheduleLessonSchema = z.object({
  number: z.string(),
  time: z.string().nullish(),
  discipline: z.string().nullish(),
  format: z.string().nullish(),
  auditorium: z.number().nullish(),
  is_special: z.boolean().nullish(),
  // Одинаковые пары нескольких групп склеены в одну запись со списком названий
  groups: z.array(z.string()).default([]),
});

const teacherScheduleSchema = z.object({
  teacher: scheduleTeacherSchema,
  date_from: dateStrSchema,
  date_to: dateStrSchema,
  days: z.array(
    z.object({
      date: dateStrSchema,
      lessons: z.array(scheduleLessonSchema).default([]),
    })
  ),
});

export interface ScheduleGroup {
  id: number;
  title: string;
}

export interface ScheduleTeacher {
  id: number;
  name: string;
}

export interface ScheduleDayLesson {
  date: string;
  number: string;
  discipline: string | null | undefined;
  format: string | null | undefined;
  auditorium: number | null | undefined;
  isSpecial: boolean;
  groups: string[];
}

/**
 * База API берётся ТОЛЬКО из серверной конфигурации (env) и никогда — из
 * пользовательского ввода. Перед запросом проверяем схему (http/https) и
 * наличие хоста; пользовательские данные попадают лишь в валидируемые
 * query-параметры (числовые id, даты ГГГГ-ММ-ДД), поэтому направить запрос
 * на произвольный адрес через ввод невозможно. Loopback-адрес допустим
 * сознательно: это явно настроенный доверенный сервис расписания на том же
 * хосте (на проде — http://127.0.0.1:8100).
 */
function scheduleBaseUrl(): URL {
  let url: URL;
  try {
    url = new URL(API_URL);
  } catch {
    throw new Error("Некорректный SCHEDULE_API_URL в настройках сервера");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("SCHEDULE_API_URL поддерживает только http/https");
  }
  if (!url.hostname) {
    throw new Error("В SCHEDULE_API_URL не указан хост");
  }
  return url;
}

function buildUrl(path: string, params: Record<string, string>): URL {
  const url = scheduleBaseUrl();
  const basePrefix = url.pathname.replace(/\/+$/, "");
  url.pathname = `${basePrefix}${path}`;
  url.search = new URLSearchParams(params).toString();
  return url;
}

async function apiGet<S extends z.ZodTypeAny>(
  path: string,
  params: Record<string, string>,
  schema: S
): Promise<z.output<S>> {
  const res = await fetch(buildUrl(path, params), {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    redirect: "error",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `Сайт расписания ответил ошибкой (${res.status})`;
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (parsed && typeof parsed.error === "string" && parsed.error) {
        message = parsed.error;
      }
    } catch {
      // не JSON — оставляем общий текст
    }
    throw new Error(message);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("Сайт расписания вернул некорректный ответ");
  }
  return schema.parse(json);
}

// --- Справочники с кэшем ---

let groupsCache: { at: number; data: ScheduleGroup[] } | null = null;
let teachersCache: { at: number; data: ScheduleTeacher[] } | null = null;

export async function fetchScheduleGroups(): Promise<ScheduleGroup[]> {
  if (groupsCache && Date.now() - groupsCache.at < LISTS_CACHE_TTL_MS) {
    return groupsCache.data;
  }
  const parsed = await apiGet(
    "/api/groups/",
    {},
    z.object({ groups: z.array(scheduleGroupSchema) })
  );
  const data = parsed.groups;
  groupsCache = { at: Date.now(), data };
  return data;
}

export async function fetchScheduleTeachers(): Promise<ScheduleTeacher[]> {
  if (teachersCache && Date.now() - teachersCache.at < LISTS_CACHE_TTL_MS) {
    return teachersCache.data;
  }
  const parsed = await apiGet(
    "/api/teachers/",
    {},
    z.object({ teachers: z.array(scheduleTeacherSchema) })
  );
  const data = parsed.teachers;
  teachersCache = { at: Date.now(), data };
  return data;
}

// --- Расписание преподавателя ---

export function assertDateStr(value: string): string {
  return dateStrSchema.parse(value);
}

/** Разбивка диапазона на непересекающиеся окна ≤ 31 дня (лимит API). */
export function splitDateRange(dateFrom: string, dateTo: string): Array<[string, string]> {
  const from = new Date(`${assertDateStr(dateFrom)}T00:00:00Z`).getTime();
  const to = new Date(`${assertDateStr(dateTo)}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to) || from > to) {
    throw new Error("Некорректный диапазон дат");
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const windows: Array<[string, string]> = [];
  let cursor = from;
  while (cursor <= to) {
    const windowEnd = Math.min(cursor + (MAX_RANGE_DAYS_PER_REQUEST - 1) * dayMs, to);
    // Не «перескакиваем» на 1 марта из-за перевода часов/летнего времени:
    // даты всегда UTC-полночь, поэтому арифметика по миллисекундам корректна
    windows.push([
      new Date(cursor).toISOString().slice(0, 10),
      new Date(windowEnd).toISOString().slice(0, 10),
    ]);
    cursor = windowEnd + dayMs;
  }
  return windows;
}

/**
 * Расписание преподавателя за период. Вернутся только дни с парами,
 * отфильтрованными по правилам дисциплин (с loopback — «как в админке»).
 */
export async function fetchTeacherSchedule(
  teacherId: number,
  dateFrom: string,
  dateTo: string
): Promise<ScheduleDayLesson[]> {
  if (!Number.isInteger(teacherId) || teacherId <= 0) {
    throw new Error("Некорректный id преподавателя расписания");
  }
  const parsed = await apiGet(
    "/api/teacher_schedule/",
    {
      teacher_id: String(teacherId),
      date_from: assertDateStr(dateFrom),
      date_to: assertDateStr(dateTo),
    },
    teacherScheduleSchema
  );

  const lessons: ScheduleDayLesson[] = [];
  for (const day of parsed.days) {
    for (const lesson of day.lessons) {
      lessons.push({
        date: day.date,
        number: lesson.number,
        discipline: lesson.discipline,
        format: lesson.format,
        auditorium: lesson.auditorium,
        isSpecial: lesson.is_special === true,
        groups: lesson.groups,
      });
    }
  }
  return lessons;
}

// --- Сопоставление ФИО ---

/** Нормализация как на сайте расписания: без регистра и без разницы е/ё. */
function normalizeName(value: string): string {
  return (value || "").trim().toLowerCase().replace(/ё/g, "е");
}

/** «Фамилия Имя Отчество» / «Фамилия И.О.» → фамилия + инициалы (первые буквы слов после фамилии). */
function parseNameParts(name: string): { surname: string; initials: string[] } {
  const parts = normalizeName(name)
    .split(/[\s.]+/)
    .filter(Boolean);
  const [surname = "", ...rest] = parts;
  return { surname, initials: rest.map((word) => word.charAt(0)) };
}

/**
 * Поиск преподавателя расписания по ФИО пользователя журнала
 * («Фамилия Имя Отчество» против «Фамилия И.О.»). Совпадение — одинаковая
 * фамилия и все инициалы расписания подтверждены инициалами пользователя.
 * Если подходит несколько разных людей или никто — null: пользователь выберет
 * вручную в диалоге заполнения (выбор запомнится).
 */
export function matchScheduleTeacher(
  userName: string,
  teachers: ScheduleTeacher[]
): ScheduleTeacher | null {
  const { surname, initials } = parseNameParts(userName);
  if (!surname || initials.length === 0) return null;

  const matches = new Map<string, ScheduleTeacher>();
  for (const teacher of teachers) {
    const normalized = normalizeName(teacher.name);
    if (!normalized || normalized === "-") continue;
    const parts = parseNameParts(teacher.name);
    const ok =
      parts.surname === surname &&
      parts.initials.length > 0 &&
      parts.initials.length <= initials.length &&
      parts.initials.every((initial, i) => initial === initials[i]);
    if (ok && !matches.has(normalized)) {
      matches.set(normalized, teacher);
    }
  }
  if (matches.size !== 1) return null;
  return Array.from(matches.values())[0];
}
