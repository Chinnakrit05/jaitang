import Link from "next/link";
import { signOut } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { LayoutDashboard, ListOrdered, FolderTree, Settings, LogOut, BookOpen } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "หน้าหลัก", icon: LayoutDashboard },
  { href: "/transactions", label: "รายการ", icon: ListOrdered },
  { href: "/categories", label: "หมวดหมู่", icon: FolderTree },
  { href: "/ledgers", label: "สมุดบัญชี", icon: BookOpen },
  { href: "/settings", label: "ตั้งค่า", icon: Settings },
];

export function DashboardShell({
  children,
  userName,
  userImage,
}: {
  children: React.ReactNode;
  userName?: string | null;
  userImage?: string | null;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-(--border) sticky top-0 z-20 bg-(--background)/80 backdrop-blur">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl">📒</span>
          <span className="font-semibold">Jaitang</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={userImage}
              alt={userName ?? "user"}
              className="h-9 w-9 rounded-full border border-(--border)"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-(--card) border border-(--border) flex items-center justify-center text-sm font-semibold">
              {(userName ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="inline-flex items-center gap-1 text-sm text-(--muted) hover:text-(--foreground) transition"
              aria-label="ออกจากระบบ"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">ออก</span>
            </button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden md:flex flex-col w-56 border-r border-(--border) bg-(--card)/50 px-3 py-6 gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-(--muted) hover:text-(--foreground) hover:bg-(--background) transition"
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </aside>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>

      <nav className="md:hidden border-t border-(--border) bg-(--card)/80 backdrop-blur sticky bottom-0">
        <div className="flex justify-around py-2">
          {NAV.slice(0, 4).map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs text-(--muted) hover:text-(--foreground)"
            >
              <Icon size={20} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
