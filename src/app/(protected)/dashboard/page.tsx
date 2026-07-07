"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Users, GraduationCap, BookOpen, TrendingUp, Calendar } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  getAttendanceStats,
  getGradeDynamics,
} from "@/app/actions/stats";

interface DashboardStats {
  groups: number;
  students: number;
  lessons: number;
  records: number;
}

type Period = "day" | "week" | "month" | "year" | "custom";

const PERIOD_LABELS: Record<Period, string> = {
  day: "Сегодня",
  week: "Эта неделя",
  month: "Этот месяц",
  year: "Этот год",
  custom: "Свой период",
};

const COLORS = ["#22c55e", "#ef4444", "#eab308"];

const STORAGE_KEY = "dashboard-period";

function loadPeriodFromStorage(): { period: Period; startDate: string; endDate: string } {
  if (typeof window === "undefined") {
    return { period: "month", startDate: "", endDate: "" };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return { period: "month", startDate: "", endDate: "" };
}

function savePeriodToStorage(period: Period, startDate: string, endDate: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ period, startDate, endDate }));
  } catch {}
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [attendanceData, setAttendanceData] = useState<{ name: string; PRESENT: number; ABSENT: number; LATE: number; total: number }[]>([]);
  const [gradeData, setGradeData] = useState<{ date: string; grade: number | null }[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ groups: 0, students: 0, lessons: 0, records: 0 });
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = loadPeriodFromStorage();
    setPeriod(saved.period);
    setStartDate(saved.startDate);
    setEndDate(saved.endDate);
  }, []);

  useEffect(() => {
    savePeriodToStorage(period, startDate, endDate);
  }, [period, startDate, endDate]);

  const loadData = useCallback(async () => {
    try {
      const [attendance, grades] = await Promise.all([
        getAttendanceStats(period, startDate, endDate),
        getGradeDynamics(period, startDate, endDate),
      ]);

      setAttendanceData(attendance);
      setGradeData(grades);
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate]);

  useEffect(() => {
    loadDashboardStats();
    loadData();
  }, [loadData]);

  async function loadDashboardStats() {
    try {
      const response = await fetch("/api/dashboard-stats");
      const data = await response.json();
      setStats(data.stats);
      setUserName(data.userName);
    } catch (error) {
      console.error("Failed to load dashboard stats:", error);
    }
  }

  function handleApplyCustom() {
    if (startDate && endDate) {
      loadData();
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64">Загрузка...</div>;
  }

  const totalAttendance = attendanceData.reduce(
    (acc, g) => ({
      PRESENT: acc.PRESENT + g.PRESENT,
      ABSENT: acc.ABSENT + g.ABSENT,
      LATE: acc.LATE + g.LATE,
    }),
    { PRESENT: 0, ABSENT: 0, LATE: 0 }
  );

  const pieData = [
    { name: "Присутствует", value: totalAttendance.PRESENT },
    { name: "Отсутствует", value: totalAttendance.ABSENT },
    { name: "Опоздал", value: totalAttendance.LATE },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Дашборд</h1>
          <p className="text-muted-foreground">
            Добро пожаловать, {userName}!
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label>Период:</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PERIOD_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {period === "custom" && (
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">С</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">По</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-[150px]"
                  />
                </div>
                <Button onClick={handleApplyCustom} disabled={!startDate || !endDate}>
                  Применить
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Группы</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.groups}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Студенты</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.students}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Занятия</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.lessons}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Записи</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.records}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Посещаемость по группам</CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Нет данных за выбранный период</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="PRESENT" name="Присутствует" fill="#22c55e" stackId="a" />
                  <Bar dataKey="LATE" name="Опоздал" fill="#eab308" stackId="a" />
                  <Bar dataKey="ABSENT" name="Отсутствует" fill="#ef4444" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Общая посещаемость</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Нет данных за выбранный период</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Динамика оценок</CardTitle>
        </CardHeader>
        <CardContent>
          {gradeData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет данных за выбранный период</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={gradeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[1, 5]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="grade" name="Средняя оценка" stroke="#8884d8" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
