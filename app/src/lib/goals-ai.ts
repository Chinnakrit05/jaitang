import Anthropic from "@anthropic-ai/sdk";
import type { GoalStats } from "@/lib/goals";

/**
 * Generate a 1-2 sentence nudge for a savings goal. Tone matches the
 * insights summary: friendly coach, no moralizing. Localized via the
 * `locale` argument so users see their language.
 *
 * Throws if `ANTHROPIC_API_KEY` is missing — caller should render a
 * fallback hint deterministically computed from goal stats instead.
 */
export async function generateGoalNudge(
  goal: GoalStats,
  locale: string,
  currency: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("missing ANTHROPIC_API_KEY");
  }

  const compact = {
    name: goal.name,
    target: goal.target_amount,
    current: goal.currentAmount,
    progress_pct: Math.round(goal.progress * 100),
    achieved: goal.achieved,
    months_remaining: goal.monthsRemaining,
    monthly_required: goal.monthlyRequired,
    has_deadline: !!goal.deadline,
    currency,
  };

  const langInstruction =
    locale === "en"
      ? "Reply in plain conversational English."
      : locale === "ja"
      ? "Reply in plain conversational Japanese."
      : locale === "zh"
      ? "Reply in plain conversational Chinese."
      : "Reply in plain conversational Thai (use 'เรา' for the user).";

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 180,
    system: `You are a friendly personal-finance coach giving a one-shot nudge for a savings goal. ${langInstruction}

Rules:
- 1-2 short sentences. No headings, no markdown, no bullets.
- If achieved=true: congratulate and suggest archiving the goal.
- Else if has_deadline=true and months_remaining > 0: lead with the monthly_required figure ("save X per month to hit it") and percent done.
- Else if has_deadline=true and months_remaining <= 0: gentle "deadline passed" + remaining-amount-to-go.
- Else (no deadline): cheer current progress + name a milestone (next 25% / 50% etc).
- Use the currency code (${currency}) inline if you mention amounts.
- NEVER moralize. No "you should", "be careful", "consider cutting back". Just numbers + encouragement.`,
    messages: [
      {
        role: "user",
        content: `Nudge for this goal:\n${JSON.stringify(compact, null, 2)}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text.trim() : "";
}
