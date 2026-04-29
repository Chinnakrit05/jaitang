import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ensurePersonalLedger } from "@/lib/ledgers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id?: string }).id;
  if (!userId) redirect("/login");

  // First-login bootstrapping: make sure a personal ledger exists.
  await ensurePersonalLedger(userId);

  return (
    <DashboardShell
      userName={session.user.name}
      userImage={session.user.image}
    >
      {children}
    </DashboardShell>
  );
}
