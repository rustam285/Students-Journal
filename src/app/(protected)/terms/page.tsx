"use client";

import { useState, useEffect, useTransition } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Calendar, Check, GraduationCap, ArrowRight } from "lucide-react";
import {
  getTerms,
  createTerm,
  updateTerm,
  deleteTerm,
  setActiveTerm,
} from "@/app/actions/terms";
import {
  getPromotionPreview,
  setGroupCourse,
  promoteAcademicYear,
} from "@/app/actions/academic-year";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface Term {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  _count: { lessons: number };
}

interface PromoGroup {
  id: string;
  name: string;
  course: number | null;
  studentsCount: number;
  homeroomTeacher: string | null;
}

export default function TermsPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [promoGroups, setPromoGroups] = useState<PromoGroup[]>([]);
  const [finalCourse, setFinalCourse] = useState<string>("4");
  const [promoteConfirmOpen, setPromoteConfirmOpen] = useState(false);

  useEffect(() => {
    loadTerms();
    loadPromotion();
  }, []);

  async function loadTerms() {
    try {
      const data = await getTerms();
      setTerms(data as Term[]);
    } catch (error) {
      console.error("Failed to load terms:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPromotion() {
    try {
      const data = await getPromotionPreview();
      setPromoGroups(data as PromoGroup[]);
    } catch (error) {
      console.error("Failed to load promotion preview:", error);
    }
  }

  async function handleSetCourse(groupId: string, course: string) {
    startTransition(async () => {
      try {
        await setGroupCourse(groupId, Number(course));
        loadPromotion();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка сохранения курса");
      }
    });
  }

  async function handlePromote() {
    startTransition(async () => {
      try {
        const result = await promoteAcademicYear(Number(finalCourse));
        setPromoteConfirmOpen(false);
        alert(
          `Готово! Переведено групп: ${result.promotedCount}, выпущено: ${result.graduatedCount} (${result.graduatedStudents} студентов отчислены)`
        );
        loadPromotion();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка перевода");
      }
    });
  }

  function openCreate() {
    setEditingTerm(null);
    setName("");
    setStartDate("");
    setEndDate("");
    setDialogOpen(true);
  }

  function openEdit(term: Term) {
    setEditingTerm(term);
    setName(term.name);
    setStartDate(format(new Date(term.startDate), "yyyy-MM-dd"));
    setEndDate(format(new Date(term.endDate), "yyyy-MM-dd"));
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", name);
    formData.append("startDate", startDate);
    formData.append("endDate", endDate);

    startTransition(async () => {
      try {
        if (editingTerm) {
          await updateTerm(editingTerm.id, formData);
        } else {
          await createTerm(formData);
        }
        setDialogOpen(false);
        loadTerms();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка сохранения");
      }
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteTerm(id);
        setDeleteConfirm(null);
        loadTerms();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка удаления");
      }
    });
  }

  async function handleSetActive(id: string) {
    startTransition(async () => {
      try {
        await setActiveTerm(id);
        loadTerms();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Ошибка");
      }
    });
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Учебные периоды</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить период
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTerm ? "Редактировать период" : "Новый период"}</DialogTitle>
              <DialogDescription>
                {editingTerm ? "Измените данные периода" : "Создайте учебный период"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="2025-2026 Осень"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Дата начала</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Дата окончания</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Сохранение..." : editingTerm ? "Сохранить" : "Создать"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Список периодов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Начало</TableHead>
                <TableHead>Окончание</TableHead>
                <TableHead>Занятий</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terms.map((term) => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium">{term.name}</TableCell>
                  <TableCell>
                    {format(new Date(term.startDate), "d MMM yyyy", { locale: ru })}
                  </TableCell>
                  <TableCell>
                    {format(new Date(term.endDate), "d MMM yyyy", { locale: ru })}
                  </TableCell>
                  <TableCell>{term._count.lessons}</TableCell>
                  <TableCell>
                    {term.isActive ? (
                      <Badge className="bg-green-500">Активный</Badge>
                    ) : (
                      <Badge variant="outline">Неактивный</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {!term.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetActive(term.id)}
                          disabled={isPending}
                          title="Сделать активным"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEdit(term)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {deleteConfirm === term.id ? (
                        <div className="flex gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(term.id)}
                            disabled={isPending}
                          >
                            Да
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Нет
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(term.id)}
                          disabled={term._count.lessons > 0}
                          title={term._count.lessons > 0 ? "Нельзя удалить период с занятиями" : "Удалить"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {terms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Нет учебных периодов
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Переход на новый учебный год
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Переводит все группы на следующий курс. Группы выпускного курса скрываются из
            системы вместе со студентами: их учётные записи удаляются (вход закрывается),
            но история занятий и оценок сохраняется. Названия групп обновите вручную при
            необходимости. Не забудьте создать и активировать новый учебный период выше.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Label>Выпускной курс:</Label>
            <Select value={finalCourse} onValueChange={setFinalCourse}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((c) => (
                  <SelectItem key={c} value={c.toString()}>
                    {c} курс
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Группа</TableHead>
                <TableHead>Куратор</TableHead>
                <TableHead>Студентов</TableHead>
                <TableHead>Курс</TableHead>
                <TableHead>При переводе</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promoGroups.map((group) => {
                const graduationCourse = Number(finalCourse);
                const graduating =
                  group.course !== null && group.course >= graduationCourse;
                return (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>{group.homeroomTeacher || "—"}</TableCell>
                    <TableCell>{group.studentsCount}</TableCell>
                    <TableCell>
                      {group.course !== null ? (
                        <Badge variant="outline">{group.course} курс</Badge>
                      ) : (
                        <Select
                          value={undefined}
                          onValueChange={(v) => handleSetCourse(group.id, v)}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue placeholder="Укажите курс" />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6].map((c) => (
                              <SelectItem key={c} value={c.toString()}>
                                {c} курс
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {group.course === null ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : graduating ? (
                        <Badge variant="destructive">
                          Выпуск ({group.studentsCount} студ.)
                        </Badge>
                      ) : (
                        <span className="flex items-center gap-1 text-sm">
                          <ArrowRight className="h-3 w-3" />
                          {group.course + 1} курс
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {promoGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Нет активных групп
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <Dialog open={promoteConfirmOpen} onOpenChange={setPromoteConfirmOpen}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={isPending || promoGroups.some((g) => g.course === null)}
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                Перевести на новый учебный год
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Подтвердите переход на новый учебный год</DialogTitle>
                <DialogDescription>
                  Операцию нельзя отменить. Выпущенные студенты потеряют доступ к системе
                  (их учётные записи будут удалены), история занятий и оценок сохранится.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 text-sm">
                {promoGroups
                  .filter((g) => g.course !== null)
                  .map((g) => (
                    <div key={g.id} className="flex items-center justify-between">
                      <span>{g.name}</span>
                      {g.course !== null && g.course >= Number(finalCourse) ? (
                        <Badge variant="destructive">
                          Выпуск ({g.studentsCount} студ.)
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          → {(g.course ?? 0) + 1} курс
                        </Badge>
                      )}
                    </div>
                  ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPromoteConfirmOpen(false)}>
                  Отмена
                </Button>
                <Button variant="destructive" onClick={handlePromote} disabled={isPending}>
                  {isPending ? "Выполняется..." : "Перевести"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
