import { requireSession } from "@/lib/session";
import { listCategories } from "@/lib/categories";
import { listRecurring } from "@/lib/recurring";
import { listAccounts } from "@/lib/accounts";
import { listTrips } from "@/lib/trips";
import { RecurringPanel } from "@/components/recurring-panel";

export default async function RecurringPage() {
  const { ledgerId, ledger } = await requireSession();
  const [rules, categories, accountRows, tripRows] = await Promise.all([
    listRecurring(ledgerId),
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
    <RecurringPanel
      rules={rules}
      categories={categories}
      accounts={accounts}
      trips={trips}
      homeCurrency={ledger.currency}
    />
  );
}
