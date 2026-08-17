"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, GraduationCap } from "lucide-react";
import { getGroup } from "@/app/actions/groups";
import { getStudents } from "@/app/actions/students";

interface GroupInfo {
  id: string;
  name: string;
  description: string | null;
  homeroomTeacherId: string | null;
  homeroomTeacher: { id: string; name: string } | null;
  additionalTeachers: { teacher: { id: string; name: string } }[];
  students: { student: { id: string; firstName: string; lastName: string } }[];
}

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  user?: { id: string; email: string } | null;
}

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const groupId = params.id;

  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!groupId) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const groupData = await getGroup(groupId);
      setGroup(groupData);
      const studentsData = await getStudents(groupId);
      setStudents(studentsData as StudentRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" asChild>
          <Link href="/groups">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Назад к группам
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {error === "Forbidden"
                ? "У вас нет доступа к этой группе"
                : error === "Group not found"
                ? "Группа не найдена"
                : "Не удалось загрузить группу"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" asChild>
        <Link href="/groups">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Назад к группам
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl">{group.name}</CardTitle>
              {group.description && (
                <p className="text-muted-foreground text-sm">{group.description}</p>
              )}
            </div>
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3.5 w-3.5" />
              {group.students.length} студ.
            </Badge>
          </div>
          <div className="flex flex-wrap gap-4 pt-2 text-sm">
            <div>
              <span className="text-muted-foreground">Кл. руководитель: </span>
              {group.homeroomTeacher ? (
                <span className="font-medium">{group.homeroomTeacher.name}</span>
              ) : (
                <span className="text-muted-foreground">Не назначен</span>
              )}
            </div>
            {group.additionalTeachers.length > 0 && (
              <div>
                <span className="text-muted-foreground">Преподаватели: </span>
                {group.additionalTeachers.map((at) => at.teacher.name).join(", ")}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5" />
            Студенты группы
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              В группе нет студентов
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>№</TableHead>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Телефон</TableHead>
                  <TableHead>Личный кабинет</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student, i) => (
                  <TableRow key={student.id}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">
                      {student.lastName} {student.firstName}
                    </TableCell>
                    <TableCell>{student.email || "—"}</TableCell>
                    <TableCell>{student.phone || "—"}</TableCell>
                    <TableCell>
                      {student.user ? (
                        <Badge variant="default" className="bg-green-600">Есть</Badge>
                      ) : (
                        <Badge variant="outline">Нет</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
