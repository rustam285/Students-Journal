"use client";

import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Upload, FileUp, Check, AlertCircle } from "lucide-react";
import { getTeacherGroups } from "@/app/actions/journal";

interface ParsedStudent {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  valid: boolean;
  error?: string;
}

// --- Универсальный разбор строк (и для CSV, и для Excel) -----------------

type ColMap = { lastName: number; firstName: number; email: number; phone: number };
const POSITIONAL: ColMap = { lastName: 0, firstName: 1, email: 2, phone: 3 };

function matchHeader(cell: string): keyof ColMap | null {
  const c = cell.toLowerCase().trim();
  if (!c) return null;
  if (c.includes("фамил") || c.includes("last") || c.includes("surname")) return "lastName";
  if (c === "имя" || c.startsWith("имя ") || c.startsWith("имя.") || c.includes("first")) return "firstName";
  if (c.includes("mail") || c.includes("почта") || c.includes("email")) return "email";
  if (c.includes("тел") || c.includes("phone") || c.includes("tel") || c.includes("моб")) return "phone";
  return null;
}

// Возвращает карту колонок, если первая строка — заголовок, иначе null.
function detectColumns(headerRow: string[]): ColMap | null {
  const map: Partial<ColMap> = {};
  let found = 0;
  headerRow.forEach((cell, idx) => {
    const f = matchHeader(cell);
    if (f && map[f] === undefined) {
      map[f] = idx;
      found++;
    }
  });
  // Считаем заголовком, если распознали хотя бы Фамилию и Имя
  return found >= 2 && map.lastName !== undefined && map.firstName !== undefined
    ? (map as ColMap)
    : null;
}

function validateStudent(lastName: string, firstName: string, email: string): string[] {
  const errors: string[] = [];
  if (!lastName) errors.push("Нет фамилии");
  if (!firstName) errors.push("Нет имени");
  if (email && !email.includes("@")) errors.push("Некорректный email");
  return errors;
}

// rows — массив массивов ячеек (каждая ячейка приводится к строке)
function processRows(rows: unknown[][]): ParsedStudent[] {
  const stringRows = rows.map((r) => r.map((c) => String(c ?? "").trim()));

  if (stringRows.length === 0) return [];

  let colMap = detectColumns(stringRows[0]);
  let dataRows = stringRows;
  if (colMap) {
    dataRows = stringRows.slice(1); // пропускаем строку-заголовок
  } else {
    colMap = POSITIONAL; // позиционный формат: Фамилия;Имя;Email;Телефон
  }

  const students: ParsedStudent[] = [];
  for (const cells of dataRows) {
    // пропускаем полностью пустые строки
    if (cells.every((c) => c === "")) continue;

    const lastName = cells[colMap.lastName] ?? "";
    const firstName = cells[colMap.firstName] ?? "";
    const email = cells[colMap.email] ?? "";
    const phone = cells[colMap.phone] ?? "";

    if (!lastName && !firstName && !email && !phone) continue;

    const errors = validateStudent(lastName, firstName, email);
    students.push({
      firstName,
      lastName,
      email,
      phone,
      valid: errors.length === 0,
      error: errors.length > 0 ? errors.join(", ") : undefined,
    });
  }
  return students;
}

// --- Разделение CSV на строки/ячейки (с минимальной поддержкой кавычек) ---
function splitCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  return lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) =>
      line.split(/[;,]/).map((p) => p.trim().replace(/^["']|["']$/g, ""))
    );
}

export default function ImportPage() {
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);
  const [parseError, setParseError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    try {
      const data = await getTeacherGroups();
      setGroups(data);
    } catch (error) {
      console.error("Failed to load groups:", error);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError("");

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isExcel = ext === "xlsx" || ext === "xls";

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          if (!firstSheet) {
            setParseError("Файл не содержит листов");
            return;
          }
          const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
            header: 1,
            defval: "",
          });
          const students = processRows(rows);
          if (students.length === 0) {
            setParseError("В файле не найдено строк с данными");
            return;
          }
          setParsedStudents(students);
          setDialogOpen(true);
        } catch {
          setParseError("Не удалось прочитать Excel-файл. Проверьте формат.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV / TXT
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const rows = splitCsv(text);
        const students = processRows(rows);
        if (students.length === 0) {
          setParseError("В файле не найдено строк с данными");
          return;
        }
        setParsedStudents(students);
        setDialogOpen(true);
      };
      reader.readAsText(file);
    }
  }

  async function handleImport() {
    if (!selectedGroup || parsedStudents.length === 0) return;

    setImporting(true);
    try {
      const validStudents = parsedStudents.filter((s) => s.valid);
      const response = await fetch("/api/import-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: selectedGroup,
          students: validStudents.map((s) => ({
            firstName: s.firstName,
            lastName: s.lastName,
            email: s.email || null,
            phone: s.phone || null,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setParseError(data.error || "Ошибка импорта");
        return;
      }

      setResult({ success: data.imported, errors: data.errors });
      setParsedStudents([]);
    } catch {
      setParseError("Ошибка импорта");
    } finally {
      setImporting(false);
    }
  }

  function resetImport() {
    setParsedStudents([]);
    setResult(null);
    setParseError("");
    setDialogOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Импорт студентов</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Загрузка файла (CSV / Excel)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
            <p className="font-medium">Поддерживаемые форматы: <code>.xlsx</code>, <code>.xls</code>, <code>.csv</code></p>
            <p className="font-medium">Колонки:</p>
            <code className="block p-2 bg-background rounded">
              Фамилия;Имя;Email;Телефон
            </code>
            <p className="text-muted-foreground">
              Строка-заголовок определяется автоматически (Фамилия/Имя/Email/Телефон
              или LastName/FirstName/Email/Phone). Без неё используется позиционный
              порядок. Разделитель в CSV — точка с запятой (;) или запятая (,).
              Email и телефон необязательны.
            </p>
            <p className="text-muted-foreground">
              Пример: <code>Иванов;Иван;ivanov@mail.ru;+79001234567</code>
            </p>
          </div>

          {parseError && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {parseError}
            </div>
          )}

          <div className="flex items-end gap-4">
            <div className="space-y-2 flex-1">
              <Label>Группа для импорта</Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Файл</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    document.getElementById("file-upload")?.click();
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Выбрать файл
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {result
                ? "Импорт завершён"
                : `Предпросмотр (${parsedStudents.length} записей)`}
            </DialogTitle>
            <DialogDescription>
              {result
                ? `Импортировано: ${result.success}, Ошибок: ${result.errors}`
                : "Проверьте данные перед импортом"}
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
                <Check className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">
                    Успешно импортировано: {result.success}
                  </p>
                  {result.errors > 0 && (
                    <p className="text-sm text-red-600">
                      Ошибок: {result.errors}
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={resetImport}>Закрыть</Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default">
                  {parsedStudents.filter((s) => s.valid).length} валидных
                </Badge>
                {parsedStudents.some((s) => !s.valid) && (
                  <Badge variant="destructive">
                    {parsedStudents.filter((s) => !s.valid).length} с ошибками
                  </Badge>
                )}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>№</TableHead>
                    <TableHead>Фамилия</TableHead>
                    <TableHead>Имя</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedStudents.map((student, i) => (
                    <TableRow key={i} className={!student.valid ? "bg-red-50" : ""}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{student.lastName || "—"}</TableCell>
                      <TableCell>{student.firstName || "—"}</TableCell>
                      <TableCell>{student.email || "—"}</TableCell>
                      <TableCell>{student.phone || "—"}</TableCell>
                      <TableCell>
                        {student.valid ? (
                          <Badge variant="default" className="bg-green-500">OK</Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {student.error}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <DialogFooter>
                <Button variant="outline" onClick={resetImport}>
                  Отмена
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={
                    importing ||
                    !selectedGroup ||
                    parsedStudents.filter((s) => s.valid).length === 0
                  }
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  {importing
                    ? "Импорт..."
                    : `Импортировать ${parsedStudents.filter((s) => s.valid).length} записей`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
