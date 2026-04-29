import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { ArrowRight, PiggyBank, Users, BarChart3 } from "lucide-react";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-(--border)">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📒</span>
          <span className="font-semibold text-lg">Jaitang</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="text-6xl mb-6">💰</span>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
          ใจถัง
        </h1>
        <p className="text-lg text-(--muted) max-w-md mb-2">สมุดบัญชีในใจ</p>
        <p className="text-base text-(--muted) max-w-md mb-10">
          จดรายรับ-รายจ่ายง่าย ๆ ทั้งของตัวเอง และแชร์กับคนใกล้ตัวได้
        </p>

        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full bg-(--accent) text-(--accent-foreground) px-6 py-3 font-semibold hover:opacity-90 transition"
        >
          เริ่มใช้งาน <ArrowRight size={18} />
        </Link>

        <div className="grid sm:grid-cols-3 gap-6 mt-16 max-w-3xl w-full">
          <Feature icon={<PiggyBank size={24} />} title="จดง่าย">
            เพิ่มรายการ 2-3 คลิก พร้อมหมวดหมู่ครบ
          </Feature>
          <Feature icon={<BarChart3 size={24} />} title="กราฟครบ">
            สรุปวัน/สัปดาห์/เดือน เห็นภาพการเงินชัด
          </Feature>
          <Feature icon={<Users size={24} />} title="แชร์ได้">
            สมุดส่วนตัว + สมุดแชร์กับแฟน/ครอบครัว
          </Feature>
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-sm text-(--muted) border-t border-(--border)">
        Jaitang • Made with 🦐
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-(--border) bg-(--card) p-6 text-left">
      <div className="text-(--accent) mb-3">{icon}</div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-(--muted)">{children}</p>
    </div>
  );
}
