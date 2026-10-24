import type { ContactCategory } from './contacts.model';

export const CONTACT_CATEGORIES: ReadonlyArray<{ value: ContactCategory; label: string }> = [
  { value: 'DOCTOR', label: 'Лікар' },
  { value: 'TUTOR', label: 'Репетитор' },
  { value: 'SCHOOL', label: 'Школа' },
  { value: 'FAMILY', label: 'Сім’я' },
  { value: 'OTHER', label: 'Інше' },
];
