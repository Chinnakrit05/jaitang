import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { EditLedgerForm } from "./edit-form";
import { updateLedgerAction } from "@/app/(app)/ledgers/actions";

export default async function EditLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const t = await getTranslations();
  const { id: ledgerId } = await params;

  const sb = getServerSupabase();
  const { data: ledger } = await sb
    .from("ledgers")
    .select("id, name, icon, owner_id")
    .eq("id", ledgerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!ledger) notFound();
  if (ledger.owner_id !== userId) redirect("/ledgers");

  async function save(patch: { name?: string; icon?: string | null }) {
    "use server";
    return updateLedgerAction(ledgerId, patch);
  }

  return (
    <div className="max-w-md mx-auto pb-28 space-y-5">
      <h1 className="text-2xl font-bold">{t("ledgers.editTitle")}</h1>
      <EditLedgerForm
        ledgerId={ledgerId}
        initialName={ledger.name}
        initialIcon={ledger.icon}
        action={save}
      />
    </div>
  );
}
