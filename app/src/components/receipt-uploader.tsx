"use client";

import { useState, useTransition, useRef } from "react";
import { JtIcon } from "@/components/icons";
import { useTranslations } from "next-intl";

import {
  parseReceiptItemsAction,
  type ScanRecurringMatch,
} from "@/app/(app)/transactions/receipt-items-action";
import type { ParsedReceiptItems } from "@/lib/receipt-items";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

type Props = {
  onParsed: (
    result: ParsedReceiptItems,
    /** A due bill this scan looks like paying, when there is one. */
    recurring: ScanRecurringMatch | null
  ) => void;
  /** "card" (default) renders the full uploader card with title + hint.
   *  "compact" renders a single circular icon button — used by the new
   *  add-transaction layout where the scan affordance lives in the
   *  header alongside other small controls. */
  variant?: "card" | "compact";
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

export function ReceiptUploader({ onParsed, variant = "card" }: Props) {
  // Two inputs, because one can't be both: the camera one carries
  // `capture` so a tap goes straight to the viewfinder, the library one
  // omits it so the picker opens on the photos. Which is which is the
  // button the user pressed, not a menu they have to read.
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const libraryRef = useRef<HTMLInputElement | null>(null);
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<
    ParsedReceiptItems["confidence"] | null
  >(null);
  function handleFile(file: File) {
    setError(null);
    setConfidence(null);
    if (file.size > MAX_BYTES * 4) {
      setError(t("ocr.fileTooLarge"));
      return;
    }
    startTransition(async () => {
      try {
        const dataUrl = await fileToDataUrl(file);
        const result = await parseReceiptItemsAction(dataUrl);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setConfidence(result.result.confidence);
        onParsed(result.result, result.recurring);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("ocr.confidenceLow"));
      }
    });
  }

  /** Both inputs behave identically once a file exists; they differ
   *  only in which picker the tap opens. */
  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  if (variant === "compact") {
    return (
      <>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFileChosen}
        />
        <input
          ref={libraryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChosen}
        />
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={pending}
          aria-label={t("ocr.takePhoto")}
          title={error ?? t("ocr.takePhoto")}
          className="h-10 w-10 rounded-full soft-raised-sm flex items-center justify-center shadow-sm hover:bg-(--background) transition disabled:opacity-60"
        >
          {pending ? (
            <JtIcon name="loader-2" size={18} className="animate-spin" />
          ) : (
            <JtIcon name="camera" size={18} />
          )}
        </button>
        <button
          type="button"
          onClick={() => libraryRef.current?.click()}
          disabled={pending}
          aria-label={t("ocr.chooseImage")}
          title={error ?? t("ocr.chooseImage")}
          className="h-10 w-10 rounded-full soft-raised-sm flex items-center justify-center shadow-sm hover:bg-(--background) transition disabled:opacity-60"
        >
          <JtIcon name="upload" size={18} />
        </button>
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed border-(--border) bg-(--card)/50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="text-(--accent) shrink-0 mt-0.5">
          <JtIcon name="camera" size={26} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">{t("ocr.title")}</h3>
          <p className="text-xs text-(--muted) mt-0.5">{t("ocr.hint")}</p>
        </div>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChosen}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChosen}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-[16px] soft-raised hover:bg-(--background) px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {pending ? (
            <>
              <JtIcon name="loader-2" size={20} className="animate-spin" />
              {t("ocr.reading")}
            </>
          ) : (
            <>
              <JtIcon name="camera" size={20} />
              {t("ocr.takePhoto")}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => libraryRef.current?.click()}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-[16px] soft-raised hover:bg-(--background) px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <JtIcon name="upload" size={20} />
          {t("ocr.chooseImage")}
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
            <JtIcon name="check-circle-2" size={18} />
            {confidence === "high"
              ? t("ocr.confidenceHigh")
              : confidence === "medium"
              ? t("ocr.confidenceMedium")
              : t("ocr.confidenceLow")}
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 text-sm text-(--expense) bg-(--expense)/10 rounded-lg px-3 py-2">
          <JtIcon name="alert-circle" size={20} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
