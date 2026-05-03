"use client";

import { useState } from "react";
import {
  TransactionForm,
  type AccountChoice,
  type SplitMember,
  type TripChoice,
} from "@/components/transaction-form";
import { ReceiptUploader } from "@/components/receipt-uploader";
import type { Category, PaymentMethod, TxKind } from "@/lib/types";
import type { ParsedReceipt } from "@/lib/ocr";

type Initial = {
  kind: TxKind;
  amount: number;
  categoryId: string | null;
  note: string | null;
  paymentMethod: PaymentMethod | null;
  occurredAt: string;
  // Pre-fill the trip too — when the user scans a receipt during an
  // active trip, the OCR result should inherit the trip tag the same
  // way a manual "+ add" would. Without this, OCR-fed `initial` causes
  // the form to treat the row as edit-mode (where intentionally-cleared
  // tripId means "no trip") and the active-trip fallback never fires.
  tripId: string | null;
};

export function NewTransactionPage({
  categories,
  action,
  ocrEnabled,
  splitMembers,
  activeTrip,
  trips,
  accounts,
  noteSuggestions,
  currency,
}: {
  categories: Category[];
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  ocrEnabled: boolean;
  splitMembers?: SplitMember[];
  activeTrip?: TripChoice | null;
  trips?: TripChoice[];
  accounts?: AccountChoice[];
  noteSuggestions?: string[];
  currency?: string;
}) {
  // Use a key to force-remount the form when OCR fills it
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
      // Inherit the active trip — receipts scanned during a trip should
      // be tagged automatically, matching the manual-add UX.
      tripId: activeTrip?.id ?? null,
    });
    setFormKey((k) => k + 1);
  }

  return (
    <div className="space-y-5">
      {ocrEnabled && <ReceiptUploader onParsed={applyOcr} />}
      <TransactionForm
        key={formKey}
        categories={categories}
        initial={initial}
        splitMembers={splitMembers}
        activeTrip={activeTrip}
        trips={trips}
        accounts={accounts}
        noteSuggestions={noteSuggestions}
        action={action}
        submitLabel="บันทึก"
        currency={currency}
      />
    </div>
  );
}
