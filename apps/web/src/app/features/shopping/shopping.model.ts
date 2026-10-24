import type { RecordAudit } from '../../shared/record-audit.model';

export interface ShoppingItem extends RecordAudit {
  id: string;
  listId: string;
  name: string;
  qty: number;
  unit: string | null;
  category: string | null;
  isChecked: boolean;
  version: number;
}

export interface ShoppingItemForm {
  name: string;
  qty: number;
  unit: string;
  category: string;
}

export interface ShoppingItemPayload {
  name: string;
  listId?: string;
  qty: number;
  unit?: string | null;
  category?: string | null;
}

export interface ShoppingList {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface ShoppingListForm {
  name: string;
  items: string;
}
