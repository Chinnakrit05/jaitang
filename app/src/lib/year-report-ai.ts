import Anthropic from "@anthropic-ai/sdk";
import type { YearReport } from "@/lib/year-report";

/**
 * Generate a 4-5 paragraph year-in-review narrative from a `YearReport`.
 * Tone: warm, observational, no moralizing — surface trends, peaks,
 * notable categories, YoY change. Localized via `locale`.
 *
 * Throws if `ANTHROPIC_API_KEY` is missing — caller should fall back
 * to a deterministic summary.
 */
export async function generateYearCommentary(
  report: YearReport,
  locale: string,
  currency: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("missing ANTHROPIC_API_KEY");
  }

  // Trim down to the bits the model actually needs. Sending raw
  // categories with ids would just bloat the prompt.
  const compact = {
    year: report.year,
    total_income: report.totalIncome,
    total_expense: report.totalExpense,
    net: report.net,
    tx_count: report.txCount,
    monthly: report.monthly.map((m) => ({
      month: m.monthKey,
      income: m.income,
      expense: m.expense,
    })),
    top_expense_categories: report.topExpenseCategories.map((c) => ({
      name: c.name,
      total: c.total,
    })),
    top_income_categories: report.topIncomeCategories.map((c) => ({
      name: c.name,
      total: c.total,
    })),
    biggest_expense: report.biggestExpense
      ? {
          amount: report.biggestExpense.amount,
          note: report.biggestExpense.note,
          category: report.biggestExpense.category?.name ?? null,
          when: report.biggestExpense.occurred_at,
        }
      : null,
    biggest_income: report.biggestIncome
      ? {
          amount: report.biggestIncome.amount,
          note: report.biggestIncome.note,
          category: report.biggestIncome.category?.name ?? null,
          when: report.biggestIncome.occurred_at,
        }
      : null,
    peak_month: report.peakMonth,
    prior_year: report.priorYear,
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
    max_tokens: 800,
    system: `You are writing a year-in-review narrative for a personal finance app. ${langInstruction}

Output: 4-5 short paragraphs separated by single blank lines. NO headings, NO markdown, NO bullet points — flowing prose only.

Cover, in roughly this order:
1) Headline year totals (income, expense, net) and what they mean — a year of saving, breaking even, or net spending.
2) A trend across the months — when spending peaked / dipped, was it steady or seasonal.
3) The top 1-3 expense categories with rough share, plus the biggest single expense if it was unusual.
4) Year-over-year compare if prior_year is non-null — say whether spending or income shifted notably (>15%) in either direction. Skip this paragraph entirely if prior_year is null.
5) A forward-looking sentence — one observation the user might find useful for next year. NO moralizing, NO "you should". Just patterns.

Format amounts as "${currency} 12,345" inline. Don't list every category — pick what stands out. Don't mention transactions count. Months are YYYY-MM; convert to month names in the user's language.`,
    messages: [
      {
        role: "user",
        content: `Write a year-in-review for ${report.year}:\n${JSON.stringify(compact, null, 2)}`,
      },
    ],
  });

  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text.trim() : "";
}
