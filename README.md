# CSU Students Journal

Журнал/CRM для преподавателя — веб-приложение для учёта посещаемости и успеваемости студентов.

## Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone https://github.com/rustam285/Students-Journal.git
cd Students-Journal

# 2. Установить зависимости
pnpm install

# 3. Сгенерировать NEXTAUTH_SECRET
openssl rand -base64 32

# 4. Создать .env из примера и вставить секрет
cp .env.example .env
# Отредактировать .env, вставить NEXTAUTH_SECRET

# 5. Создать и заполнить базу данных
pnpm db:push
pnpm db:seed

# 6. Запустить приложение
pnpm dev
```

Открой http://localhost:3000 в браузере.

## Тестовые аккаунты

| Роль      | Email                  | Пароль       |
|-----------|------------------------|--------------|
| Admin     | admin@csu.ru           | password123  |
| Teacher   | ivanov@csu.ru          | password123  |
| Student   | petrova@student.csu.ru | password123  |
| Student   | sidorov@student.csu.ru | password123  |

## Команды

| Команда          | Описание                          |
|------------------|-----------------------------------|
| `pnpm dev`       | Запуск dev-сервера                |
| `pnpm build`     | Сборка для продакшена             |
| `pnpm start`     | Запуск продакшена                 |
| `pnpm db:push`   | Применить схему Prisma к БД       |
| `pnpm db:seed`   | Заполнить БД тестовыми данными    |
| `pnpm db:reset`  | Сбросить и перезаполнить БД       |
| `pnpm db:studio` | Открыть Prisma Studio             |
| `pnpm lint`      | Проверка линтером                 |

## Безопасность

- **НЕ** коммитить `.env` и файлы БД (`*.db`)
- Сгенерировать свой `NEXTAUTH_SECRET` перед запуском
- SQLite файл БД находится в `prisma/dev.db` (вне `public/`)

## Технологии

- Next.js 14 (App Router)
- TypeScript (strict mode)
- Tailwind CSS + shadcn/ui
- SQLite + Prisma ORM
- Auth.js (NextAuth v5)
- React Hook Form + Zod
- Recharts
- date-fns
