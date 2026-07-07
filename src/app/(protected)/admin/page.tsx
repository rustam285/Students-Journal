"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Check } from "lucide-react";

export default function AdminPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Ошибка при создании пользователя");
      } else {
        setCreatedUser(data);
        setName("");
        setEmail("");
        setRole("STUDENT");
      }
    } catch {
      setError("Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = () => {
    if (createdUser?.password) {
      navigator.clipboard.writeText(createdUser.password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Управление пользователями</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Создать пользователя</CardTitle>
            <CardDescription>
              Новый пользователь получит временный пароль
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">ФИО</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Иванов Иван Иванович"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ivanov@csu.ru"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Роль</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Студент</SelectItem>
                    <SelectItem value="TEACHER">Преподаватель</SelectItem>
                    <SelectItem value="ADMIN">Администратор</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? "Создание..." : "Создать"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {createdUser && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="text-green-800">Пользователь создан!</CardTitle>
              <CardDescription className="text-green-700">
                Скопируйте временный пароль и передайте пользователю
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-green-700">Имя</Label>
                <p className="text-lg font-medium">{createdUser.name}</p>
              </div>
              <div>
                <Label className="text-green-700">Email</Label>
                <p className="text-lg font-medium">{createdUser.email}</p>
              </div>
              <div>
                <Label className="text-green-700">Временный пароль</Label>
                <div className="flex items-center gap-2">
                  <code className="p-2 bg-white rounded text-lg font-mono">
                    {createdUser.password}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyPassword}
                    className="gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Скопировано
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Копировать
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-green-700">
                ⚠️ Этот пароль больше не будет доступен. Пользователь будет вынужден сменить его при первом входе.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
