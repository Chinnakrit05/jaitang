import Link from "next/link";
import { auth, signIn } from "@/auth";
import { ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { getInviteByCode } from "@/lib/invites";
import { acceptInviteAction } from "@/app/(app)/ledgers/actions";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const invite = await getInviteByCode(code);
  const session = await auth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">📒</span>
          <span className="font-semibold">Jaitang</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--card) p-8 shadow-sm">
          {!invite ? (
            <div className="text-center">
              <span className="text-5xl block mb-3">❌</span>
              <h1 className="text-xl font-bold mb-2">ลิงก์เชิญไม่ถูกต้อง</h1>
              <p className="text-sm text-(--muted) mb-6">
                ลิงก์นี้อาจถูกลบ หรือรหัสผิด — ลองขอลิงก์ใหม่จากเจ้าของสมุด
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-5 py-2.5 font-semibold text-sm"
              >
                กลับหน้าหลัก
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <span className="text-5xl block mb-3">
                  {invite.ledger?.icon ?? "👥"}
                </span>
                <h1 className="text-xl font-bold mb-1">
                  {invite.ledger?.name ?? "สมุดบัญชี"}
                </h1>
                <p className="text-sm text-(--muted)">
                  คุณได้รับเชิญให้เข้าร่วมเป็น{" "}
                  <strong>
                    {invite.role === "editor" ? "ร่วมจด" : "ดูอย่างเดียว"}
                  </strong>
                </p>
              </div>

              {session?.user ? (
                <form
                  action={async () => {
                    "use server";
                    await acceptInviteAction(code);
                  }}
                >
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-(--accent) text-(--accent-foreground) py-3 font-semibold hover:opacity-90 transition"
                  >
                    เข้าร่วมสมุด <ArrowRight size={18} />
                  </button>
                </form>
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", {
                      redirectTo: `/invite/${code}`,
                    });
                  }}
                >
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-4 py-3 font-medium transition"
                  >
                    Login Google เพื่อเข้าร่วม
                  </button>
                </form>
              )}

              <p className="text-xs text-(--muted) text-center mt-6">
                ใช้ได้ {invite.used_count}/{invite.max_uses} ครั้ง
                {invite.expires_at && (
                  <>
                    {" "}
                    • หมดอายุ{" "}
                    {new Date(invite.expires_at).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
