"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { JtIcon } from "@/components/icons";

/**
 * Full-screen camera for capturing a receipt, with the photo library
 * one tap away inside it.
 *
 * The OS file picker can do one or the other: `capture` opens the
 * camera and hides the library, no `capture` opens the library and
 * makes the camera a menu item. Neither puts both where a person
 * pointing a phone at a slip needs them, so this is our own viewfinder
 * with a library button beside the shutter.
 *
 * If the camera can't be opened — no permission, no camera, an older
 * browser — it doesn't argue: it says so and offers the library, which
 * is the whole job either way.
 */
export function ReceiptCamera({
  onCapture,
  onPickFile,
  onClose,
}: {
  /** A frame from the viewfinder, already a JPEG data URL. */
  onCapture: (dataUrl: string) => void;
  /** The user chose the library instead. */
  onPickFile: () => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const stop = useCallback(() => {
    // Leaving the stream open holds the camera and the recording
    // indicator stays lit, which reads as the app spying.
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch {
        // Denied, unavailable, or an insecure origin — all the same
        // to the person holding the receipt.
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    // Same ceiling as the file path's downscale: enough for the model
    // to read a receipt, small enough to post.
    const maxDim = 1600;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stop();
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 min-h-0">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 h-full w-full object-cover"
        />
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-white/80">
            {failed ? (
              <>
                <JtIcon name="camera" size={28} />
                <p className="text-sm leading-relaxed">
                  {t("ocr.camera.denied")}
                </p>
                <button
                  type="button"
                  onClick={onPickFile}
                  className="mt-1 px-4 h-10 rounded-full bg-white text-black text-sm font-semibold"
                >
                  {t("ocr.camera.gallery")}
                </button>
              </>
            ) : (
              <JtIcon name="loader-2" size={26} className="animate-spin" />
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="absolute top-4 right-4 h-10 w-10 rounded-full bg-black/45 text-white flex items-center justify-center backdrop-blur-sm"
          style={{ top: "max(16px, env(safe-area-inset-top))" }}
        >
          <JtIcon name="x" size={20} />
        </button>
      </div>

      <div
        className="shrink-0 bg-black px-8 py-5 flex items-center justify-between"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        {/* The library, right where the thumbnail sits in a camera app. */}
        <button
          type="button"
          onClick={onPickFile}
          aria-label={t("ocr.camera.gallery")}
          className="h-12 w-12 rounded-2xl border border-white/25 text-white flex items-center justify-center"
        >
          <JtIcon name="layers" size={22} />
        </button>

        <button
          type="button"
          onClick={shoot}
          disabled={!ready}
          aria-label={t("ocr.camera.shutter")}
          className="h-[68px] w-[68px] rounded-full border-[3px] border-white/90 flex items-center justify-center disabled:opacity-40"
        >
          <span className="h-14 w-14 rounded-full bg-white" />
        </button>

        {/* Balances the shutter so it sits dead centre. */}
        <span className="h-12 w-12" aria-hidden />
      </div>
    </div>
  );
}
