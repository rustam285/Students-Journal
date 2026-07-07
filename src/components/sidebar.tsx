"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Calendar,
  Users,
  GraduationCap,
  BookOpen,
  UserCircle,
  LogOut,
  Shield,
  UserCog,
  FileUp,
  ScrollText,
  Library,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: string;
  };
}

const getNavItems = (role: string) => {
  const items = [
    {
      title: "Дашборд",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["ADMIN", "TEACHER", "STUDENT"],
    },
    {
      title: "Календарь",
      href: "/calendar",
      icon: Calendar,
      roles: ["ADMIN", "TEACHER", "STUDENT"],
    },
    {
      title: "Группы",
      href: "/groups",
      icon: Users,
      roles: ["ADMIN", "TEACHER"],
    },
    {
      title: "Студенты",
      href: "/students",
      icon: GraduationCap,
      roles: ["ADMIN", "TEACHER"],
    },
    {
      title: "Журнал",
      href: "/journal",
      icon: BookOpen,
      roles: ["ADMIN", "TEACHER"],
    },
    {
      title: "Предметы",
      href: "/subjects",
      icon: Library,
      roles: ["TEACHER"],
    },
    {
      title: "Профиль",
      href: "/profile",
      icon: UserCircle,
      roles: ["ADMIN", "TEACHER", "STUDENT"],
    },
    {
      title: "Моя успеваемость",
      href: "/my-records",
      icon: ClipboardList,
      roles: ["STUDENT"],
    },
  ];

  if (role === "ADMIN") {
    items.push({
      title: "Преподаватели",
      href: "/teachers",
      icon: UserCog,
      roles: ["ADMIN"],
    });
    items.push({
      title: "Импорт",
      href: "/import",
      icon: FileUp,
      roles: ["ADMIN"],
    });
    items.push({
      title: "Журнал действий",
      href: "/audit",
      icon: ScrollText,
      roles: ["ADMIN"],
    });
    items.push({
      title: "Управление",
      href: "/admin",
      icon: Shield,
      roles: ["ADMIN"],
    });
  }

  return items.filter((item) => item.roles.includes(role));
};

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(user.role);

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  return (
    <div className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-3 border-b px-6">
        <Avatar className="h-9 w-9">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{user.name}</span>
          <span className="text-xs text-muted-foreground">{user.role}</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <Separator className="mb-4" />
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-5 w-5" />
          Выйти
        </Button>
      </div>
    </div>
  );
}
