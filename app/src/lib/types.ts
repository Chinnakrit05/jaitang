export type TxKind = "income" | "expense";

export type Category = {
  id: string;
  ledger_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  kind: TxKind;
  sort_order: number;
};

export type Transaction = {
  id: string;
  ledger_id: string;
  user_id: string;
  category_id: string | null;
  kind: TxKind;
  amount: number;
  note: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type TransactionWithCategory = Transaction & {
  category: Pick<Category, "id" | "name" | "icon" | "color"> | null;
  user?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
};

export type MonthSummary = {
  income: number;
  expense: number;
  balance: number;
  byCategory: Array<{
    category_id: string | null;
    name: string;
    icon: string | null;
    color: string | null;
    kind: TxKind;
    total: number;
  }>;
  byDay: Array<{
    day: string; // YYYY-MM-DD
    income: number;
    expense: number;
  }>;
};
