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
import { Plus, Pencil, Trash2, GraduationCap, UserPlus, Copy, Check } from "lucide-react";
import {
  getStudents,
  createStudent,
  updateStudent,
  deleteStudent,
} from "@/app/actions/students";
import { getTeacherGroups } from "@/app/actions/groups";
import { useSession } from "next-auth/react";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  groups: { group: { id: string; name: string } }[];
  user?: { id: string; email: string } | null;
}

interface Group {
  id: string;
  name: string;
}

export default function StudentsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filterGroup, setFilterGroup] = useState<string>("all");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [groupId, setGroupId] = useState<string>("");
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [createdAccount, setCreatedAccount] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ email: string; password: string; name: string }[]>([]);

  const loadStudents = useCallback(async () => {
    try {
      const data = await getStudents(filterGroup === "all" ? undefined : filterGroup);
      setStudents(data as Student[]);
    } catch (error) {
      console.error("Failed to load students:", error);
    } finally {
      setLoading(false);
    }
  }, [filterGroup]);

  useEffect(() => {
    loadStudents();
    if (isAdmin) loadGroups();
  }, [isAdmin, filterGroup, loadStudents]);

  async function loadGroups() {
    try {
      const data = await getTeacherGroups();
      setGroups(data);
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  }

  function openCreate() {
    setEditingStudent(null);
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setGroupId("");
    setDialogOpen(true);
  }

  function openEdit(student: Student) {
    setEditingStudent(student);
    setFirstName(student.firstName);
    setLastName(student.lastName);
    setEmail(student.email || "");
    setPhone(student.phone || "");
    setGroupId("");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.append("firstName", firstName);
    formData.append("lastName", lastName);
    if (email) formData.append("email", email);
    if (phone) formData.append("phone", phone);
    if (groupId && !editingStudent) formData.append("groupId", groupId);

    startTransition(async () => {
      try {
        if (editingStudent) {
          await updateStudent(editingStudent.id, formData);
        } else {
          await createStudent(formData);
        }
        setDialogOpen(false);
        loadStudents();
      } catch (error) {
        console.error("Failed to save student:", error);
      }
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteStudent(id);
        setDeleteConfirm(null);
        loadStudents();
      } catch (error) {
        console.error("Failed to delete student:", error);
      }
    });
  }

  async function handleCreateAccount(studentId: string) {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/students/${studentId}/create-account`, {
          method: "POST",
        });

        const data = await response.json();
        if (!response.ok) {
          alert(data.error || "Ошибка создания аккаунта");
          return;
        }

        setCreatedAccount(data);
        setAccountDialogOpen(true);
        loadStudents();
      } catch {
        alert("Ошибка создания аккаунта");
      }
    });
  }

  function copyPassword() {
    if (createdAccount?.password) {
      navigator.clipboard.writeText(createdAccount.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function toggleStudentSelection(studentId: string) {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  }

  function toggleAllStudents() {
    const studentsWithoutAccount = students.filter((s) => !s.user);
    if (selectedStudents.size === studentsWithoutAccount.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(studentsWithoutAccount.map((s) => s.id)));
    }
  }

  async function handleBulkCreate() {
    const studentsToCreate = Array.from(selectedStudents);
    if (studentsToCreate.length === 0) return;

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/students/bulk-create-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIds: studentsToCreate }),
        });

        const data = await response.json();
        if (!response.ok) {
          alert(data.error || "Ошибка создания аккаунтов");
          return;
        }

        setBulkResults(data.accounts);
        setBulkDialogOpen(true);
        setSelectedStudents(new Set());
        loadStudents();
      } catch {
        alert("Ошибка создания аккаунтов");
      }
    });
  }

  function exportBulkResults() {
    if (bulkResults.length === 0) return;

    const csv = ["email;password"];
    bulkResults.forEach((r) => {
      csv.push(`${r.email};${r.password}`);
    });

    const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "student_accounts.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Студенты</h1>
        {isAdmin && (
          <div className="flex gap-2">
            {selectedStudents.size > 0 && (
              <Button variant="secondary" onClick={handleBulkCreate} disabled={isPending}>
                <UserPlus className="mr-2 h-4 w-4" />
                Создать кабинеты ({selectedStudents.size})
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Добавить студента
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingStudent ? "Редактировать студента" : "Новый студент"}</DialogTitle>
                <DialogDescription>
                  {editingStudent ? "Измените данные студента" : "Заполните данные для создания студента"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Фамилия</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Иванов"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Имя</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Иван"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ivanov@student.csu.ru"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+7(900)123-45-67"
                  />
                </div>
                {!editingStudent && (
                  <div className="space-y-2">
                    <Label htmlFor="group">Группа</Label>
                    <Select value={groupId} onValueChange={setGroupId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите группу" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Без группы</SelectItem>
                        {groups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Сохранение..." : editingStudent ? "Сохранить" : "Создать"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-4">
          <Label>Фильтр по группе:</Label>
          <Select value={filterGroup} onValueChange={setFilterGroup}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
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
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            Список студентов
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {isAdmin && (
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={selectedStudents.size > 0 && selectedStudents.size === students.filter((s) => !s.user).length}
                      onChange={toggleAllStudents}
                      className="h-4 w-4"
                    />
                  </TableHead>
                )}
                <TableHead>ФИО</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Группы</TableHead>
                <TableHead>Личный кабинет</TableHead>
                {isAdmin && <TableHead className="text-right">Действия</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  {isAdmin && (
                    <TableCell>
                      {!student.user && (
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.id)}
                          onChange={() => toggleStudentSelection(student.id)}
                          className="h-4 w-4"
                        />
                      )}
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    {student.lastName} {student.firstName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {student.email || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {student.phone || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {student.groups.map((sg) => (
                        <Badge key={sg.group.id} variant="secondary">
                          {sg.group.name}
                        </Badge>
                      ))}
                      {student.groups.length === 0 && (
                        <Badge variant="outline">Нет групп</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {student.user ? (
                      <Badge variant="default">Есть</Badge>
                    ) : isAdmin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateAccount(student.id)}
                        disabled={isPending}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        Создать
                      </Button>
                    ) : (
                      <Badge variant="outline">Нет</Badge>
                    )}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(student)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {deleteConfirm === student.id ? (
                          <div className="flex gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(student.id)}
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
                            onClick={() => setDeleteConfirm(student.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 7 : 5} className="text-center py-8 text-muted-foreground">
                    Студенты не найдены
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Личный кабинет создан!</DialogTitle>
            <DialogDescription>
              Скопируйте временный пароль и передайте студенту
            </DialogDescription>
          </DialogHeader>
          {createdAccount && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Имя</Label>
                <p className="font-medium">{createdAccount.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email (логин)</Label>
                <p className="font-medium">{createdAccount.email}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Временный пароль</Label>
                <div className="flex items-center gap-2">
                  <code className="p-2 bg-muted rounded font-mono">{createdAccount.password}</code>
                  <Button size="sm" variant="outline" onClick={copyPassword}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Студент будет вынужден сменить пароль при первом входе.
              </p>
              <Button onClick={() => setAccountDialogOpen(false)}>Закрыть</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Массовое создание аккаунтов</DialogTitle>
            <DialogDescription>
              Создано аккаунтов: {bulkResults.length}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Пароль</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bulkResults.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="font-mono text-sm">{r.email}</TableCell>
                      <TableCell className="font-mono text-sm">{r.password}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportBulkResults}>
                Скачать CSV
              </Button>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                Закрыть
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
