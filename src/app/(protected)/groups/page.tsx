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
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  UserPlus,
  Check,
  X,
  Send,
} from "lucide-react";
import {
  getGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  getTeachers,
  addTeacherToGroup,
  removeTeacherFromGroup,
} from "@/app/actions/groups";
import {
  getGroupAccessRequests,
  getMyGroupAccessRequests,
  requestGroupAccess,
  approveGroupAccessRequest,
  rejectGroupAccessRequest,
} from "@/app/actions/group-requests";
import { useSession } from "next-auth/react";

interface Group {
  id: string;
  name: string;
  description: string | null;
  homeroomTeacherId: string | null;
  homeroomTeacher: { id: string; name: string } | null;
  additionalTeachers: { teacher: { id: string; name: string } }[];
  students: { student: { id: string; firstName: string; lastName: string } }[];
}

interface Teacher {
  id: string;
  name: string;
  email: string;
}

interface AccessRequest {
  id: string;
  teacherId: string;
  groupId: string;
  status: string;
  teacher: { id: string; name: string; email: string };
  group: { id: string; name: string };
}

export default function GroupsPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const isTeacher = session?.user?.role === "TEACHER";

  const [groups, setGroups] = useState<Group[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [myRequests, setMyRequests] = useState<{ id: string; groupId: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [teacherDialogOpen, setTeacherDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [homeroomTeacherId, setHomeroomTeacherId] = useState<string>("");
  const [newTeacherId, setNewTeacherId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [accessFilter, setAccessFilter] = useState<"all" | "hasAccess" | "noAccess">("all");

  useEffect(() => {
    loadGroups();
    if (isAdmin) {
      loadTeachers();
      loadAccessRequests();
    }
    if (isTeacher) loadMyRequests();
  }, [isAdmin, isTeacher]);

  async function loadGroups() {
    try {
      const data = await getGroups();
      setGroups(data as Group[]);
    } catch (error) {
      console.error("Failed to load groups:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadTeachers() {
    try {
      const data = await getTeachers();
      setTeachers(data);
    } catch (error) {
      console.error("Failed to load teachers:", error);
    }
  }

  async function loadAccessRequests() {
    try {
      const data = await getGroupAccessRequests();
      setAccessRequests(data as AccessRequest[]);
    } catch (error) {
      console.error("Failed to load access requests:", error);
    }
  }

  async function loadMyRequests() {
    try {
      const data = await getMyGroupAccessRequests();
      setMyRequests(data);
    } catch (error) {
      console.error("Failed to load my requests:", error);
    }
  }

  function openCreate() {
    setEditingGroup(null);
    setName("");
    setDescription("");
    setHomeroomTeacherId("");
    setDialogOpen(true);
  }

  function openEdit(group: Group) {
    setEditingGroup(group);
    setName(group.name);
    setDescription(group.description || "");
    setHomeroomTeacherId(group.homeroomTeacherId || "");
    setDialogOpen(true);
  }

  function openTeacherDialog(groupId: string) {
    setSelectedGroup(groupId);
    setNewTeacherId("");
    setTeacherDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", name);
    formData.append("description", description);
    if (homeroomTeacherId) formData.append("homeroomTeacherId", homeroomTeacherId);

    startTransition(async () => {
      try {
        if (editingGroup) {
          await updateGroup(editingGroup.id, formData);
        } else {
          await createGroup(formData);
        }
        setDialogOpen(false);
        loadGroups();
      } catch (error) {
        console.error("Failed to save group:", error);
      }
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteGroup(id);
        setDeleteConfirm(null);
        loadGroups();
      } catch (error) {
        console.error("Failed to delete group:", error);
      }
    });
  }

  async function handleAddTeacher() {
    if (!selectedGroup || !newTeacherId) return;
    startTransition(async () => {
      try {
        await addTeacherToGroup(selectedGroup, newTeacherId);
        setTeacherDialogOpen(false);
        loadGroups();
      } catch (error) {
        console.error("Failed to add teacher:", error);
      }
    });
  }

  async function handleRemoveTeacher(groupId: string, teacherId: string) {
    startTransition(async () => {
      try {
        await removeTeacherFromGroup(groupId, teacherId);
        loadGroups();
      } catch (error) {
        console.error("Failed to remove teacher:", error);
      }
    });
  }

  async function handleRequestAccess(groupId: string) {
    startTransition(async () => {
      try {
        await requestGroupAccess(groupId);
        loadMyRequests();
      } catch (error) {
        console.error("Failed to request access:", error);
      }
    });
  }

  async function handleApproveRequest(requestId: string) {
    startTransition(async () => {
      try {
        await approveGroupAccessRequest(requestId);
        loadAccessRequests();
        loadGroups();
      } catch (error) {
        console.error("Failed to approve request:", error);
      }
    });
  }

  async function handleRejectRequest(requestId: string) {
    startTransition(async () => {
      try {
        await rejectGroupAccessRequest(requestId);
        loadAccessRequests();
      } catch (error) {
        console.error("Failed to reject request:", error);
      }
    });
  }

  function hasAccessToGroup(group: Group): boolean {
    if (!session?.user) return false;
    if (group.homeroomTeacherId === session.user.id) return true;
    return group.additionalTeachers.some((t) => t.teacher.id === session.user.id);
  }

  function getMyRequestStatus(groupId: string): string | null {
    const req = myRequests.find((r) => r.groupId === groupId && r.status === "PENDING");
    return req?.status || null;
  }

  const filteredGroups = groups.filter((group) => {
    const matchesSearch = group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (group.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    if (!isTeacher) return matchesSearch;

    const hasAccess = hasAccessToGroup(group);
    if (accessFilter === "hasAccess") return matchesSearch && hasAccess;
    if (accessFilter === "noAccess") return matchesSearch && !hasAccess;
    return matchesSearch;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Группы</h1>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Добавить группу
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingGroup ? "Редактировать группу" : "Новая группа"}</DialogTitle>
                <DialogDescription>
                  {editingGroup ? "Измените данные группы" : "Заполните данные для создания группы"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Название</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ТФИ-301"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Технологии будущего, 3 курс"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="teacher">Классный руководитель</Label>
                  <Select value={homeroomTeacherId} onValueChange={setHomeroomTeacherId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите преподавателя" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Не назначен</SelectItem>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Сохранение..." : editingGroup ? "Сохранить" : "Создать"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isAdmin && accessRequests.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800 flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Запросы на доступ ({accessRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {accessRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border"
                >
                  <div>
                    <span className="font-medium">{req.teacher.name}</span>
                    <span className="text-muted-foreground"> запрашивает доступ к </span>
                    <Badge variant="secondary">{req.group.name}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApproveRequest(req.id)}
                      disabled={isPending}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Одобрить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectRequest(req.id)}
                      disabled={isPending}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Отклонить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={teacherDialogOpen} onOpenChange={setTeacherDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить преподавателя в группу</DialogTitle>
            <DialogDescription>
              Преподаватель сможет вести журнал и отмечать посещаемость в этой группе
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Преподаватель</Label>
              <Select value={newTeacherId} onValueChange={setNewTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите преподавателя" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button onClick={handleAddTeacher} disabled={!newTeacherId || isPending}>
                {isPending ? "Добавление..." : "Добавить"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Input
            placeholder="Поиск по названию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {isTeacher && (
          <div className="flex gap-2">
            <Button
              variant={accessFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setAccessFilter("all")}
            >
              Все
            </Button>
            <Button
              variant={accessFilter === "hasAccess" ? "default" : "outline"}
              size="sm"
              onClick={() => setAccessFilter("hasAccess")}
            >
              Мои группы
            </Button>
            <Button
              variant={accessFilter === "noAccess" ? "default" : "outline"}
              size="sm"
              onClick={() => setAccessFilter("noAccess")}
            >
              Нет доступа
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Список групп
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead>Кл. руководитель</TableHead>
                <TableHead>Преподаватели</TableHead>
                <TableHead>Студентов</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-medium">{group.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {group.description || "—"}
                  </TableCell>
                  <TableCell>
                    {group.homeroomTeacher ? (
                      <Badge variant="secondary">{group.homeroomTeacher.name}</Badge>
                    ) : (
                      <Badge variant="outline">Не назначен</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {group.additionalTeachers.map((at) => (
                        <Badge key={at.teacher.id} variant="outline" className="gap-1">
                          {at.teacher.name}
                          {isAdmin && (
                            <button
                              onClick={() => handleRemoveTeacher(group.id, at.teacher.id)}
                              className="ml-1 hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                      {group.additionalTeachers.length === 0 && (
                        <span className="text-muted-foreground text-sm">Нет</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{group.students.length}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openTeacherDialog(group.id)}
                            title="Добавить преподавателя"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(group)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {deleteConfirm === group.id ? (
                            <div className="flex gap-1">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(group.id)}
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
                              onClick={() => setDeleteConfirm(group.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                      {isTeacher && !hasAccessToGroup(group) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRequestAccess(group.id)}
                          disabled={!!getMyRequestStatus(group.id) || isPending}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          {getMyRequestStatus(group.id) ? "Запрошено" : "Запросить доступ"}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredGroups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {groups.length === 0 ? "Группы не найдены" : "Нет групп по заданным фильтрам"}
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
