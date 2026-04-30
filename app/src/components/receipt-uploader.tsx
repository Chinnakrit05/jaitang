"use client";

import { useState, useTransition, useRef } from "react";
import { Camera, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { parseReceiptAction } from "@/app/(app)/transactions/ocr-action";
import type { ParsedReceipt } from "@/lib/ocr";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

type Props = {
  onParsed: (result: ParsedReceipt) => void;
};

async function fileToDataUrl(file: File, maxDim = 1600): Promise<string> {
  // Use canvas to downscale large photos before sending — keeps payload small
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Cannot create canvas context");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ReceiptUploader({ onParsed }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ParsedReceipt["confidence"] | null>(null);

  function handleFile(file: File) {
    setError(null);
    setConfidence(null);
    if (file.size > MAX_BYTES * 4) {
      setError("ไฟล์ใหญ่เกินไป (เกิน 16 MB)");
      return;
    }
    startTransition(async () => {
      try {
        const dataUrl = await fileToDataUrl(file);
        const result = await parseReceiptAction(dataUrl);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setConfidence(result.result.confidence);
        onParsed(result.result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="text-(--accent) shrink-0 mt-0.5">
          <Camera size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">สแกนใบเสร็จด้วย AI</h3>
          <p className="text-xs text-(--muted) mt-0.5">
            อัปโหลดรูป ระบบจะอ่านยอด/หมวด/วันที่ มาเติมในฟอร์มให้
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              กำลังอ่านใบเสร็จ…
            </>
          ) : (
            <>
              <Camera size={16} />
              เลือกรูป / ถ่ายภาพ
            </>
          )}
        </button>

        {confidence && !pending && (
          <span
            className={`inline-flex items-center gap-1 text-xs ${
              confidence === "high"
                ? "text-(--income)"
                : confidence === "medium"
                ? "text-amber-500"
                : "text-(--muted)"
            }`}
          >
            <CheckCircle2 size={14} />
            {confidence === "high"
              ? "อ่านได้ครบ"
              : confidence === "medium"
              ? "อ่านบางส่วน — ตรวจก่อนบันทึก"
              : "อ่านไม่ค่อยชัด — ใส่เองดีกว่า"}
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-(--expense) bg-(--expense)/10 rounded-lg px-3 py-2">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
