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
import { Plus, Pencil, Trash2, Calendar, Check } from "lucide-react";
import {
  getTerms,
  createTerm,
  updateTerm,
  deleteTerm,
  setActiveTerm,
} from "@/app/actions/terms";
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

  useEffect(() => {
    loadTerms();
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Учебные периоды</h1>
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
              <div className="grid grid-cols-2 gap-4">
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
    </div>
  );
}
