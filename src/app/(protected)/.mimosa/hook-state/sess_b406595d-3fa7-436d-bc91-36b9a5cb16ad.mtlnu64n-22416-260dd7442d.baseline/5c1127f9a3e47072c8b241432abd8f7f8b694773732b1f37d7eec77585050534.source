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
import { Plus, Pencil, Trash2, Users, Copy, Check } from "lucide-react";

interface Teacher {
  id: string;
  name: string;
  email: string;
  homeroomOf: { id: string; name: string }[];
  teacherGroups: { group: { id: string; name: string } }[];
  _count: { lessonsCreated: number };
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("TEACHER");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");

  const [createdUser, setCreatedUser] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const loadTeachers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/teachers");
      const data = await response.json();
      setTeachers(data);
    } catch {
      console.error("Failed to load teachers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeachers();
  }, [loadTeachers]);

  function openCreate() {
    setNewName("");
    setNewEmail("");
    setNewRole("TEACHER");
    setCreatedUser(null);
    setCreateDialogOpen(true);
  }

  function openEdit(teacher: Teacher) {
    setEditingTeacher(teacher);
    setEditName(teacher.name);
    setEditEmail(teacher.email);
    setEditDialogOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName, email: newEmail, role: newRole }),
        });

        const data = await response.json();
        if (!response.ok) {
          alert(data.error || "Ошибка создания");
          return;
        }

        setCreatedUser(data);
        loadTeachers();
      } catch {
        alert("Ошибка создания преподавателя");
      }
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTeacher) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/teachers/${editingTeacher.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: editName, email: editEmail }),
        });

        if (!response.ok) {
          const data = await response.json();
          alert(data.error || "Ошибка обновления");
          return;
        }

        setEditDialogOpen(false);
        loadTeachers();
      } catch {
        alert("Ошибка обновления преподавателя");
      }
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/teachers/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const data = await response.json();
          alert(data.error || "Ошибка удаления");
          return;
        }

        setDeleteConfirm(null);
        loadTeachers();
      } catch {
        alert("Ошибка удаления преподавателя");
      }
    });
  }

  function copyPassword() {
    if (createdUser?.password) {
      navigator.clipboard.writeText(createdUser.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const filteredTeachers = teachers.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Преподаватели</h1>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Добавить преподавателя
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый преподаватель</DialogTitle>
              <DialogDescription>
                Создайте аккаунт преподавателя. Временный пароль будет показан один раз.
              </DialogDescription>
            </DialogHeader>
            {createdUser ? (
              <div className="space-y-4 p-4 bg-green-50 rounded-lg">
                <p className="font-medium text-green-800">Преподаватель создан!</p>
                <div>
                  <Label className="text-green-700">Имя</Label>
                  <p className="font-medium">{createdUser.name}</p>
                </div>
                <div>
                  <Label className="text-green-700">Email</Label>
                  <p className="font-medium">{createdUser.email}</p>
                </div>
                <div>
                  <Label className="text-green-700">Временный пароль</Label>
                  <div className="flex items-center gap-2">
                    <code className="p-2 bg-white rounded font-mono">{createdUser.password}</code>
                    <Button size="sm" variant="outline" onClick={copyPassword}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-green-700">
                  Пользователь будет вынужден сменить пароль при первом входе.
                </p>
                <Button onClick={() => setCreateDialogOpen(false)}>Закрыть</Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">ФИО</Label>
                  <Input
                    id="name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Иванов Иван Иванович"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="ivanov@csu.ru"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Роль</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TEACHER">Преподаватель</SelectItem>
                      <SelectItem value="ADMIN">Администратор</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Создание..." : "Создать"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Поиск по имени или email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Badge variant="outline">{filteredTeachers.length} преподавателей</Badge>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать преподавателя</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName">ФИО</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Список преподавателей
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ФИО</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Кл. руководитель</TableHead>
                <TableHead>Доп. группы</TableHead>
                <TableHead>Занятий</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTeachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell className="font-medium">{teacher.name}</TableCell>
                  <TableCell className="text-muted-foreground">{teacher.email}</TableCell>
                  <TableCell>
                    {teacher.homeroomOf.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {teacher.homeroomOf.map((g) => (
                          <Badge key={g.id} variant="default">{g.name}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {teacher.teacherGroups.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {teacher.teacherGroups.map((tg) => (
                          <Badge key={tg.group.id} variant="secondary">{tg.group.name}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>{teacher._count.lessonsCreated}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(teacher)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {deleteConfirm === teacher.id ? (
                        <div className="flex gap-1">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(teacher.id)}
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
                          onClick={() => setDeleteConfirm(teacher.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTeachers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "Преподаватели не найдены" : "Нет преподавателей"}
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
