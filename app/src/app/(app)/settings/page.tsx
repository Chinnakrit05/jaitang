import { requireSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { PushToggle } from "@/components/push-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BackupSection } from "@/components/backup-section";
import { DangerZoneSection } from "@/components/danger-zone-section";
import { signOut } from "@/auth";
import { AlertTriangle, LogOut } from "lucide-react";

export default async function SettingsPage() {
  const { user, ledger, role } = await requireSession();
  const t = await getTranslations();
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <p className="text-sm text-(--muted) mt-1">{t("settings.subtitle")}</p>
      </div>

      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
        <h2 className="font-semibold">{t("settings.accountSection")}</h2>
        <div className="flex items-center gap-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "user"}
              className="h-12 w-12 rounded-full border border-(--border)"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-(--background) border border-(--border) flex items-center justify-center font-semibold">
              {(user.name ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{user.name ?? t("settings.unknownName")}</div>
            <div className="text-sm text-(--muted) truncate">{user.email}</div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-3 py-2 text-sm"
            >
              <LogOut size={14} />
              {t("common.logoutFull")}
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
        <h2 className="font-semibold">{t("settings.languageSection")}</h2>
        <p className="text-sm text-(--muted)">{t("settings.languageHint")}</p>
        <LanguageSwitcher />
      </section>

      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
        <h2 className="font-semibold">{t("settings.notificationsSection")}</h2>
        <p className="text-sm text-(--muted)">{t("settings.notificationsHint")}</p>
        <PushToggle vapidPublicKey={vapidPublicKey} />
      </section>

      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
        <h2 className="font-semibold">{t("settings.themeSection")}</h2>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm text-(--muted)">{t("settings.themeHint")}</span>
        </div>
      </section>

      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
        <h2 className="font-semibold">{t("backup.section")}</h2>
        <p className="text-sm text-(--muted)">{t("backup.sectionHint")}</p>
        <BackupSection />
      </section>

      <section className="rounded-2xl border border-(--expense)/40 bg-(--expense)/5 p-5 space-y-3">
        <h2 className="font-semibold flex items-center gap-2 text-(--expense)">
          <AlertTriangle size={16} />
          {t("settings.dangerSection")}
        </h2>
        <p className="text-sm text-(--muted)">{t("settings.dangerHint")}</p>
        <DangerZoneSection
          ledgerName={ledger.name}
          isOwnerOfActiveLedger={role === "owner"}
        />
      </section>
    </div>
  );
}
