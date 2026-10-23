export type MemberRole = 'ADMIN' | 'MEMBER';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
export type ContactCategory =
  | 'DOCTOR'
  | 'TUTOR'
  | 'SCHOOL'
  | 'FAMILY'
  | 'OTHER';

export interface AuthUserDto {
  id: string;
  email: string;
  displayName: string;
  householdId: string;
  membershipId: string;
  role: MemberRole;
  color: string;
}

export interface EventDto {
  id: string;
  title: string;
  notes: string | null;
  startsAt: string;
  endsAt: string;
  rrule: string | null;
  memberId: string | null;
  memberColor?: string | null;
}

export interface ShoppingItemDto {
  id: string;
  name: string;
  qty: number;
  unit: string | null;
  category: string | null;
  isChecked: boolean;
  sortOrder: number;
  version: number;
}

export interface ChildTaskDto {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  status: TaskStatus;
  priority: number;
  assigneeId: string | null;
}

export interface ContactDto {
  id: string;
  name: string;
  category: ContactCategory;
  phone: string | null;
  email: string | null;
  organization: string | null;
  notes: string | null;
}

export type SleepKind = 'NAP' | 'NIGHT';

export interface SleepSessionDto {
  id: string;
  kind: SleepKind;
  startedAt: string;
  endedAt: string | null;
  notes: string | null;
  startedByName: string | null;
  endedByName: string | null;
}

export const APP_NAV = [
  { path: 'calendar', label: 'Календар' },
  { path: 'shopping', label: 'Покупки' },
  { path: 'children', label: 'Діти' },
  { path: 'sleep', label: 'Сон' },
  { path: 'contacts', label: 'Контакти' },
] as const;
