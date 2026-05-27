"use client";

import { useState } from "react";
import { NewTransactionForm } from "@/components/new-transaction-form";
import { ReceiptUploader } from "@/components/receipt-uploader";
import type {
  AccountChoice,
  TripChoice,
} from "@/components/transaction-form";
import type { Category, PaymentMethod, TxKind } from "@/lib/types";
import type { ParsedReceipt } from "@/lib/ocr";

type Initial = {
  kind: TxKind;
  amount: number;
  categoryId: string | null;
  note: string | null;
  paymentMethod: PaymentMethod | null;
  occurredAt: string;
  tripId: string | null;
};

export function NewTransactionPage({
  categories,
  action,
  ocrEnabled,
  activeTrip,
  accounts,
  noteSuggestions,
  currency,
  defaultPaymentMethod,
}: {
  categories: Category[];
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  ocrEnabled: boolean;
  activeTrip?: TripChoice | null;
  accounts?: AccountChoice[];
  noteSuggestions?: string[];
  currency?: string;
  defaultPaymentMethod?: "cash" | "transfer" | null;
}) {
  const [formKey, setFormKey] = useState(0);
  const [initial, setInitial] = useState<Initial | undefined>(undefined);

  function applyOcr(result: ParsedReceipt) {
    setInitial({
      kind: result.kind,
      amount: result.amount ?? 0,
      categoryId: result.categoryId,
      note: result.note,
      paymentMethod: result.paymentMethod,
      occurredAt: result.occurredAt
        ? new Date(result.occurredAt).toISOString()
        : new Date().toISOString(),
      tripId: activeTrip?.id ?? null,
    });
    setFormKey((k) => k + 1);
  }

  return (
    <NewTransactionForm
      key={formKey}
      categories={categories}
      accounts={accounts}
      activeTrip={activeTrip}
      noteSuggestions={noteSuggestions}
      currency={currency}
      defaultPaymentMethod={defaultPaymentMethod}
      action={action}
      initial={initial}
      headerAction={
        ocrEnabled ? (
          <ReceiptUploader variant="compact" onParsed={applyOcr} />
        ) : undefined
      }
    />
  );
}
