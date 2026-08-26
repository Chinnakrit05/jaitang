import Link from "next/link";
import { JtIcon } from "@/components/icons";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ThemeToggle } from "@/components/theme-toggle";


export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const t = await getTranslations();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📒</span>
          <span className="font-semibold text-lg">{t("appName")}</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="text-6xl mb-6">💰</span>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          {t("landing.title")}
        </h1>
        <p className="text-lg text-(--muted) max-w-md mb-2">{t("landing.subtitle")}</p>
        <p className="text-base text-(--muted) max-w-md mb-10">
          {t("landing.description")}
        </p>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-6 py-3 font-semibold hover:opacity-90 transition"
        >
          {t("landing.getStarted")} <JtIcon name="arrow-right" size={22} />
        </Link>

        <div className="grid sm:grid-cols-3 gap-6 mt-16 max-w-3xl w-full">
          <Feature icon={<JtIcon name="budgets" size={28} />} title={t("landing.feature1Title")}>
            {t("landing.feature1Body")}
          </Feature>
          <Feature icon={<JtIcon name="bar-chart-3" size={28} />} title={t("landing.feature2Title")}>
            {t("landing.feature2Body")}
          </Feature>
          <Feature icon={<JtIcon name="users" size={28} />} title={t("landing.feature3Title")}>
            {t("landing.feature3Body")}
          </Feature>
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-sm text-(--muted) border-t border-(--border)">
        {t("landing.footer")}
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] soft-raised p-6 text-left">
      <div className="text-(--accent) mb-3">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-(--muted)">{children}</p>
    </div>
  );
}
