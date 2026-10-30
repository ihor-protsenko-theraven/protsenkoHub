import type { RecordAudit } from '../../shared/record-audit.model';

export interface ShoppingItem extends RecordAudit {
  readonly id: string;
  readonly listId: string;
  readonly name: string;
  readonly qty: number;
  readonly unit: string | null;
  readonly category: string | null;
  readonly isChecked: boolean;
  readonly version: number;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface ShoppingItemForm {
  readonly name: string;
  readonly qty: number;
  readonly unit: string;
  readonly category: string;
}

export interface ShoppingItemPayload {
  readonly name: string;
  readonly listId?: string;
  readonly qty: number;
  readonly unit?: string | null;
  readonly category?: string | null;
}

export interface ShoppingList {
  readonly id: string;
  readonly name: string;
  readonly isDefault: boolean;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface ShoppingListForm {
  readonly name: string;
  readonly items: string;
}

export interface ShoppingFilterForm {
  readonly search: string;
  readonly category: string;
}

export interface ShoppingQuickForm {
  readonly name: string;
}
