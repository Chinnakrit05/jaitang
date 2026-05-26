"use client";

import { useState } from "react";
import { JtIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type Cat = { id: string; name: string; icon: string };
type Account = { id: string; name: string; icon: string };

type Kind = "expense" | "income";
type Pay = "cash" | "transfer";

/**
 * Self-contained preview of the redesigned add-transaction screen.
 * Mirrors the Figma mockup pixel-by-pixel: peach gradient amount card,
 * stacked payment pills, horizontal account pills, 4-col category grid
 * with a "+" tile, and a bone-handle save button. State is local and
 * the submit handler is a no-op — we wire this into the real form once
 * the visual direction is approved.
 */
export function NewTxMockup({
  categories,
  accounts,
}: {
  categories: Cat[];
  accounts: Account[];
}) {
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState<string>("");
  const [pay, setPay] = useState<Pay>("cash");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [currency, setCurrency] = useState<string>("THB");

  function clear() {
    setAmount("");
    setNote("");
    setCategoryId(null);
    setAccountId(null);
    setPay("cash");
    setKind("expense");
  }

  // Peach gradient mirrors the transactions hero so the screens read as
  // one family. Hardcoded for now — once we ship per-palette themes
  // we'll lift these into the palette tokens.
  const peachGradient =
    "linear-gradient(135deg, color-mix(in srgb, #F9D5B4 65%, var(--card)) 0%, color-mix(in srgb, #F4B58A 38%, var(--card)) 100%)";
  const peachStrong = "#E89A6A";
  const peachSoft = "#F9D5B4";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="ปิด"
          className="h-10 w-10 rounded-full bg-(--card) border border-(--border) flex items-center justify-center shadow-sm hover:bg-(--background) transition"
        >
          <JtIcon name="x" size={18} />
        </button>
        <h1 className="text-base font-semibold">เพิ่มรายการ</h1>
        <button
          type="button"
          onClick={clear}
          className="text-sm font-medium px-2 py-1"
          style={{ color: peachStrong }}
        >
          เคลียร์
        </button>
      </div>

      {/* Kind toggle */}
      <div
        className="relative grid grid-cols-2 p-1.5 rounded-full border border-(--border) bg-(--card)"
      >
        <button
          type="button"
          onClick={() => setKind("expense")}
          className={cn(
            "py-2.5 rounded-full text-sm font-semibold transition",
            kind === "expense"
              ? "text-white shadow-sm"
              : "text-(--muted)"
          )}
          style={
            kind === "expense"
              ? { background: peachStrong }
              : undefined
          }
        >
          รายจ่าย
        </button>
        <button
          type="button"
          onClick={() => setKind("income")}
          className={cn(
            "py-2.5 rounded-full text-sm font-semibold transition",
            kind === "income"
              ? "text-white shadow-sm"
              : "text-(--muted)"
          )}
          style={
            kind === "income"
              ? { background: peachStrong }
              : undefined
          }
        >
          รายรับ
        </button>
      </div>

      {/* Amount card */}
      <section
        className="relative rounded-3xl px-5 py-6 border"
        style={{
          background: peachGradient,
          borderColor: "color-mix(in srgb, #E89A6A 30%, transparent)",
        }}
      >
        <div className="absolute top-3 right-3">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="currency"
            className="appearance-none pl-3 pr-7 py-1.5 rounded-full bg-(--card)/90 text-xs font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-(--accent)/30"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23E89A6A' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.5rem center",
              backgroundSize: "12px",
            }}
          >
            <option>THB</option>
            <option>USD</option>
            <option>JPY</option>
            <option>EUR</option>
          </select>
        </div>
        <p
          className="text-center text-sm font-medium"
          style={{ color: "color-mix(in srgb, #6E3A12 75%, transparent)" }}
        >
          จำนวน
        </p>
        <label className="block mt-1 cursor-text">
          <div className="flex items-center justify-center gap-2">
            <span
              className="text-3xl font-bold tabular-nums"
              style={{ color: "color-mix(in srgb, #6E3A12 80%, transparent)" }}
            >
              ฿
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^\d.]/g, ""))
              }
              placeholder="0"
              className="w-32 bg-transparent text-5xl font-extrabold tabular-nums text-center text-white placeholder:text-white/85 focus:outline-none"
              style={{
                color: "white",
                textShadow: "0 1px 0 rgba(255,255,255,0.25)",
              }}
            />
          </div>
        </label>
      </section>

      {/* Note + Payment row */}
      <div className="grid grid-cols-5 gap-3">
        <label className="col-span-3 rounded-2xl border border-(--border) bg-(--card) px-4 py-3 flex items-start gap-2 min-h-[112px]">
          <span className="text-base mt-0.5">📝</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="โน้ต (ไม่บังคับ)"
            rows={3}
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-(--muted) focus:outline-none"
          />
        </label>

        <div className="col-span-2 space-y-2">
          <PayPill
            label="เงินสด"
            icon="💵"
            selected={pay === "cash"}
            onClick={() => setPay("cash")}
            accent={peachStrong}
          />
          <PayPill
            label="โอน"
            icon="💵"
            selected={pay === "transfer"}
            onClick={() => setPay("transfer")}
            accent={peachStrong}
          />
        </div>
      </div>

      {/* Account section */}
      <section>
        <h2 className="text-sm font-semibold mb-2">บัญชี</h2>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
          <AccountPill
            label="ไม่ระบุ"
            selected={accountId === null}
            onClick={() => setAccountId(null)}
            accent={peachStrong}
            soft={peachSoft}
          />
          {accounts.map((a) => (
            <AccountPill
              key={a.id}
              label={a.name}
              icon={a.icon}
              selected={accountId === a.id}
              onClick={() => setAccountId(a.id)}
              accent={peachStrong}
              soft={peachSoft}
            />
          ))}
        </div>
      </section>

      {/* Category section */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">เลือกหมวด</h2>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full"
            style={{
              background: "color-mix(in srgb, #F9D5B4 55%, var(--card))",
              color: "#8A4A1C",
            }}
          >
            <span>✏️</span> แก้ไข
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {categories.map((c) => (
            <CategoryTile
              key={c.id}
              category={c}
              selected={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
              accent={peachStrong}
            />
          ))}
          <button
            type="button"
            aria-label="เพิ่มหมวด"
            className="aspect-square rounded-2xl border border-dashed border-(--border) bg-(--card) flex items-center justify-center text-(--muted) hover:bg-(--background) transition"
          >
            <span className="text-2xl leading-none">+</span>
          </button>
        </div>
      </section>

      {/* Save CTA */}
      <div className="pt-2 sticky bottom-24">
        <button
          type="button"
          className="w-full rounded-full py-4 text-base font-bold text-white shadow-lg active:scale-[0.99] transition flex items-center justify-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${peachStrong} 0%, #D87A45 100%)`,
            boxShadow:
              "0 10px 24px -8px color-mix(in srgb, #E89A6A 65%, transparent)",
          }}
        >
          <span aria-hidden className="text-lg">🦴</span>
          บันทึก
        </button>
      </div>
    </div>
  );
}

function PayPill({
  label,
  icon,
  selected,
  onClick,
  accent,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl border bg-(--card) text-sm font-medium transition",
        selected
          ? "border-(--border) ring-2"
          : "border-(--border) text-(--foreground)"
      )}
      style={
        selected
          ? {
              boxShadow: `inset 0 0 0 2px ${accent}`,
            }
          : undefined
      }
    >
      <span className="flex items-center gap-2">
        <span>{icon}</span>
        <span>{label}</span>
      </span>
      {selected && (
        <span
          className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[11px]"
          style={{ background: accent }}
          aria-hidden
        >
          ✓
        </span>
      )}
    </button>
  );
}

function AccountPill({
  label,
  icon,
  selected,
  onClick,
  accent,
  soft,
}: {
  label: string;
  icon?: string;
  selected: boolean;
  onClick: () => void;
  accent: string;
  soft: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border transition whitespace-nowrap",
        selected ? "text-white border-transparent" : "bg-(--card) border-(--border) text-(--foreground)"
      )}
      style={
        selected
          ? {
              background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${soft} 50%, ${accent}) 100%)`,
            }
          : undefined
      }
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}

function CategoryTile({
  category,
  selected,
  onClick,
  accent,
}: {
  category: Cat;
  selected: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative aspect-square rounded-2xl border bg-(--card) flex flex-col items-center justify-center gap-1 p-2 transition",
        selected ? "border-transparent" : "border-(--border) hover:bg-(--background)"
      )}
      style={
        selected
          ? {
              boxShadow: `inset 0 0 0 2px ${accent}`,
            }
          : undefined
      }
    >
      <span className="text-2xl leading-none">{category.icon}</span>
      <span className="text-xs font-medium leading-tight text-center line-clamp-1">
        {category.name}
      </span>
    </button>
  );
}
