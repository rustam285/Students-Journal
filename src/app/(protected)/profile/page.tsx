"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, BookOpen, Crown } from "lucide-react";
import { getUserProfile } from "@/app/actions/profile";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  studentProfile: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    groups: {
      group: { id: string; name: string };
    }[];
  } | null;
  homeroomOf: { id: string; name: string }[];
  teacherGroups: {
    group: { id: string; name: string };
  }[];
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const data = await getUserProfile();
      setProfile(data as UserProfile);
    } catch (error) {
      console.error("Failed to load profile:", error);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    if (newPassword.length < 6) {
      setError("Пароль должен быть не менее 6 символов");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Ошибка при смене пароля");
      } else {
        setSuccess("Пароль успешно изменён!");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Произошла ошибка");
    } finally {
      setLoading(false);
    }
  };

  const roleLabels: Record<string, string> = {
    ADMIN: "Администратор",
    TEACHER: "Преподаватель",
    STUDENT: "Студент",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Профиль</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Информация</CardTitle>
            <CardDescription>Ваши данные</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Имя</Label>
              <p className="text-lg">{session?.user?.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="text-lg">{session?.user?.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Роль</Label>
              <p className="text-lg">{roleLabels[session?.user?.role || ""] || session?.user?.role}</p>
            </div>

            {profile?.studentProfile && (
              <div>
                <Label className="text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Группы
                </Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {profile.studentProfile.groups.length > 0 ? (
                    profile.studentProfile.groups.map((sg) => (
                      <Badge key={sg.group.id} variant="secondary">
                        {sg.group.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">Не состоит в группах</span>
                  )}
                </div>
              </div>
            )}

            {profile?.role === "TEACHER" && (
              <>
                {profile.homeroomOf.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Классный руководитель
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {profile.homeroomOf.map((g) => (
                        <Badge key={g.id} variant="default">
                          {g.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Ведёт занятия
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {profile.teacherGroups.length > 0 ? (
                      profile.teacherGroups.map((tg) => (
                        <Badge key={tg.group.id} variant="secondary">
                          {tg.group.name}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">Нет групп</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Смена пароля</CardTitle>
            <CardDescription>Задайте новый пароль</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 text-sm text-green-600 bg-green-50 rounded-md">
                  {success}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="oldPassword">Текущий пароль</Label>
                <PasswordInput
                  id="oldPassword"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Новый пароль</Label>
                <PasswordInput
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? "Сохранение..." : "Изменить пароль"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
