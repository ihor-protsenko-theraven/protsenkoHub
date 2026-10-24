import type { RecordAudit } from '../../shared/record-audit.model';

export type ContactCategory = 'DOCTOR' | 'TUTOR' | 'SCHOOL' | 'FAMILY' | 'OTHER';

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
