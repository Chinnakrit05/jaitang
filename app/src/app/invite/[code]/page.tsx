import Link from "next/link";
import { auth, signIn } from "@/auth";
import { ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";
import { getInviteByCode } from "@/lib/invites";
import { acceptInviteAction } from "@/app/(app)/ledgers/actions";
import { intlLocale } from "@/lib/locale-format";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const invite = await getInviteByCode(code);
  const session = await auth();
  const t = await getTranslations();
  const locale = await getLocale();
  const fmtLocale = intlLocale(locale);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">📒</span>
          <span className="font-semibold">{t("appName")}</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--card) p-8 shadow-sm">
          {!invite ? (
            <div className="text-center">
              <span className="text-5xl block mb-3">❌</span>
              <h1 className="text-xl font-bold mb-2">{t("invites.invalidTitle")}</h1>
              <p className="text-sm text-(--muted) mb-6">{t("invites.invalidHint")}</p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm"
              >
                {t("invites.backHome")}
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <span className="text-5xl block mb-3">{invite.ledger?.icon ?? "👥"}</span>
                <h1 className="text-xl font-bold mb-1">
                  {invite.ledger?.name ?? t("ledgers.title")}
                </h1>
                <p className="text-sm text-(--muted)">
                  {t("invites.invitedAs", {
                    role:
                      invite.role === "editor"
                        ? t("ledgers.roleEditor")
                        : t("ledgers.roleViewer"),
                  })}
                </p>
              </div>

              {session?.user ? (
                <form
                  action={async () => {
                    "use server";
                    await acceptInviteAction(code);
                  }}
                >
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-(--accent) text-(--accent-foreground) py-3 font-semibold hover:opacity-90 transition"
                  >
                    {t("invites.joinButton")} <ArrowRight size={18} />
                  </button>
                </form>
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: `/invite/${code}` });
                  }}
                >
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-3 font-medium transition"
                  >
                    {t("login.loginToJoin")}
                  </button>
                </form>
              )}

              <p className="text-xs text-(--muted) text-center mt-6">
                {t("invites.validity", { used: invite.used_count, max: invite.max_uses })}
                {invite.expires_at && (
                  <>
                    {" • "}
                    {t("invites.expiresAt", {
                      when: new Date(invite.expires_at).toLocaleDateString(fmtLocale, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }),
                    })}
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
