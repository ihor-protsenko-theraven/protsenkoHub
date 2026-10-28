import { FeedingStatus } from './feeding.model';

export const FEEDING = {
  notesMaxLength: 500,
  notesTooLong: 'Нотатка задовга. Скоротіть її.',
  saveError: 'Не вдалося зберегти.',
  disclaimer: 'Орієнтир для родини. Рішення про прикорм узгодьте з педіатром.',
} as const;

export const FEEDING_TIPS = [
  'Прикорм доповнює грудне молоко або суміш і не замінює їх.',
  'Без солі, цукру, меду й спецій. Лише натуральні продукти.',
  'Починайте з невеликої кількості, 1–2 чайні ложки, і поступово збільшуйте порцію.',
  'Кожен новий продукт вводьте окремо протягом 3–5 днів і стежте за шкірою, випорожненням і самопочуттям.',
  'Не змушуйте, якщо дитина не хоче.',
  'Пюре має бути однорідним і ніжним, без грудочок. Спочатку рідше, згодом можна густіше.',
  'З 5 місяців зазвичай один прийом на день. З 6–8 місяців — 2–3 прийоми.',
  'Якщо каша рідшає від грудного молока, варіть її на воді й додайте молоко вже перед годуванням.',
  'Це орієнтир, не суворий графік. Послідовність може змінитися — узгодьте її з педіатром.',
] as const;

export const FEEDING_TABS = [
  { value: 'guide', label: 'Довідник' },
  { value: 'tracker', label: 'Трекер' },
] as const;

const STATUS_LABELS = {
  PENDING: 'Очікує',
  INTRODUCED: 'Введено',
  ALLERGY: 'Алергія',
  REFUSED: 'Відмова',
} satisfies Record<FeedingStatus, string>;

export const FEEDING_STATUSES: readonly { value: FeedingStatus; label: string }[] = (
  Object.entries(STATUS_LABELS) as [FeedingStatus, string][]
).map(([value, label]) => ({ value, label }));

export type FeedingTab = (typeof FEEDING_TABS)[number]['value'];
