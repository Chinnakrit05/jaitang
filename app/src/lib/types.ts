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

export type Trip = {
  id: string;
  ledger_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  starts_at: string | null;
  ends_at: string | null;
  archived: boolean;
  /** ISO 4217 (e.g. 'JPY'). null = inherit ledger.currency. */
  currency: string | null;
  created_at: string;
};

export type AccountType = "cash" | "bank" | "credit_card" | "e_wallet";

export type Account = {
  id: string;
  ledger_id: string;
  name: string;
  type: AccountType;
  icon: string | null;
  color: string | null;
  initial_balance: number;
  /** ISO 4217. null = inherit ledger.currency. */
  currency: string | null;
  archived: boolean;
  created_at: string;
};

export type Transfer = {
  id: string;
  ledger_id: string;
  user_id: string;
  from_account_id: string;
  to_account_id: string;
  from_amount: number;
  from_currency: string;
  to_amount: number;
  to_currency: string;
  fx_rate: number;
  note: string | null;
  occurred_at: string;
  created_at: string;
};

export type LoanKind = "lent" | "borrowed";
export type LoanStatus = "open" | "settled";

export type Loan = {
  id: string;
  ledger_id: string;
  user_id: string;
  kind: LoanKind;
  counterparty: string;
  principal: number;
  /** ISO 4217. Default 'THB'. Single-currency per loan; no FX tracking. */
  currency: string;
  started_at: string;
  due_date: string | null;
  status: LoanStatus;
  settled_at: string | null;
  note: string | null;
  created_at: string;
};

export type LoanRepayment = {
  id: string;
  loan_id: string;
  amount: number;
  occurred_at: string;
  note: string | null;
  created_at: string;
};

export type Goal = {
  id: string;
  ledger_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  /** Always in ledger.currency. v1 doesn't support multi-currency goals. */
  target_amount: number;
  deadline: string | null;
  archived: boolean;
  created_at: string;
};

export type GoalContribution = {
  id: string;
  goal_id: string;
  user_id: string;
  amount: number;
  note: string | null;
  occurred_at: string;
  created_at: string;
};

export type Transaction = {
  id: string;
  ledger_id: string;
  user_id: string;
  category_id: string | null;
  trip_id: string | null;
  account_id: string | null;
  kind: TxKind;
  amount: number;
  note: string | null;
  payment_method: PaymentMethod | null;
  /**
   * Multi-currency metadata. `amount` is always home currency; these three
   * record the foreign-currency original. All three are set together or
   * all null (DB constraint enforces this).
   */
  fx_currency: string | null;
  fx_amount: number | null;
  fx_rate: number | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type TransactionWithCategory = Transaction & {
  category: Pick<Category, "id" | "name" | "icon" | "color"> | null;
  trip?: Pick<Trip, "id" | "name" | "icon" | "color" | "currency"> | null;
  account?: Pick<Account, "id" | "name" | "icon" | "color" | "currency"> | null;
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
