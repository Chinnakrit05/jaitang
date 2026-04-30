import { requireSession } from "@/lib/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { PushToggle } from "@/components/push-toggle";
import { signOut } from "@/auth";
import { LogOut } from "lucide-react";

export default async function SettingsPage() {
  const { user } = await requireSession();
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">ตั้งค่า</h1>
        <p className="text-sm text-(--muted) mt-1">บัญชี การแจ้งเตือน และธีม</p>
      </div>

      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
        <h2 className="font-semibold">บัญชี</h2>
        <div className="flex items-center gap-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "user"}
              className="h-12 w-12 rounded-full border border-(--border)"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-(--background) border border-(--border) flex items-center justify-center font-semibold">
              {(user.name ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{user.name ?? "(ไม่ทราบชื่อ)"}</div>
            <div className="text-sm text-(--muted) truncate">{user.email}</div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl border border-(--border) bg-(--card) hover:bg-(--background) px-3 py-2 text-sm"
            >
              <LogOut size={14} />
              ออกจากระบบ
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
        <h2 className="font-semibold">การแจ้งเตือน (Web Push)</h2>
        <p className="text-sm text-(--muted)">
          แจ้งเตือนเมื่อมีกิจกรรมในสมุดแชร์ (ใส่รายการใหม่, ปิดบิล)
          และเมื่อใช้เกินงบประมาณ
        </p>
        <PushToggle vapidPublicKey={vapidPublicKey} />
      </section>

      <section className="rounded-2xl border border-(--border) bg-(--card) p-5 space-y-3">
        <h2 className="font-semibold">ธีม</h2>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="text-sm text-(--muted)">สลับโหมดสว่าง / มืด</span>
        </div>
      </section>
    </div>
  );
}
