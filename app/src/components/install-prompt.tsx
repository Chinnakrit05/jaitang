"use client";

import { useEffect, useState } from "react";
import { JtIcon } from "@/components/icons";
import { useTranslations } from "next-intl";


const STORAGE_KEY = "jaitang.installPromptDismissedAt";
const SUPPRESS_DAYS = 14;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Install banner. Two paths:
 *   - Chromium (Android, Chrome, Edge, Opera) → window fires
 *     `beforeinstallprompt`. We hijack it, surface our own UI, and
 *     trigger `prompt()` on click — that's the platform contract.
 *   - iOS Safari → no event. We detect "looks like iOS Safari" by
 *     UA + display-mode and render a manual "tap Share → Add to Home
 *     Screen" hint.
 *
 * Suppression: once dismissed, hide for 14 days. Stored in localStorage
 * so dismissal is per-device. We don't track install events server-side.
 */
export function InstallPrompt() {
  const t = useTranslations();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [iosHint, setIosHint] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed (running in standalone) — never show.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari uses navigator.standalone for iOS PWAs.
      (navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Suppression check: dismissed within the last N days?
    try {
      const dismissedRaw = localStorage.getItem(STORAGE_KEY);
      if (dismissedRaw) {
        const dismissedAt = new Date(dismissedRaw).getTime();
        const cutoff = Date.now() - SUPPRESS_DAYS * 24 * 3600_000;
        if (dismissedAt > cutoff) return;
      }
    } catch {
      // localStorage may throw in private mode; ignore and show.
    }

    // Chromium path.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // iOS Safari fallback. UA-detect — not perfect but Apple gives no
    // programmatic way to detect "installable". We only show for
    // Safari-flavoured WebKit on iPhone/iPad.
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIOS && isSafari) {
      setIosHint(true);
      setHidden(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // Always hide after the prompt resolves — accepted means installed,
    // dismissed means user said no (don't pester). Either way, store
    // the dismissal so we don't re-show immediately.
    dismiss();
    if (outcome === "accepted") {
      // Optional: telemetry hook here later.
    }
  }

  if (hidden || (!deferred && !iosHint)) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-30 print:hidden">
      <div className="rounded-2xl border border-(--accent)/30 bg-(--card) shadow-xl p-4">
        <div className="flex items-start gap-3">
          <span className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl bg-(--accent)/10 text-(--accent)">
            <JtIcon name="smartphone" size={22} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">
              {t("install.title")}
            </h3>
            <p className="text-xs text-(--muted) mt-0.5">
              {iosHint ? t("install.bodyIos") : t("install.body")}
            </p>
            {iosHint && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-(--muted)">
                <JtIcon name="share" size={16} />
                <span>{t("install.iosStep1")}</span>
                <span className="text-(--muted)/60">→</span>
                <JtIcon name="plus-fab" size={16} />
                <span>{t("install.iosStep2")}</span>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              {deferred && (
                <button
                  type="button"
                  onClick={install}
                  className="px-3 py-1.5 rounded-lg bg-(--accent) text-(--accent-foreground) text-xs font-semibold hover:opacity-90 transition cta-primary"
                >
                  {t("install.installButton")}
                </button>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="px-3 py-1.5 rounded-lg border border-(--border) bg-(--background) hover:bg-(--card) text-xs font-medium"
              >
                {t("install.laterButton")}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 p-1 rounded-md text-(--muted) hover:bg-(--background)"
            aria-label={t("install.dismissAria")}
          >
            <JtIcon name="x" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
