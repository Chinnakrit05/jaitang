"use client";

import { useState } from "react";
import {
  TransactionForm,
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
};

export function NewTransactionPage({
  categories,
  action,
  ocrEnabled,
  splitMembers,
  activeTrip,
  trips,
  currency,
}: {
  categories: Category[];
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  ocrEnabled: boolean;
  splitMembers?: SplitMember[];
  activeTrip?: TripChoice | null;
  trips?: TripChoice[];
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
        action={action}
        submitLabel="บันทึก"
        currency={currency}
      />
    </div>
  );
}
