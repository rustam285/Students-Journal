"use client";

import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Wand2, Check } from "lucide-react";
import { getTeacherGroups } from "@/app/actions/journal";
import {
  getFillSetup,
  fillJournalFromSchedule,
  fillAllGroupsFromSchedule,
  type FillResult,
  type FillAllResult,
} from "@/app/actions/schedule";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, addMonths } from "date-fns";

export interface FillSetup {
  scheduleTeacherId: number | null;
  scheduleGroupId: number | null;
  teachers: { id: number; name: string }[];
  groups: { id: number; title: string }[];
}

interface PendingFill {
  dateFrom: string;
  dateTo: string;
  label: string;
}

// Неделя в журнале начинается с понедельника
const WEEK_OPTS = { weekStartsOn: 1 } as const;
const fmtYmd = (d: Date) => format(d, "yyyy-MM-dd");

interface FillJournalDialogProps {
  /** Выбранная группа журнала (журнал передаёт свою; календарь может не передавать) */
  defaultGroupId?: string;
  /** Вызывается после успешного заполнения (перезагрузить список занятий) */
  onFilled?: () => void;
  disabled?: boolean;
}

/**
 * Кнопка «Заполнить» + диалог автозаполнения журнала из расписания.
 * Общий для страниц журнала и календаря.
 */
export function FillJournalDialog({ defaultGroupId, onFilled, disabled }: FillJournalDialogProps) {
  const [open, setOpen] = useState(false);
  const [setup, setSetup] = useState<FillSetup | null>(null);
  // null — группа передаётся снаружи (журнал); список нужен только календарю
  const [journalGroups, setJournalGroups] = useState<{ id: string; name: string }[] | null>(null);
  const [journalGroupId, setJournalGroupId] = useState<string>(defaultGroupId ?? "");
  const [teacherId, setTeacherId] = useState<string>("");
  const [scheduleGroupId, setScheduleGroupId] = useState<string>("");
  const [singleDate, setSingleDate] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [allGroups, setAllGroups] = useState(false);
  const [pending, setPending] = useState<PendingFill | null>(null);
  const [result, setResult] = useState<FillResult | FillAllResult | null>(null);
  const [resultMode, setResultMode] = useState<"single" | "all">("single");
  const [isPending, startTransition] = useTransition();

  const needGroupSelect = !defaultGroupId;

  const loadSetup = useCallback(async (groupId: string) => {
    setSetup(null);
    try {
      const s = await getFillSetup(groupId);
      setSetup(s);
      setTeacherId(s.scheduleTeacherId ? String(s.scheduleTeacherId) : "");
      setScheduleGroupId(s.scheduleGroupId ? String(s.scheduleGroupId) : "");
    } catch (error) {
      setOpen(false);
      alert(error instanceof Error ? error.message : "Не удалось получить данные расписания");
    }
  }, []);

  async function openDialog() {
    setResult(null);
    setPending(null);
    setAllGroups(false);
    const today = fmtYmd(new Date());
    setSingleDate(today);
    setDateFrom(today);
    setDateTo(fmtYmd(addWeeks(new Date(), 1)));
    setOpen(true);
    try {
      // группы журнала нужны всегда: для выбора (календарь) и для имени в сводке
      const groups = await getTeacherGroups();
      setJournalGroups(groups);
      const target = defaultGroupId
        ? defaultGroupId
        : journalGroupId && groups.some((g) => g.id === journalGroupId)
          ? journalGroupId
          : groups[0]?.id ?? "";
      setJournalGroupId(target);
      if (target) await loadSetup(target);
    } catch (error) {
      setOpen(false);
      alert(error instanceof Error ? error.message : "Не удалось загрузить группы");
    }
  }

  function switchJournalGroup(id: string) {
    setJournalGroupId(id);
    setResult(null);
    setPending(null);
    loadSetup(id);
  }

  function choosePreset(from: string, to: string, label: string) {
    setResult(null);
    setPending({ dateFrom: from, dateTo: to, label });
  }

  function confirmFill() {
    if (!pending) return;
    if (!teacherId) {
      alert("Выберите преподавателя в расписании");
      return;
    }
    if (!allGroups && (!journalGroupId || !scheduleGroupId)) {
      alert("Выберите группу и её соответствие в расписании");
      return;
    }

    startTransition(async () => {
      try {
        if (allGroups) {
          const res = await fillAllGroupsFromSchedule({
            scheduleTeacherId: Number(teacherId),
            dateFrom: pending.dateFrom,
            dateTo: pending.dateTo,
          });
          setResultMode("all");
          setResult(res);
        } else {
          const res = await fillJournalFromSchedule({
            groupId: journalGroupId,
            scheduleTeacherId: Number(teacherId),
            scheduleGroupId: Number(scheduleGroupId),
            dateFrom: pending.dateFrom,
            dateTo: pending.dateTo,
          });
          setResultMode("single");
          setResult(res);
        }
        setPending(null);
        onFilled?.();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка автозаполнения");
      }
    });
  }

  const teacherName = setup?.teachers.find((t) => String(t.id) === teacherId)?.name ?? null;
  const scheduleGroupTitle =
    setup?.groups.find((g) => String(g.id) === scheduleGroupId)?.title ?? null;
  const journalGroupName =
    journalGroups?.find((g) => g.id === journalGroupId)?.name ?? null;

  const busy = isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" onClick={openDialog} disabled={disabled}>
          <Wand2 className="mr-2 h-4 w-4" />
          Заполнить
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Автозаполнение журнала</DialogTitle>
          <DialogDescription>
            Занятия создаются из расписания сайта ТФ ЧелГУ — только ваши пары.
            Посещаемость выставляется «Присутствует», существующие занятия не дублируются.
          </DialogDescription>
        </DialogHeader>
        {!setup ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Загрузка данных расписания...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Преподаватель в расписании</Label>
                <Select value={teacherId} onValueChange={setTeacherId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите" />
                  </SelectTrigger>
                  <SelectContent>
                    {setup.teachers.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {needGroupSelect ? (
                <div className="space-y-2">
                  <Label>Группа журнала</Label>
                  <Select
                    value={journalGroupId}
                    onValueChange={switchJournalGroup}
                    disabled={allGroups}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите" />
                    </SelectTrigger>
                    <SelectContent>
                      {(journalGroups ?? []).map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Группа в расписании</Label>
                  <Select value={scheduleGroupId} onValueChange={setScheduleGroupId} disabled={allGroups}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите" />
                    </SelectTrigger>
                    <SelectContent>
                      {setup.groups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {needGroupSelect && (
              <div className="space-y-2">
                <Label>Группа в расписании</Label>
                <Select value={scheduleGroupId} onValueChange={setScheduleGroupId} disabled={allGroups}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите" />
                  </SelectTrigger>
                  <SelectContent>
                    {setup.groups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={allGroups ? "default" : "outline"}
                onClick={() => {
                  setAllGroups(!allGroups);
                  setPending(null);
                }}
              >
                {allGroups && <Check className="mr-2 h-4 w-4" />}
                Все мои группы
              </Button>
              <span className="text-xs text-muted-foreground">
                заполнить каждую группу, к которой у вас есть доступ
              </span>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => choosePreset(fmtYmd(new Date()), fmtYmd(new Date()), "сегодня")}
              >
                Заполнить на сегодня
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  choosePreset(
                    fmtYmd(startOfWeek(new Date(), WEEK_OPTS)),
                    fmtYmd(endOfWeek(new Date(), WEEK_OPTS)),
                    "эта неделя"
                  )
                }
              >
                Заполнить на эту неделю
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  const tomorrow = addDays(new Date(), 1);
                  choosePreset(fmtYmd(tomorrow), fmtYmd(tomorrow), "завтра");
                }}
              >
                Заполнить на завтра
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  const nextWeek = addWeeks(new Date(), 1);
                  choosePreset(
                    fmtYmd(startOfWeek(nextWeek, WEEK_OPTS)),
                    fmtYmd(endOfWeek(nextWeek, WEEK_OPTS)),
                    "следующая неделя"
                  );
                }}
              >
                Заполнить на следующую неделю
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={busy || !singleDate}
                  onClick={() => choosePreset(singleDate, singleDate, "указанная дата")}
                >
                  Заполнить на дату
                </Button>
                <Input
                  type="date"
                  className="w-[150px]"
                  value={singleDate}
                  onChange={(e) => setSingleDate(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() =>
                  choosePreset(
                    fmtYmd(startOfWeek(new Date(), WEEK_OPTS)),
                    fmtYmd(endOfWeek(addWeeks(new Date(), 1), WEEK_OPTS)),
                    "две недели (эта и следующая)"
                  )
                }
              >
                Заполнить на две недели
              </Button>
            </div>

            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() =>
                choosePreset(fmtYmd(new Date()), fmtYmd(addMonths(new Date(), 1)), "месяц (с сегодня)")
              }
            >
              Заполнить на месяц (с сегодня)
            </Button>

            <div className="space-y-2">
              <Label>Произвольный период</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={busy || !dateFrom || !dateTo || dateFrom > dateTo}
                  onClick={() => choosePreset(dateFrom, dateTo, "указанный период")}
                >
                  Заполнить с даты по дату
                </Button>
                <Input
                  type="date"
                  className="w-[150px]"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <Input
                  type="date"
                  className="w-[150px]"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {pending && (
              <div className="rounded-md border border-primary/40 bg-muted/50 p-3 text-sm space-y-2">
                <div className="font-medium">Проверьте, всё ли выбрано верно:</div>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>
                    Группа журнала:{" "}
                    {allGroups ? (
                      <b>все мои группы{journalGroups ? ` (${journalGroups.length})` : ""}</b>
                    ) : (
                      <b>{journalGroupName ?? "—"}</b>
                    )}
                  </li>
                  <li>
                    Группа расписания:{" "}
                    {allGroups ? (
                      <>по сопоставлению (название или сохранённый выбор)</>
                    ) : (
                      <b>{scheduleGroupTitle ?? "—"}</b>
                    )}
                  </li>
                  <li>
                    Преподаватель: <b>{teacherName ?? "—"}</b>
                  </li>
                  <li>
                    Период:{" "}
                    <b>
                      {pending.dateFrom} — {pending.dateTo} ({pending.label})
                    </b>
                  </li>
                </ul>
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setPending(null)} disabled={busy}>
                    Отмена
                  </Button>
                  <Button size="sm" onClick={confirmFill} disabled={busy}>
                    {busy ? "Заполнение..." : "Заполнить"}
                  </Button>
                </div>
              </div>
            )}

            {result && resultMode === "single" && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div>Готово. Создано занятий: {(result as FillResult).created}.</div>
                {(result as FillResult).skipped > 0 && (
                  <div>Уже существовало (пропущено): {(result as FillResult).skipped}.</div>
                )}
                {(result as FillResult).subjectsCreated > 0 && (
                  <div>Создано новых предметов: {(result as FillResult).subjectsCreated}.</div>
                )}
                {(result as FillResult).created === 0 && (result as FillResult).skipped === 0 && (
                  <div>
                    В расписании нет ваших пар этой группы за выбранный период — занятия не созданы.
                  </div>
                )}
              </div>
            )}

            {result && resultMode === "all" && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <div>
                  Готово. Всего создано занятий: {(result as FillAllResult).created}, пропущено
                  существующих: {(result as FillAllResult).skipped}, новых предметов:{" "}
                  {(result as FillAllResult).subjectsCreated}.
                </div>
                {(result as FillAllResult).groups.map((g) => (
                  <div key={g.name}>
                    {g.name} ({g.scheduleGroupTitle}): создано {g.created}
                    {g.skipped > 0 ? `, пропущено ${g.skipped}` : ""}
                    {g.created === 0 && g.skipped === 0 ? " — пар не найдено" : ""}
                  </div>
                ))}
                {(result as FillAllResult).unmapped.length > 0 && (
                  <div>
                    Не сопоставлены с расписанием (пропущены):{" "}
                    {(result as FillAllResult).unmapped.join(", ")}. Выберите соответствие вручную
                    при заполнении этой группы — дальше оно запомнится.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
