export type TxKind = "income" | "expense";

export type PaymentMethod = "cash" | "transfer";

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
  payment_method: PaymentMethod | null;
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

export type PaymentMethodTotals = {
  income: number;
  expense: number;
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
  /**
   * Aggregated income+expense per payment method. `unspecified` covers
   * legacy rows that pre-date the payment_method column (DB NULL).
   */
  byPaymentMethod: {
    cash: PaymentMethodTotals;
    transfer: PaymentMethodTotals;
    unspecified: PaymentMethodTotals;
  };
};
