import Link from "next/link";
import { JtIcon } from "@/components/icons";
import { redirect } from "next/navigation";

import { getTranslations } from "next-intl/server";
import { requireSession, assertWritable } from "@/lib/session";
import { listAccounts } from "@/lib/accounts";
import {
  CreateTransferForm,
  type AccountChoice,
} from "@/components/create-transfer-form";

export default async function NewTransferPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ ledgerId, ledger, role }, sp, t] = await Promise.all([
    requireSession(),
    searchParams,
    getTranslations(),
  ]);
  // Server-side guard — viewers shouldn't even land here.
  assertWritable(role);

  const accounts = await listAccounts(ledgerId, { includeArchived: false });

  // Need at least 2 to transfer between. Bounce back to /accounts with
  // a message-less redirect — the user can create a second account from
  // there, and the /accounts page already explains the empty state.
  if (accounts.length < 2) {
    redirect("/accounts");
  }

  const choices: AccountChoice[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    currency: a.currency ?? ledger.currency,
  }));

  return (
    <div className="space-y-6 max-w-xl">
      <Link
        href="/accounts"
        className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground)"
      >
        <JtIcon name="arrow-left" size={16} />
        {t("accounts.backToList")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <JtIcon name="arrow-left-right" size={22} className="text-(--accent)" />
          {t("transfers.newTitle")}
        </h1>
        <p className="text-sm text-(--muted) mt-1">
          {t("transfers.newSubtitle")}
        </p>
      </div>

      <div className="rounded-2xl border border-(--border) bg-(--card) p-5">
        <CreateTransferForm
          accounts={choices}
          defaultFromId={sp.from}
          homeCurrency={ledger.currency}
        />
      </div>
    </div>
  );
}
