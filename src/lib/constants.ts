export const LESSON_SCHEDULE = [
  { number: 1, start: "08:00", end: "09:30" },
  { number: 2, start: "09:40", end: "11:10" },
  { number: 3, start: "11:20", end: "12:50" },
  { number: 4, start: "13:15", end: "14:45" },
  { number: 5, start: "15:00", end: "16:30" },
  { number: 6, start: "16:40", end: "18:10" },
  { number: 7, start: "18:20", end: "19:50" },
  { number: 8, start: "19:55", end: "21:25" },
] as const;

export function getLessonTime(number: number) {
  return LESSON_SCHEDULE.find((l) => l.number === number);
}

export function getLessonLabel(number: number) {
  const time = getLessonTime(number);
  if (!time) return `Пара ${number}`;
  return `${number} пара (${time.start}–${time.end})`;
}
