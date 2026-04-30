import { requireSession } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, role, ledger } = await requireSession();

  return (
    <DashboardShell
      userName={user.name}
      userImage={user.image}
      activeLedger={{
        id: ledger.id,
        name: ledger.name,
        icon: ledger.icon,
        isPersonal: ledger.is_personal,
        role,
      }}
    >
      {children}
    </DashboardShell>
  );
}
