# Контекст проєкту

Цей документ описує структуру protsenkoHub і правила коду для агентів. Короткі обов’язкові правила — в [AGENTS.md](../AGENTS.md). Поглиблені прийоми Angular — у скілі `.agents/skills/angular-developer/`.

## Що це

Один застосунок для родини. Календар, покупки, задачі, сон і контакти належать household, а не окремому користувачу. Часовий пояс родини за замовчуванням — `Europe/Kyiv`. Мова інтерфейсу — українська, `LOCALE_ID` дорівнює `uk`.

Застосунок zoneless: `zone.js` немає. Не додавайте його і не покладайтесь на автоматичне оновлення шаблону поза сигналами.

## Дерево

```text
protsenkoHub/
├── AGENTS.md
├── apps/
│   ├── api/                 NestJS, Prisma, префікс /api/v1
│   │   ├── prisma/          schema.prisma і міграції Postgres
│   │   └── src/
│   │       ├── auth/        cookie JWT, реєстрація створює household
│   │       ├── calendar/
│   │       ├── contacts/
│   │       ├── shopping/
│   │       ├── children/    задачі дітей та сон (/api/v1/children/*)
│   │       └── prisma/
│   └── web/                 Angular 22.2
│       └── src/app/
│           ├── core/        auth, api, guard
│           ├── features/    один екран — одна тека
│           ├── layout/      shell і навігація
│           └── shared/      дрібні функції без UI-стану
├── packages/shared/         спільні типи, застосунки їх майже не імпортують
├── scripts/                 env, міграції та перший адмін на Vercel
├── vercel.json              сервіси web і api на одному домені
└── .agents/skills/          скіли Angular, дизайну й Neon
```

## Екрани й API

| Екран | Маршрут | API |
| --- | --- | --- |
| Вхід | `/login` | `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `GET /api/v1/auth/me` |
| Головна | `/app/home` | `GET /api/v1/events`, `/api/v1/children/tasks`, `/api/v1/shopping/items`, `/api/v1/children/sleep` |
| Календар | `/app/calendar` | `/api/v1/events` |
| Покупки | `/app/shopping` | `/api/v1/shopping/items`, `/api/v1/shopping/lists` |
| Діти | `/app/children` | `/api/v1/children/tasks` |
| Сон | `/app/sleep` | `/api/v1/children/sleep` |
| Контакти | `/app/contacts` | `/api/v1/contacts` |
| Родина | `/app/family` | `GET /api/v1/auth/family`, `PUT /api/v1/auth/family/child` |

Маршрути Angular ліниві через `loadComponent`. Оболонка `/app` закрита `authGuard`. Сторінка входу закрита `guestGuard`.
Встановлений PWA стартує з `/app/home`; швидкі дії в маніфесті ведуть до сну та покупок.

Назва «Діти» — це екран задач (`/api/v1/children/tasks`). Сон лишається окремим трекером (`/api/v1/children/sleep`). Не зводьте їх в один розділ.

Зараз у родині один профіль дитини. Ім’я та дата народження зберігаються в `ChildProfile` родини; сон використовує ці дані й тримає у своєму профілі лише ціль денних снів. Покупки підтримують окремі речі та названі списки з кількома позиціями.
Під час переходу `SleepProfile` зберігає старі поля дитини: міграція переносить наявні дані, тригер приймає записи від попереднього API, а новий API дублює збереження для можливого відкату. Прибирати ці поля й тригер можна лише після завершення переходу встановлених PWA та старого API.

## Як зібраний екран

Типова фіча:

```text
features/calendar/
├── calendar.page.ts
├── calendar.page.html
├── calendar.page.scss
├── calendar.service.ts
└── calendar.model.ts
```

Сторінка тримає сигнали пошуку, фільтра, відкритої форми й id запису, який редагують або видаляють. Сервіс тримає `httpResource` і методи `create`, `update`, `remove`. Модель тримає інтерфейси відповіді API й тип форми. Порогові числа й сталі рядки лежать у `*.config.ts` тієї ж фічі, наприклад `sleep-guidance.config.ts` і `sleep.config.ts`.

Приклад каркаса, який вже використовують сторінки:

```ts
@Component({
  selector: 'app-calendar-page',
  imports: [FormField, RouterLink],
  providers: [CalendarService],
  templateUrl: './calendar.page.html',
  styleUrl: './calendar.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  private readonly data = inject(CalendarService);
  readonly events = this.data.events;
}
```

У шаблоні списки читайте як `events.value()`, а статус ресурсу перевіряйте до того, як показувати порожній стан. Для `httpResource` статус буває `loading`, `reloading`, `resolved`, `error` і `local`.

## Правила Angular, застосовані тут

Скіл `.agents/skills/angular-developer` читайте перед новим компонентом, формою, маршрутом, запитом або тестом. Для цього репозиторію з нього діють такі рішення:

- Angular 22, тож нові форми — Signal Forms, не Reactive Forms і не `FormBuilder`.
- Реактивність — signals. `linkedSignal`, коли чернетку форми треба скинути від серверного значення. `resource` / `httpResource` для асинхронних даних. `effect` — лише для логування або стороннього DOM, не для копіювання одного сигналу в інший.
- Контроль потоку в шаблоні — блоки `@if`, `@for`, `@switch`. `*ngIf` і `*ngFor` не додавайте. У `@for` завжди є `track`, зазвичай `track item.id`.
- Запити йдуть через `provideHttpClient(withFetch())`. Cookie передається `withCredentials: true`. Окремий інтерсептор для токена не потрібен: сесія в cookie.
- Доступні віджети на кшталт вкладок беріть з Angular Aria, як на сторінці входу.
- Діалоги й підтвердження видалення лишайте на сторінці. Окрему бібліотеку компонентів не підключайте.
- Тести компонентів — Vitest через `ng test`. Мокайте сервіс фічі, не викликайте прод-API.

Імена без суфікса `.component` скіл рекомендує для нового застосунку. Тут файли вже мають суфікси `.page`, `.component` і `.service`, а класи — `Page`, `Component` або `Service`. Новий файл називайте так, як сусідні файли тієї самої фічі. Масове перейменування під «intent over role» не робіть.

## Стилі

Глобальний шар — `apps/web/src/styles.scss`. Там живуть токени, `.page`, `.button`, `.field`, `.list-card`, бейджі й повідомлення. Сторінка має виглядати частиною цього шару.

Токени:

- `--ink`, `--muted` — текст;
- `--forest`, `--forest-dark` — основна дія;
- `--clay` — акцент і `:focus-visible`;
- `--paper`, `--surface`, `--soft`, `--line` — фон і межі;
- `--danger` — руйнівна дія.

Контроли форми й кнопки в рядку дій мають висоту 44px, `min-height: 44px` і `border-radius: 12px`. Випадаючий список статусу на картці — теж 44px, без окремого видимого підпису, якщо підпис уже є в `aria-label`. Не зменшуйте кнопку в картці й не зсувайте її через `transform` на hover.

Стиль компонента тримайте коротким. Якщо правило повторюється на двох екранах, підніміть його в `styles.scss`. Бюджет `anyComponentStyle` — 8 kB, інакше production-збірка падає.

Текст кнопок — дієслово українською: «Додати», «Змінити», «Видалити», «Увійти». Пріоритет задачі — підписані варіанти «Звичайний», «Важливо», «Терміново», не числове поле.

## API і дані

Nest-модуль на домен: контролер, сервіс, `dto/`. DTO перевіряє `class-validator`. Глобальний `ValidationPipe` працює з `whitelist`, `forbidNonWhitelisted` і `transform`. Зайве поле в тілі запиту дає 400.

Користувач у сервісі — `AuthUser` з `@CurrentUser()`. Запити фільтруйте через `user.householdId`. Не приймайте household id з клієнта.

Prisma-клієнт генерується в `postinstall`. Схема вимагає `DATABASE_URL` і `DIRECT_URL`. На Vercel їх заповнює `scripts/database-env.js` з імен Neon. Міграції продакшену — `prisma migrate deploy` під час install API.

`@nestjs/config`, `@nestjs/jwt` і `@nestjs/passport` зафіксовані на останніх CommonJS-версіях. Збірка Vercel підключає їх через `require()`. Не піднімайте ці пакети на ESM-релізи 12.x.

## Чого не робити

- Не комітити `.env`, рядки підключення Neon і `JWT_SECRET`.
- Не запускати `db:seed` проти прод-бази. Seed відмовляється в production, не обходьте цю перевірку.
- Не видаляти `apps/api/prisma/dev.db` як частину завдання: це стара локальна база, застосунок її не читає.
- Не переносити локальні записи сну в Neon без явного прохання.
- Не додавайте `.aider-desk/`: це локальна копія скіла, канонічні скіли лежать в `.agents/skills`.
