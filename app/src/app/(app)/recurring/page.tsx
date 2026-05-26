import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { listPendingRecurring, listRecurring } from "@/lib/recurring";
import { listAccounts } from "@/lib/accounts";
import { listTrips } from "@/lib/trips";
import { RecurringPanel } from "@/components/recurring-panel";
import { PendingRecurringPanel } from "@/components/pending-recurring-panel";
import { getLocale } from "next-intl/server";
import { intlLocale } from "@/lib/locale-format";

export default async function RecurringPage() {
  const { ledgerId, ledger } = await requireSession();
  const locale = await getLocale();
  const fmtLocale = intlLocale(locale);
  const [rules, pending, categories, accountRows, tripRows] = await Promise.all([
    listRecurring(ledgerId),
    listPendingRecurring(ledgerId),
    listCategories(ledgerId),
    listAccounts(ledgerId, { includeArchived: false }),
    listTrips(ledgerId),
  ]);

  const accounts = accountRows.map((a) => ({
    id: a.id,
    name: a.name,
    icon: a.icon,
    currency: a.currency ?? ledger.currency,
  }));
  const trips = tripRows
    .filter((tr) => !tr.archived)
    .map((tr) => ({
      id: tr.id,
      name: tr.name,
      icon: tr.icon,
      currency: tr.currency,
    }));

  return (
    <div className="space-y-5">
      {pending.length > 0 && (
        <div className="max-w-md mx-auto">
          <PendingRecurringPanel
            pending={pending}
            homeCurrency={ledger.currency}
            fmtLocale={fmtLocale}
          />
        </div>
      )}
      <RecurringPanel
        rules={rules}
        categories={categories}
        accounts={accounts}
        trips={trips}
        homeCurrency={ledger.currency}
      />
    </div>
  );
}
