"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Save, Trash2, BookOpen, ChevronDown, ChevronUp, Download } from "lucide-react";
import {
  getTeacherGroups,
  getGroupStudents,
  getLessons,
  createLesson,
  updateAttendance,
  updateLesson,
  deleteLesson,
} from "@/app/actions/journal";
import { getSubjects } from "@/app/actions/subjects";
import { getJournalExport } from "@/app/actions/export";
import { LESSON_SCHEDULE, getLessonLabel } from "@/lib/constants";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Group {
  id: string;
  name: string;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
}

interface AttendanceRecord {
  id: string;
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE";
  grade: number | null;
  bonusPoints: number | null;
  comment: string | null;
  student: Student;
}

interface Lesson {
  id: string;
  date: Date;
  lessonNumber: number;
  topic: string;
  notes: string | null;
  subjectId?: string | null;
  subject?: { id: string; name: string } | null;
  teacher?: { id: string; name: string };
  records: AttendanceRecord[];
}

interface Subject {
  id: string;
  name: string;
}

export default function JournalPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [students, setStudents] = useState<{ student: Student }[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [expandedLesson, setExpandedLesson] = useState<string | null>(null);

  const [newDate, setNewDate] = useState("");
  const [newLessonNumber, setNewLessonNumber] = useState<string>("1");
  const [newSubjectId, setNewSubjectId] = useState<string>("");
  const [newTopic, setNewTopic] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [editRecords, setEditRecords] = useState<
    Map<string, { status: "PRESENT" | "ABSENT" | "LATE"; grade: string; bonusPoints: string; comment: string }>
  >(new Map());
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [warningDialog, setWarningDialog] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });
  const [editLessonDialog, setEditLessonDialog] = useState<{ open: boolean; lesson: Lesson | null }>({
    open: false,
    lesson: null,
  });
  const [editDate, setEditDate] = useState("");
  const [editLessonNumber, setEditLessonNumber] = useState<string>("1");
  const [editTopic, setEditTopic] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const loadGroups = useCallback(async () => {
    try {
      const data = await getTeacherGroups();
      setGroups(data);
      if (data.length > 0 && !selectedGroup) {
        setSelectedGroup(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  }, [selectedGroup]);

  const loadSubjects = useCallback(async () => {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (error) {
      console.error("Failed to load subjects:", error);
    }
  }, []);

  const loadLessons = useCallback(async () => {
    if (!selectedGroup) return;
    try {
      const data = await getLessons(selectedGroup);
      setLessons(data as Lesson[]);
    } catch (error) {
      console.error("Failed to load lessons:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedGroup]);

  const loadStudents = useCallback(async () => {
    if (!selectedGroup) return;
    try {
      const data = await getGroupStudents(selectedGroup);
      setStudents(data);
    } catch (error) {
      console.error("Failed to load students:", error);
    }
  }, [selectedGroup]);

  useEffect(() => {
    loadGroups();
    loadSubjects();
  }, [loadGroups, loadSubjects]);

  useEffect(() => {
    if (selectedGroup) {
      loadLessons();
      loadStudents();
    }
  }, [selectedGroup, loadLessons, loadStudents]);

  function openCreateDialog() {
    setNewDate(format(new Date(), "yyyy-MM-dd"));
    setNewLessonNumber("1");
    setNewTopic("");
    setNewNotes("");
    setCreateDialogOpen(true);
  }

  function openEditDialog(lesson: Lesson) {
    setEditingLesson(lesson);
    const recordsMap = new Map();
    lesson.records.forEach((r) => {
      recordsMap.set(r.studentId, {
        status: r.status,
        grade: r.grade?.toString() || "",
        bonusPoints: r.bonusPoints?.toString() || "",
        comment: r.comment || "",
      });
    });
    students.forEach((s) => {
      if (!recordsMap.has(s.student.id)) {
        recordsMap.set(s.student.id, {
          status: "PRESENT",
          grade: "",
          bonusPoints: "",
          comment: "",
        });
      }
    });
    setEditRecords(recordsMap);
  }

  function openEditLessonDialog(lesson: Lesson) {
    setEditLessonDialog({ open: true, lesson });
    setEditDate(format(new Date(lesson.date), "yyyy-MM-dd"));
    setEditLessonNumber(lesson.lessonNumber.toString());
    setEditTopic(lesson.topic);
    setEditNotes(lesson.notes || "");
  }

  function updateRecordField(
    studentId: string,
    field: "status" | "grade" | "bonusPoints" | "comment",
    value: string
  ) {
    setEditRecords((prev) => {
      const next = new Map(prev);
      const record = next.get(studentId) || { status: "PRESENT", grade: "", bonusPoints: "", comment: "" };
      next.set(studentId, { ...record, [field]: value });
      return next;
    });
  }

  async function handleCreate(e: React.FormEvent, forceCreate = false) {
    e.preventDefault();
    const formData = new FormData();
    formData.append("groupId", selectedGroup);
    formData.append("date", newDate);
    formData.append("lessonNumber", newLessonNumber);
    formData.append("topic", newTopic);
    if (newSubjectId) formData.append("subjectId", newSubjectId);
    if (newNotes) formData.append("notes", newNotes);
    if (forceCreate) formData.append("forceCreate", "true");

    startTransition(async () => {
      try {
        const result = await createLesson(formData);
        if (result && "warning" in result && result.warning) {
          setWarningDialog({ open: true, message: result.message as string });
        } else {
          setCreateDialogOpen(false);
          setWarningDialog({ open: false, message: "" });
          loadLessons();
        }
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка создания занятия");
      }
    });
  }

  async function handleForceCreate() {
    const formData = new FormData();
    formData.append("groupId", selectedGroup);
    formData.append("date", newDate);
    formData.append("lessonNumber", newLessonNumber);
    formData.append("topic", newTopic);
    if (newSubjectId) formData.append("subjectId", newSubjectId);
    if (newNotes) formData.append("notes", newNotes);
    formData.append("forceCreate", "true");

    startTransition(async () => {
      try {
        await createLesson(formData);
        setCreateDialogOpen(false);
        setWarningDialog({ open: false, message: "" });
        loadLessons();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка создания занятия");
      }
    });
  }

  async function handleSaveAttendance() {
    if (!editingLesson) return;

    const records = Array.from(editRecords.entries()).map(([studentId, data]) => ({
      studentId,
      status: data.status,
      grade: data.grade ? parseInt(data.grade) : null,
      bonusPoints: data.bonusPoints ? parseInt(data.bonusPoints) : null,
      comment: data.comment || null,
    }));

    startTransition(async () => {
      try {
        await updateAttendance(editingLesson.id, records);
        setEditingLesson(null);
        loadLessons();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка сохранения");
      }
    });
  }

  async function handleDelete(lessonId: string) {
    startTransition(async () => {
      try {
        await deleteLesson(lessonId);
        setDeleteConfirm(null);
        loadLessons();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка удаления");
      }
    });
  }

  async function handleSaveLessonDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!editLessonDialog.lesson) return;

    const formData = new FormData();
    formData.append("date", editDate);
    formData.append("lessonNumber", editLessonNumber);
    formData.append("topic", editTopic);
    if (editNotes) formData.append("notes", editNotes);

    startTransition(async () => {
      try {
        await updateLesson(editLessonDialog.lesson!.id, formData);
        setEditLessonDialog({ open: false, lesson: null });
        loadLessons();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка сохранения");
      }
    });
  }

  async function handleExport() {
    if (!selectedGroup) return;

    try {
      const data = await getJournalExport(selectedGroup);

      const rows: string[][] = [];

      const header = ["Студент", ...data.lessons.map((l) => `${l.date} (${l.lessonNumber}п.) ${l.topic}`)];
      rows.push(header);

      for (const student of data.students) {
        const row = [student.name];
        for (const lesson of data.lessons) {
          const record = lesson.records.find((r) => r.studentId === student.id);
          if (record) {
            const status = record.status === "PRESENT" ? "П" : record.status === "ABSENT" ? "Н" : "О";
            const grade = record.grade ? ` (${record.grade})` : "";
            row.push(`${status}${grade}`);
          } else {
            row.push("—");
          }
        }
        rows.push(row);
      }

      const csv = rows.map((r) => r.join(";")).join("\n");
      const BOM = "\uFEFF";
      const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `journal_${data.groupName}_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Ошибка экспорта");
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "PRESENT":
        return <Badge variant="default" className="bg-green-500">Присутствует</Badge>;
      case "ABSENT":
        return <Badge variant="destructive">Отсутствует</Badge>;
      case "LATE":
        return <Badge variant="secondary" className="bg-yellow-500">Опоздал</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Журнал</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!selectedGroup}>
            <Download className="mr-2 h-4 w-4" />
            Экспорт CSV
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} disabled={!selectedGroup}>
                <Plus className="mr-2 h-4 w-4" />
                Новое занятие
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать занятие</DialogTitle>
              <DialogDescription>
                Заполните данные о занятии
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Дата</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lessonNumber">Пара</Label>
                  <Select value={newLessonNumber} onValueChange={setNewLessonNumber}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LESSON_SCHEDULE.map((l) => (
                        <SelectItem key={l.number} value={l.number.toString()}>
                          {getLessonLabel(l.number)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Предмет</Label>
                <Select value={newSubjectId} onValueChange={setNewSubjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите предмет (необязательно)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Без предмета</SelectItem>
                    {subjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subjects.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Нет предметов. <a href="/subjects" className="underline">Добавить</a>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="topic">Тема занятия</Label>
                <Input
                  id="topic"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="Введение в предмет"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Заметки</Label>
                <Textarea
                  id="notes"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Дополнительные заметки..."
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Создание..." : "Создать"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Dialog open={warningDialog.open} onOpenChange={(open) => setWarningDialog({ ...warningDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Внимание</DialogTitle>
          </DialogHeader>
          <p>{warningDialog.message}</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setWarningDialog({ open: false, message: "" })}>
              Отмена
            </Button>
            <Button onClick={handleForceCreate} disabled={isPending}>
              {isPending ? "Создание..." : "Создать всё равно"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editLessonDialog.open} onOpenChange={(open) => setEditLessonDialog({ ...editLessonDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать занятие</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveLessonDetails} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="editDate">Дата</Label>
                <Input
                  id="editDate"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editLessonNumber">Пара</Label>
                <Select value={editLessonNumber} onValueChange={setEditLessonNumber}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LESSON_SCHEDULE.map((l) => (
                      <SelectItem key={l.number} value={l.number.toString()}>
                        {getLessonLabel(l.number)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editTopic">Тема занятия</Label>
              <Input
                id="editTopic"
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editNotes">Заметки</Label>
              <Textarea
                id="editNotes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-4">
        <Label>Группа:</Label>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Выберите группу" />
          </SelectTrigger>
          <SelectContent>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {editingLesson && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>
                Редактирование: {format(new Date(editingLesson.date), "d MMMM yyyy", { locale: ru })},{" "}
                {getLessonLabel(editingLesson.lessonNumber)}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const next = new Map(editRecords);
                    next.forEach((record, key) => {
                      next.set(key, { ...record, status: "PRESENT" });
                    });
                    setEditRecords(next);
                  }}
                >
                  Все присутствуют
                </Button>
                <Button variant="outline" onClick={() => setEditingLesson(null)}>
                  Отмена
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label>Тема: {editingLesson.topic}</Label>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Студент</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Оценка (1-100)</TableHead>
                  <TableHead>Бонус</TableHead>
                  <TableHead>Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => {
                  const record = editRecords.get(s.student.id) || {
                    status: "PRESENT",
                    grade: "",
                    bonusPoints: "",
                    comment: "",
                  };
                  return (
                    <TableRow key={s.student.id}>
                      <TableCell className="font-medium">
                        {s.student.lastName} {s.student.firstName}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={record.status}
                          onValueChange={(v) => updateRecordField(s.student.id, "status", v)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PRESENT">Присутствует</SelectItem>
                            <SelectItem value="ABSENT">Отсутствует</SelectItem>
                            <SelectItem value="LATE">Опоздал</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          className="w-20"
                          value={record.grade}
                          onChange={(e) => updateRecordField(s.student.id, "grade", e.target.value)}
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          className="w-20"
                          value={record.bonusPoints}
                          onChange={(e) => updateRecordField(s.student.id, "bonusPoints", e.target.value)}
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-48"
                          value={record.comment}
                          onChange={(e) => updateRecordField(s.student.id, "comment", e.target.value)}
                          placeholder="Комментарий"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleSaveAttendance} disabled={isPending}>
                <Save className="mr-2 h-4 w-4" />
                {isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Занятия
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lessons.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {selectedGroup ? "Занятий нет. Создайте первое занятие." : "Выберите группу"}
            </p>
          ) : (
            <div className="space-y-2">
              {lessons.map((lesson) => (
                <Card key={lesson.id} className="overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
                    onClick={() => setExpandedLesson(expandedLesson === lesson.id ? null : lesson.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="font-medium">
                          {format(new Date(lesson.date), "d MMMM yyyy", { locale: ru })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {getLessonLabel(lesson.lessonNumber)}
                        </div>
                      </div>
                      <div>
                        <div className="font-medium">{lesson.topic}</div>
                        {lesson.subject && (
                          <Badge variant="secondary" className="mt-1">
                            {lesson.subject.name}
                          </Badge>
                        )}
                        {lesson.teacher && (
                          <div className="text-sm text-muted-foreground">
                            Преподаватель: {lesson.teacher.name}
                          </div>
                        )}
                        {lesson.notes && (
                          <div className="text-sm text-muted-foreground">{lesson.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {lesson.records.filter((r) => r.status === "PRESENT").length} / {lesson.records.length}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(lesson);
                        }}
                      >
                        Оценки
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditLessonDialog(lesson);
                        }}
                      >
                        Редактировать
                      </Button>
                      {deleteConfirm === lesson.id ? (
                        <div className="flex gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(lesson.id);
                            }}
                            disabled={isPending}
                          >
                            Да
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(null);
                            }}
                          >
                            Нет
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirm(lesson.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      {expandedLesson === lesson.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                  {expandedLesson === lesson.id && (
                    <div className="border-t p-4 bg-muted/20">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Студент</TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Оценка</TableHead>
                            <TableHead>Бонус</TableHead>
                            <TableHead>Комментарий</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lesson.records.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell>
                                {record.student.lastName} {record.student.firstName}
                              </TableCell>
                              <TableCell>{getStatusBadge(record.status)}</TableCell>
                              <TableCell>{record.grade || "—"}</TableCell>
                              <TableCell>{record.bonusPoints || "—"}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {record.comment || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
