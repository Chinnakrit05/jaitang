import { notFound, redirect } from "next/navigation";
import { JtIcon, EmojiOrIcon } from "@/components/icons";
import Link from "next/link";

import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { listMembers } from "@/lib/members";
import { listInvitesForLedger } from "@/lib/invites";
import { MembersPanel } from "@/components/members-panel";
import { InvitesPanel } from "@/components/invites-panel";

export default async function MembersPage({
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
    .select("id, name, icon, owner_id, is_personal")
    .eq("id", ledgerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!ledger) notFound();

  // Personal ledgers used to be locked out of sharing; they're now invitable
  // like any other ledger. Owner check still gates the page so non-owners
  // bounce back to the list.
  const isOwner = ledger.owner_id === userId;
  if (!isOwner) redirect("/ledgers");

  const [members, invites] = await Promise.all([
    listMembers(ledgerId),
    listInvitesForLedger(ledgerId),
  ]);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/ledgers"
        className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground)"
      >
        <JtIcon name="arrow-left" size={20} />
        {t("members.back")}
      </Link>

      <div className="flex items-center gap-3">
        <EmojiOrIcon value={ledger.icon} fallback="users" size={32} />
        <div>
          <h1 className="text-2xl font-bold">{ledger.name}</h1>
          <p className="text-sm text-(--muted)">{t("members.subtitle")}</p>
        </div>
      </div>

      <section>
        <h2 className="font-semibold mb-3">
          {t("members.membersTitle", { count: members.length })}
        </h2>
        <MembersPanel members={members} currentUserId={userId} />
      </section>

      <section>
        <h2 className="font-semibold mb-3">{t("members.invitesTitle")}</h2>
        <InvitesPanel ledgerId={ledgerId} invites={invites} />
      </section>
    </div>
  );
}
