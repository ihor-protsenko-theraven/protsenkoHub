import type { RecordAudit } from '../../shared/record-audit.model';

export type ContactCategory = 'DOCTOR' | 'TUTOR' | 'SCHOOL' | 'FAMILY' | 'OTHER';

export const CONTACT_CATEGORIES: ReadonlyArray<{ value: ContactCategory; label: string }> = [
  { value: 'DOCTOR', label: 'Лікар' },
  { value: 'TUTOR', label: 'Репетитор' },
  { value: 'SCHOOL', label: 'Школа' },
  { value: 'FAMILY', label: 'Сім’я' },
  { value: 'OTHER', label: 'Інше' },
];

export function contactCategoryLabel(category: ContactCategory): string {
  return CONTACT_CATEGORIES.find((option) => option.value === category)?.label ?? category;
}

export interface ContactItem extends RecordAudit {
  id: string;
  name: string;
  category: ContactCategory;
  phone: string | null;
  email: string | null;
  organization: string | null;
  notes: string | null;
}

export interface ContactForm {
  name: string;
  category: ContactCategory;
  phone: string;
  email: string;
  organization: string;
  notes: string;
}

export interface ContactPayload {
  name: string;
  category: ContactCategory;
  phone?: string | null;
  email?: string | null;
  organization?: string | null;
  notes?: string | null;
}
