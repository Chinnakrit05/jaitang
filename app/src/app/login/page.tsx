import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const t = await getTranslations();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
        <a href="/" className="flex items-center gap-2">
          <span className="text-2xl">📒</span>
          <span className="font-semibold text-lg">{t("appName")}</span>
        </a>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-(--border) bg-(--card) p-8 shadow-sm">
          <div className="text-center mb-8">
            <span className="text-5xl block mb-3">💰</span>
            <h1 className="text-2xl font-bold mb-1">{t("login.title")}</h1>
            <p className="text-sm text-(--muted)">{t("login.subtitle")}</p>
          </div>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-3 font-medium transition"
            >
              <GoogleIcon />
              {t("login.continueWithGoogle")}
            </button>
          </form>

          <p className="text-xs text-(--muted) text-center mt-6">
            {t("login.firstUseHint")}
          </p>
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.3 0-9.7-3.4-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5h-1.9V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.2 5.2c-.4.4 6.6-4.8 6.6-14.7 0-1.3-.1-2.4-.5-3.5z"
      />
    </svg>
  );
}
