export interface ShoppingItem {
  id: string;
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
  qty: number;
  unit?: string | null;
  category?: string | null;
}
