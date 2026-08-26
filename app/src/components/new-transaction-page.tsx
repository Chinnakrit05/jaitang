"use client";

import { useState } from "react";
import { NewTransactionForm } from "@/components/new-transaction-form";
import { ReceiptUploader } from "@/components/receipt-uploader";
import { ReceiptItemsReview } from "@/components/receipt-items-review";
import type {
  AccountChoice,
  TripChoice,
} from "@/components/transaction-form";
import type { Category, PaymentMethod, TxKind } from "@/lib/types";
import {
  composeReceiptNote,
  groupItemsByCategory,
  type ParsedReceiptItems,
} from "@/lib/receipt-items";

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
  const [review, setReview] = useState<ParsedReceiptItems | null>(null);

  /**
   * Route a scan to whichever surface fits what came back.
   *
   * A transfer slip, or a receipt whose lines all land in one category,
   * is still a single transaction — it goes straight into the form the
   * way scans always have, and a modal asking the user to confirm one
   * row would be a step for nothing. Anything that genuinely splits
   * across categories opens the review sheet.
   */
  function applyScan(result: ParsedReceiptItems) {
    const groups = groupItemsByCategory(result.items);

    if (groups.length > 1) {
      setReview(result);
      return;
    }

    const only = groups[0];
    setInitial({
      kind: result.kind,
      // Fall back to the printed total when the model found no usable
      // lines at all — better a filled amount than an empty form.
      amount: only?.amount ?? result.total ?? 0,
      categoryId: only?.categoryId ?? null,
      note: only ? composeReceiptNote(result.merchant, only.items) : result.merchant,
      paymentMethod: result.paymentMethod,
      occurredAt: result.occurredAt
        ? new Date(result.occurredAt).toISOString()
        : new Date().toISOString(),
      tripId: activeTrip?.id ?? null,
    });
    setFormKey((k) => k + 1);
  }

  return (
    <>
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
            <ReceiptUploader variant="compact" onParsed={applyScan} />
          ) : undefined
        }
      />
      {review && (
        <ReceiptItemsReview
          parsed={review}
          categories={categories}
          tripId={activeTrip?.id ?? null}
          onClose={() => setReview(null)}
        />
      )}
    </>
  );
}
