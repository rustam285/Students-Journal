"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { BookOpen, MessageSquare } from "lucide-react";
import { getMyRecords } from "@/app/actions/my-records";
import { getLessonLabel } from "@/lib/constants";

interface Record {
  id: string;
  date: string;
  lessonNumber: number;
  topic: string;
  groupName: string;
  subjectName: string | null;
  status: string;
  grade: number | null;
  comment: string | null;
}

export default function MyRecordsPage() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterGroup, setFilterGroup] = useState<string>("all");

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    try {
      const data = await getMyRecords();
      setRecords(data);
    } catch (error) {
      console.error("Failed to load records:", error);
    } finally {
      setLoading(false);
    }
  }

  const groups = Array.from(new Set(records.map((r) => r.groupName)));

  const filteredRecords = records.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterGroup !== "all" && r.groupName !== filterGroup) return false;
    return true;
  });

  const stats = {
    total: records.length,
    present: records.filter((r) => r.status === "PRESENT").length,
    absent: records.filter((r) => r.status === "ABSENT").length,
    late: records.filter((r) => r.status === "LATE").length,
    avgGrade: records.filter((r) => r.grade).length > 0
      ? Math.round(records.reduce((sum, r) => sum + (r.grade || 0), 0) / records.filter((r) => r.grade).length * 10) / 10
      : null,
  };

  function getStatusBadge(status: string) {
    switch (status) {
      case "PRESENT":
        return <Badge className="bg-green-500">Присутствовал</Badge>;
      case "ABSENT":
        return <Badge variant="destructive">Отсутствовал</Badge>;
      case "LATE":
        return <Badge className="bg-yellow-500">Опоздал</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Моя успеваемость</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Всего занятий</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Присутствовал</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.present}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Отсутствовал</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.absent}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Средняя оценка</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgGrade || "—"}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <Label>Группа:</Label>
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>Статус:</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="PRESENT">Присутствовал</SelectItem>
                  <SelectItem value="ABSENT">Отсутствовал</SelectItem>
                  <SelectItem value="LATE">Опоздал</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Записи ({filteredRecords.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredRecords.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет записей</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Группа</TableHead>
                  <TableHead>Тема</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Оценка</TableHead>
                  <TableHead>Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(record.date).toLocaleDateString("ru-RU")}
                      <div className="text-xs text-muted-foreground">
                        {getLessonLabel(record.lessonNumber)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{record.groupName}</Badge>
                    </TableCell>
                    <TableCell>
                      <div>{record.topic}</div>
                      {record.subjectName && (
                        <Badge variant="secondary" className="mt-1">{record.subjectName}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                    <TableCell>
                      {record.grade ? (
                        <Badge variant="default">{record.grade}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {record.comment ? (
                        <div className="flex items-start gap-1 max-w-[200px]">
                          <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                          <span className="text-sm">{record.comment}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
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
