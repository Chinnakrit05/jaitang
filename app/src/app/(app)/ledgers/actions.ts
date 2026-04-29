"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { setActiveLedgerCookie } from "@/lib/active-ledger";
import { requireSession, assertOwner } from "@/lib/session";
import {
  consumeInvite,
  createInvite,
  deleteInvite,
} from "@/lib/invites";
import { removeMember, updateMemberRole } from "@/lib/members";

function refreshAll() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/categories");
  revalidatePath("/ledgers");
}

const CreateLedgerSchema = z.object({
  name: z.string().min(1).max(50),
  icon: z.string().min(1).max(8).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function createSharedLedgerAction(formData: FormData) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  const parsed = CreateLedgerSchema.safeParse({
    name: formData.get("name"),
    icon: formData.get("icon") || undefined,
    color: formData.get("color") || undefined,
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = getServerSupabase();
  const { data: created, error } = await sb
    .from("ledgers")
    .insert({
      name: parsed.data.name,
      icon: parsed.data.icon ?? "👥",
      color: parsed.data.color ?? "#a855f7",
      currency: "THB",
      owner_id: userId,
      is_personal: false,
    })
    .select("id")
    .single();
  if (error) throw error;
  await sb.rpc("seed_default_categories", { _ledger_id: created.id });

  refreshAll();
  redirect(`/ledgers/${created.id}/members`);
}

export async function switchLedgerAction(ledgerId: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login");

  // Verify membership
  const sb = getServerSupabase();
  const { data: owned } = await sb
    .from("ledgers")
    .select("id")
    .eq("id", ledgerId)
    .eq("owner_id", userId)
    .maybeSingle();
  let allowed = !!owned;
  if (!allowed) {
    const { data: member } = await sb
      .from("ledger_members")
      .select("id")
      .eq("ledger_id", ledgerId)
      .eq("user_id", userId)
      .maybeSingle();
    allowed = !!member;
  }
  if (!allowed) throw new Error("ไม่พบสมุดเล่มนี้ในรายการของคุณ");

  await setActiveLedgerCookie(ledgerId);
  refreshAll();
}

export async function deleteLedgerAction(ledgerId: string) {
  const { userId } = await requireSession();
  const sb = getServerSupabase();
  const { data: ledger } = await sb
    .from("ledgers")
    .select("id, owner_id, is_personal")
    .eq("id", ledgerId)
    .single();
  if (!ledger) throw new Error("ไม่พบสมุด");
  if (ledger.owner_id !== userId) throw new Error("เฉพาะเจ้าของสมุดเท่านั้นที่ลบได้");
  if (ledger.is_personal) throw new Error("สมุดส่วนตัวลบไม่ได้");
  const { error } = await sb.from("ledgers").delete().eq("id", ledgerId);
  if (error) throw error;
  refreshAll();
  redirect("/ledgers");
}

const InviteSchema = z.object({
  ledgerId: z.string().uuid(),
  role: z.enum(["editor", "viewer"]),
  maxUses: z.coerce.number().int().min(1).max(50).default(5),
  expiresInDays: z.coerce.number().int().min(0).max(365).default(7),
});

export async function createInviteAction(formData: FormData) {
  const { userId, role: userRole } = await requireSession();
  assertOwner(userRole);
  const parsed = InviteSchema.safeParse({
    ledgerId: formData.get("ledgerId"),
    role: formData.get("role"),
    maxUses: formData.get("maxUses"),
    expiresInDays: formData.get("expiresInDays"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const expiresAt =
    parsed.data.expiresInDays > 0
      ? new Date(Date.now() + parsed.data.expiresInDays * 86400_000)
      : null;
  const invite = await createInvite({
    ledgerId: parsed.data.ledgerId,
    createdBy: userId,
    role: parsed.data.role,
    maxUses: parsed.data.maxUses,
    expiresAt,
  });
  refreshAll();
  return { ok: true as const, code: invite.code as string };
}

export async function deleteInviteAction(inviteId: string) {
  const { role } = await requireSession();
  assertOwner(role);
  await deleteInvite(inviteId);
  refreshAll();
}

export async function acceptInviteAction(code: string) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect(`/login?next=/invite/${encodeURIComponent(code)}`);
  const result = await consumeInvite({ code, userId });
  await setActiveLedgerCookie(result.ledgerId);
  refreshAll();
  redirect("/dashboard");
}

const RoleSchema = z.enum(["editor", "viewer"]);

export async function updateMemberRoleAction(memberId: string, role: string) {
  const { role: userRole } = await requireSession();
  assertOwner(userRole);
  const r = RoleSchema.parse(role);
  await updateMemberRole(memberId, r);
  refreshAll();
}

export async function removeMemberAction(memberId: string) {
  const { role } = await requireSession();
  assertOwner(role);
  await removeMember(memberId);
  refreshAll();
}
