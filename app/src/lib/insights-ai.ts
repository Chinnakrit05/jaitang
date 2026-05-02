import Anthropic from "@anthropic-ai/sdk";
import type { MonthCompare } from "@/lib/insights";

/**
 * Generate a short, friendly insights summary for the given month-compare.
 * Uses Claude Haiku 4.5 (already a dep, already used for OCR/quick-parse)
 * so we don't add a new model dependency.
 *
 * Throws a recognizable error if `ANTHROPIC_API_KEY` is unset, so the
 * caller can render a "configure your key" hint instead of crashing.
 */
export async function generateMonthInsightsSummary(
  compare: MonthCompare,
  locale: string,
  currency: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ฟีเจอร์สรุปด้วย AI ต้องการ ANTHROPIC_API_KEY — ดู SETUP.md"
    );
  }

  // Compact the input. We only send the numbers + names the model needs;
  // no transaction-level data leaves the server.
  const compact = {
    locale,
    currency,
    this_month: {
      income: compare.this.income,
      expense: compare.this.expense,
      balance: compare.this.balance,
    },
    prev_month: {
      income: compare.prev.income,
      expense: compare.prev.expense,
      balance: compare.prev.balance,
    },
    expense_up: compare.expenseUp.map((d) => ({
      name: d.name,
      this: d.thisAmount,
      prev: d.prevAmount,
      delta: d.delta,
      delta_pct: d.deltaPct,
    })),
    expense_down: compare.expenseDown.map((d) => ({
      name: d.name,
      this: d.thisAmount,
      prev: d.prevAmount,
      delta: d.delta,
      delta_pct: d.deltaPct,
    })),
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
    max_tokens: 280,
    system: `You are a friendly personal-finance coach summarizing this month vs last month for a single user. ${langInstruction}

Rules:
- Keep it to 2-3 short sentences total. No headings, no bullet points, no markdown.
- Lead with the single most notable change (biggest absolute delta), call out the category, and give a percentage if it makes sense (skip if last month was zero — say "new this month" instead).
- If everything looks similar to last month, say so cheerfully and pick one nice thing.
- NEVER moralize ("you should", "be careful"). Just describe what changed and why it might be worth a glance.
- Use the user's currency code (${currency}) inline if you mention numbers.`,
    messages: [
      {
        role: "user",
        content: `Summarize:\n${JSON.stringify(compact, null, 2)}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text.trim() : "";
}
