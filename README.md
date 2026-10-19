# protsenkoHub

Сімейний хаб: календар, покупки, задачі Соломії, трекер сну та контакти. Це npm workspace з
окремими вебзастосунком, API та спільним пакетом типів.

## Стек

- **apps/web** — Angular 22.2 (standalone, zoneless, Signal Forms, httpResource, lazy routes, Angular Aria)
- **apps/api** — NestJS 11 (JWT cookie auth, modular monolith)
- **packages/shared** — спільні DTO/типи
- **DB** — Prisma + Postgres. Локально через Docker, у продакшені Neon на Vercel.
- **Package manager** — npm workspaces

## Швидкий старт

Потрібні Node.js 22.22.3+, 24.15+ або 26+ та npm. Команди запускайте з кореня репозиторію:

```bash
npm ci
Copy-Item env.example apps/api/.env # PowerShell; на macOS/Linux: cp env.example apps/api/.env

docker compose up -d
npm run db:migrate
npm run db:seed # тільки для нової локальної бази з демонстраційними даними

# API :3001  +  Web :4200  (у двох терміналах)
npm run dev:api
npm run dev:web
```

Вебзастосунок доступний на `http://localhost:4200`. Dev-server проксіює `/api` на API.
На Vercel той самий шлях іде в NestJS-сервіс, а решта адрес — в Angular.

Демо-логін після локального seed:

- `admin@protsenkohub.local` / `protsenko123`
- `family@protsenkohub.local` / `protsenko123`

## Структура

```text
protsenkoHub/
├── apps/
│   ├── api/          # NestJS + Prisma
│   └── web/          # Angular
├── packages/
│   └── shared/       # спільні типи
├── package.json      # npm workspaces root
├── package-lock.json
├── env.example
└── node_modules/     # власні залежності проєкту
```

У вебзастосунку кожен екран має окремі файли `.ts`, `.html` і `.scss`.
Моделі й типи винесені у `*.model.ts`, а запити до API — у `*.service.ts`.
Інтерфейс підтримує пошук, фільтри, редагування й підтвердження видалення.
Вкладки входу та реєстрації реалізовані через Angular Aria з клавіатурним керуванням.

## API

| Метод | Шлях | Опис |
|-------|------|------|
| POST | `/api/v1/auth/login` | Логін (httpOnly cookie) |
| GET | `/api/v1/events` | Події календаря |
| GET/POST/PATCH/DELETE | `/api/v1/shopping/items` | Покупки |
| GET/POST/PATCH/DELETE | `/api/v1/solomiya/tasks` | Задачі по дітях |
| GET | `/api/v1/solomiya/sleep` | Сон Соломії: активний запис, статистика, поради |
| POST | `/api/v1/solomiya/sleep/start` | Почати сон. Якщо він уже йде, час початку не змінюється |
| POST | `/api/v1/solomiya/sleep/stop` | Завершити активний сон. Відкрита пауза закривається разом із ним |
| POST | `/api/v1/solomiya/sleep/pause` | Пауза. Повторне натискання не зсуває її початок |
| POST | `/api/v1/solomiya/sleep/resume` | Продовжити сон |
| PATCH | `/api/v1/solomiya/sleep/pauses/:id` | Змінити початок або кінець паузи |
| GET/POST/PATCH/DELETE | `/api/v1/contacts` | Контакти |

## Продакшен на Vercel

Фронт, API і база живуть в одному проєкті Vercel. Angular і NestJS — це два сервіси
з `vercel.json` на одному домені, тож cookie входу лишається на тому самому сайті.
База — Postgres (Neon через маркетплейс Vercel). Локальний файл SQLite на Vercel не зберігається.

Локально підніміть Postgres і застосуйте міграції:

```bash
docker compose up -d
npm run db:migrate
```

Щоб викласти продакшен:

1. `npx vercel login`
2. У проєкті Vercel підключіть Neon і візьміть два рядки підключення.
3. Задайте змінні для Production:
   - `DATABASE_URL` — pooled-рядок Neon
   - `DIRECT_URL` — прямий рядок Neon
   - `JWT_SECRET` — довгий випадковий рядок
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` — перший вхід родини
   - `ALLOW_REGISTRATION=false` після того, як акаунти створені
4. `npx vercel --prod`

Під час встановлення залежностей API виконує `prisma migrate deploy` і, якщо задані
`ADMIN_EMAIL` та `ADMIN_PASSWORD`, створює першу родину. Демонстраційний `db:seed`
у production не запускається.

`npm run build`, `npm test`, `npm run typecheck`, `npm run lint`.
