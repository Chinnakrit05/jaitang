"use client";

import { useState } from "react";
import { TransactionForm, type SplitMember } from "@/components/transaction-form";
import { ReceiptUploader } from "@/components/receipt-uploader";
import type { Category, TxKind } from "@/lib/types";
import type { ParsedReceipt } from "@/lib/ocr";

type Initial = {
  kind: TxKind;
  amount: number;
  categoryId: string | null;
  note: string | null;
  occurredAt: string;
};

export function NewTransactionPage({
  categories,
  action,
  ocrEnabled,
  splitMembers,
}: {
  categories: Category[];
  action: (formData: FormData) => Promise<{ ok: false; error: string } | void>;
  ocrEnabled: boolean;
  splitMembers?: SplitMember[];
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
        action={action}
        submitLabel="บันทึก"
      />
    </div>
  );
}
