import { CONTACT_CATEGORIES } from './contacts.config';
import type { ContactCategory } from './contacts.model';

export function contactCategoryLabel(category: ContactCategory): string {
  return CONTACT_CATEGORIES.find((option) => option.value === category)?.label ?? category;
}
