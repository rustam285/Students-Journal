"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLessonsByMonth, getTeacherGroups } from "@/app/actions/journal";
import { getLessonLabel } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from "date-fns";
import { ru } from "date-fns/locale";

interface Lesson {
  id: string;
  date: Date;
  lessonNumber: number;
  topic: string;
  group: { id: string; name: string };
  teacher?: { id: string; name: string };
  records: {
    id: string;
    status: string;
    grade: number | null;
    student: { id: string; firstName: string; lastName: string };
  }[];
}

interface Group {
  id: string;
  name: string;
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadLessons = useCallback(async () => {
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const data = await getLessonsByMonth(
        year,
        month,
        selectedGroup === "all" ? undefined : selectedGroup
      );
      setLessons(data as Lesson[]);
    } catch (error) {
      console.error("Failed to load lessons:", error);
    }
  }, [currentDate, selectedGroup]);

  const loadGroups = useCallback(async () => {
    try {
      const data = await getTeacherGroups();
      setGroups(data);
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  function getLessonsForDay(day: Date) {
    return lessons.filter((l) => isSameDay(new Date(l.date), day));
  }

  function handleDayClick(day: Date) {
    const dayLessons = getLessonsForDay(day);
    if (dayLessons.length > 0) {
      setSelectedDay(day);
      setDialogOpen(true);
    }
  }

  function prevMonth() {
    setCurrentDate(subMonths(currentDate, 1));
  }

  function nextMonth() {
    setCurrentDate(addMonths(currentDate, 1));
  }

  const selectedDayLessons = selectedDay ? getLessonsForDay(selectedDay) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Календарь</h1>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-lg font-medium min-w-[200px] text-center">
            {format(currentDate, "LLLL yyyy", { locale: ru })}
          </div>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Все группы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все группы</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}

            {days.map((day) => {
              const dayLessons = getLessonsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const hasLessons = dayLessons.length > 0;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  disabled={!hasLessons}
                  className={cn(
                    "min-h-[80px] p-2 border rounded-lg text-left transition-colors",
                    isCurrentMonth ? "bg-background" : "bg-muted/50",
                    hasLessons && "cursor-pointer hover:bg-accent",
                    !hasLessons && "cursor-default",
                    isToday(day) && "border-primary",
                    selectedDay && isSameDay(day, selectedDay) && "ring-2 ring-primary"
                  )}
                >
                  <div
                    className={cn(
                      "text-sm font-medium",
                      !isCurrentMonth && "text-muted-foreground",
                      isToday(day) && "text-primary font-bold"
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  {hasLessons && (
                    <div className="mt-1 space-y-1">
                      {dayLessons.slice(0, 2).map((lesson) => (
                        <div
                          key={lesson.id}
                          className="text-xs bg-primary/10 text-primary rounded px-1 py-0.5 truncate"
                        >
                          {lesson.lessonNumber}п. {lesson.group.name}
                        </div>
                      ))}
                      {dayLessons.length > 2 && (
                        <div className="text-xs text-muted-foreground">
                          +{dayLessons.length - 2} ещё
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDay && format(selectedDay, "d MMMM yyyy", { locale: ru })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDayLessons.map((lesson) => (
              <Card key={lesson.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {getLessonLabel(lesson.lessonNumber)} — {lesson.group.name}
                    </CardTitle>
                    <Badge variant="outline">
                      {lesson.records.filter((r) => r.status === "PRESENT").length} / {lesson.records.length}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{lesson.topic}</p>
                  {lesson.teacher && (
                    <p className="text-sm text-muted-foreground">
                      Преподаватель: {lesson.teacher.name}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {lesson.records.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                      >
                        <span>
                          {record.student.lastName} {record.student.firstName}
                        </span>
                        <div className="flex items-center gap-2">
                          {record.grade && (
                            <Badge variant="secondary">{record.grade}</Badge>
                          )}
                          <Badge
                            variant={
                              record.status === "PRESENT"
                                ? "default"
                                : record.status === "ABSENT"
                                ? "destructive"
                                : "secondary"
                            }
                            className={cn(
                              record.status === "PRESENT" && "bg-green-500",
                              record.status === "LATE" && "bg-yellow-500"
                            )}
                          >
                            {record.status === "PRESENT"
                              ? "✓"
                              : record.status === "ABSENT"
                              ? "✕"
                              : "⏳"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
