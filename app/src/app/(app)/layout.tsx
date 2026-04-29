import { requireSession } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard-shell";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, ledgerId, role } = await requireSession();

  const sb = getServerSupabase();
  const { data: activeLedger } = await sb
    .from("ledgers")
    .select("id, name, icon, is_personal")
    .eq("id", ledgerId)
    .single();

  return (
    <DashboardShell
      userName={user.name}
      userImage={user.image}
      activeLedger={
        activeLedger
          ? {
              id: activeLedger.id,
              name: activeLedger.name,
              icon: activeLedger.icon,
              isPersonal: activeLedger.is_personal,
              role,
            }
          : null
      }
    >
      {children}
    </DashboardShell>
  );
}
