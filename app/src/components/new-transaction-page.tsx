"use client";

import { useState } from "react";
import { NewTransactionForm } from "@/components/new-transaction-form";
import { ReceiptUploader } from "@/components/receipt-uploader";
import { ReceiptItemsReview } from "@/components/receipt-items-review";
import { RecurringScanBanner } from "@/components/recurring-scan-banner";
import type { ScanRecurringMatch } from "@/app/(app)/transactions/receipt-items-action";
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
  // A due bill this scan looks like paying. Offered above the form; the
  // form is filled in either way, so ignoring it changes nothing.
  const [recurring, setRecurring] = useState<ScanRecurringMatch | null>(null);

  /**
   * Route a scan to whichever surface fits what came back.
   *
   * A transfer slip, or a receipt whose lines all land in one category,
   * is still a single transaction — it goes straight into the form the
   * way scans always have, and a modal asking the user to confirm one
   * row would be a step for nothing. Anything that genuinely splits
   * across categories opens the review sheet.
   */
  function applyScan(
    result: ParsedReceiptItems,
    match: ScanRecurringMatch | null
  ) {
    const groups = groupItemsByCategory(result.items);

    if (groups.length > 1) {
      // A receipt that splits across categories is a shop run, not a
      // bill; the action doesn't match those, and the review sheet has
      // no room for the offer anyway.
      setRecurring(null);
      setReview(result);
      return;
    }
    setRecurring(match);

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
      {recurring && (
        <div className="mb-3">
          <RecurringScanBanner
            match={recurring}
            currency={currency ?? "THB"}
            onDismiss={() => setRecurring(null)}
          />
        </div>
      )}
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
