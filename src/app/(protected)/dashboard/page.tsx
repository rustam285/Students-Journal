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
import { Badge } from "@/components/ui/badge";
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
  getTopStudents,
  getLessonNumberStats,
  getGradeDistribution,
  getAtRiskStudents,
  getGroupComparison,
} from "@/app/actions/stats";
import { useSession } from "next-auth/react";

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
  const { data: session } = useSession();
  const isTeacherOrAdmin = ["ADMIN", "TEACHER"].includes(session?.user?.role || "");

  const [period, setPeriod] = useState<Period>("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [attendanceData, setAttendanceData] = useState<{ name: string; PRESENT: number; ABSENT: number; LATE: number; total: number }[]>([]);
  const [gradeData, setGradeData] = useState<{ date: string; grade: number | null }[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ groups: 0, students: 0, lessons: 0, records: 0 });
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [topStudents, setTopStudents] = useState<{ top: { name: string; avgGrade: number }[]; bottom: { name: string; avgGrade: number }[] }>({ top: [], bottom: [] });
  const [lessonNumberStats, setLessonNumberStats] = useState<{ lessonNumber: number; label: string; absenceRate: number }[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<{ grade: number; count: number }[]>([]);
  const [atRiskStudents, setAtRiskStudents] = useState<{ name: string; absenceRate: number; avgGrade: number | null }[]>([]);
  const [groupComparison, setGroupComparison] = useState<{ name: string; studentsCount: number; attendanceRate: number; avgGrade: number | null }[]>([]);

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
      const promises: Promise<unknown>[] = [
        getAttendanceStats(period, startDate, endDate),
        getGradeDynamics(period, startDate, endDate),
      ];

      if (isTeacherOrAdmin) {
        promises.push(
          getTopStudents(period, startDate, endDate, 5),
          getLessonNumberStats(period, startDate, endDate),
          getGradeDistribution(period, startDate, endDate),
          getAtRiskStudents(period, startDate, endDate, 30, 3),
          getGroupComparison(period, startDate, endDate)
        );
      }

      const results = await Promise.all(promises);

      setAttendanceData(results[0] as typeof attendanceData);
      setGradeData(results[1] as typeof gradeData);

      if (isTeacherOrAdmin && results.length > 2) {
        setTopStudents(results[2] as typeof topStudents);
        setLessonNumberStats(results[3] as typeof lessonNumberStats);
        setGradeDistribution(results[4] as typeof gradeDistribution);
        setAtRiskStudents(results[5] as typeof atRiskStudents);
        setGroupComparison(results[6] as typeof groupComparison);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, isTeacherOrAdmin]);

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

      {isTeacherOrAdmin && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Пропуски по парам</CardTitle>
              </CardHeader>
              <CardContent>
                {lessonNumberStats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет данных</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={lessonNumberStats}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis unit="%" />
                      <Tooltip formatter={(value: number) => [`${value}%`, "Пропуски"]} />
                      <Bar dataKey="absenceRate" name="% пропусков" fill="#ef4444">
                        {lessonNumberStats.map((entry, index) => (
                          <Cell key={index} fill={entry.absenceRate > 30 ? "#ef4444" : entry.absenceRate > 15 ? "#eab308" : "#22c55e"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Распределение оценок</CardTitle>
              </CardHeader>
              <CardContent>
                {gradeDistribution.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет данных</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={gradeDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="grade" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" name="Количество" fill="#8884d8">
                        {gradeDistribution.map((entry, index) => (
                          <Cell key={index} fill={["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"][index]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Сравнение групп</CardTitle>
              </CardHeader>
              <CardContent>
                {groupComparison.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет данных</p>
                ) : (
                  <div className="space-y-3">
                    {groupComparison.map((g) => (
                      <div key={g.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-medium">{g.name}</div>
                          <div className="text-sm text-muted-foreground">{g.studentsCount} студентов</div>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Посещ.:</span>{" "}
                            <span className={g.attendanceRate >= 80 ? "text-green-600" : g.attendanceRate >= 60 ? "text-yellow-600" : "text-red-600"}>
                              {g.attendanceRate}%
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Ср. балл:</span>{" "}
                            <span className="font-medium">{g.avgGrade || "—"}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Студенты в зоне риска</CardTitle>
              </CardHeader>
              <CardContent>
                {atRiskStudents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет студентов в зоне риска</p>
                ) : (
                  <div className="space-y-2">
                    {atRiskStudents.map((s) => (
                      <div key={s.name} className="flex items-center justify-between p-2 bg-red-50 rounded">
                        <span className="font-medium">{s.name}</span>
                        <div className="flex gap-3 text-sm">
                          {s.absenceRate >= 30 && (
                            <span className="text-red-600">Пропуски: {s.absenceRate}%</span>
                          )}
                          {s.avgGrade !== null && s.avgGrade < 3 && (
                            <span className="text-red-600">Ср. балл: {s.avgGrade}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Лучшие студенты</CardTitle>
              </CardHeader>
              <CardContent>
                {topStudents.top.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет данных</p>
                ) : (
                  <div className="space-y-2">
                    {topStudents.top.map((s, i) => (
                      <div key={s.name} className="flex items-center justify-between p-2 bg-green-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-green-600">{i + 1}.</span>
                          <span className="font-medium">{s.name}</span>
                        </div>
                        <Badge variant="default" className="bg-green-600">{s.avgGrade}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-orange-600">Отстающие студенты</CardTitle>
              </CardHeader>
              <CardContent>
                {topStudents.bottom.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет данных</p>
                ) : (
                  <div className="space-y-2">
                    {topStudents.bottom.map((s, i) => (
                      <div key={s.name} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-orange-600">{i + 1}.</span>
                          <span className="font-medium">{s.name}</span>
                        </div>
                        <Badge variant="destructive">{s.avgGrade}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
