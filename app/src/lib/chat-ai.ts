import Anthropic from "@anthropic-ai/sdk";
import { listTransactions } from "@/lib/transactions";
import { listAccounts } from "@/lib/accounts";
import { listCategories } from "@/lib/categories";
import { compareMonths } from "@/lib/insights";
import { businessTzMidnightUtc, nowInBusinessTz } from "@/lib/business-tz";
import { resolveRange, type RangeKey } from "@/lib/date-range";

/**
 * Tool-use loop for the chat assistant. The model has read-only tools
 * to query the user's ledger; we run them server-side and feed results
 * back until the model stops calling tools and produces a final reply.
 *
 * Safety: every tool fetch is scoped to the caller's ledger via
 * `ledgerId`. The model can ONLY see this ledger — it can't escape
 * to another user's data even if it tries (the lib functions enforce
 * the ledger_id filter).
 */

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const MAX_TOOL_ITERATIONS = 6;

/**
 * Tool schemas that Claude sees. We keep them minimal and composable
 * — each does ONE thing. When the model needs more, it chains tool
 * calls. Locale-aware date math is delegated to `resolveRange` so the
 * model can say "this month" / "last month" naturally.
 */
const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_recent_transactions",
    description:
      "List the user's recent transactions, optionally filtered by category or kind. Use this when the user asks 'what did I buy', 'show recent', etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number" as const,
          description: "Max number of rows to return (default 10, max 50).",
        },
        kind: {
          type: "string" as const,
          enum: ["income", "expense"],
          description: "Filter to income or expense only.",
        },
        category_name: {
          type: "string" as const,
          description:
            "Filter to a specific category by name (matches first category whose name contains this substring, case-insensitive).",
        },
        search_note: {
          type: "string" as const,
          description:
            "Substring to match in the transaction note (case-insensitive).",
        },
      },
    },
  },
  {
    name: "sum_by_period",
    description:
      "Get total income and total expense for a named period. Use when the user asks 'how much did I spend this month', 'total this year', etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: {
          type: "string" as const,
          enum: [
            "today",
            "yesterday",
            "month",
            "prev",
            "30d",
            "ytd",
            "all",
          ],
          description:
            "Named period: today/yesterday = single day; month = current calendar month; prev = previous calendar month; 30d = rolling 30 days; ytd = year-to-date; all = since beginning.",
        },
        category_name: {
          type: "string" as const,
          description: "Optional: limit to a specific category.",
        },
      },
      required: ["period"],
    },
  },
  {
    name: "spending_by_category",
    description:
      "Break down expenses (or income) by category for a named period. Use when the user asks 'what did I spend on', 'top categories', etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        period: {
          type: "string" as const,
          enum: [
            "today",
            "yesterday",
            "month",
            "prev",
            "30d",
            "ytd",
            "all",
          ],
          description: "Named period (same enum as sum_by_period).",
        },
        kind: {
          type: "string" as const,
          enum: ["income", "expense"],
          description: "Default 'expense'.",
        },
      },
      required: ["period"],
    },
  },
  {
    name: "list_accounts",
    description:
      "List all accounts (cash/bank/credit/e-wallet) with their current balances. Use for 'how much in my SCB', 'all my balances', etc.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "compare_this_month_vs_last",
    description:
      "Compare totals + per-category between the current calendar month and the previous one. Use for 'am I spending more', 'how does this month compare'.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

async function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: { ledgerId: string; homeCurrency: string }
): Promise<ToolResult> {
  try {
    if (name === "list_recent_transactions") {
      const limit = Math.min(Number(input.limit ?? 10), 50);
      const kind =
        input.kind === "income" || input.kind === "expense"
          ? (input.kind as "income" | "expense")
          : undefined;

      // Resolve category by name (substring match) if provided.
      let categoryId: string | undefined;
      if (typeof input.category_name === "string" && input.category_name) {
        const cats = await listCategories(ctx.ledgerId);
        const lower = input.category_name.toLowerCase();
        const found = cats.find((c) => c.name.toLowerCase().includes(lower));
        if (found) categoryId = found.id;
      }

      const items = await listTransactions({
        ledgerId: ctx.ledgerId,
        limit,
        kind,
        categoryId,
        search:
          typeof input.search_note === "string" && input.search_note
            ? input.search_note
            : undefined,
      });
      return {
        ok: true,
        data: items.map((tx) => ({
          id: tx.id,
          kind: tx.kind,
          amount: tx.amount,
          currency: ctx.homeCurrency,
          fx_currency: tx.fx_currency,
          fx_amount: tx.fx_amount,
          category: tx.category?.name ?? null,
          note: tx.note,
          date: tx.occurred_at,
        })),
      };
    }

    if (name === "sum_by_period") {
      const period = input.period as RangeKey | undefined;
      if (!period) return { ok: false, error: "period required" };
      const range = resolveRange(period);
      let categoryId: string | undefined;
      if (typeof input.category_name === "string" && input.category_name) {
        const cats = await listCategories(ctx.ledgerId);
        const lower = input.category_name.toLowerCase();
        const found = cats.find((c) => c.name.toLowerCase().includes(lower));
        if (found) categoryId = found.id;
      }
      const items = await listTransactions({
        ledgerId: ctx.ledgerId,
        from: range.from,
        to: range.to,
        categoryId,
        limit: 50000,
      });
      let income = 0;
      let expense = 0;
      for (const tx of items) {
        if (tx.kind === "income") income += tx.amount;
        else expense += tx.amount;
      }
      return {
        ok: true,
        data: {
          period,
          from: range.from,
          to: range.to,
          income,
          expense,
          net: income - expense,
          currency: ctx.homeCurrency,
          tx_count: items.length,
        },
      };
    }

    if (name === "spending_by_category") {
      const period = input.period as RangeKey | undefined;
      if (!period) return { ok: false, error: "period required" };
      const kind = input.kind === "income" ? "income" : "expense";
      const range = resolveRange(period);
      const items = await listTransactions({
        ledgerId: ctx.ledgerId,
        from: range.from,
        to: range.to,
        kind,
        limit: 50000,
      });
      const map = new Map<
        string,
        { name: string; total: number }
      >();
      for (const tx of items) {
        const key = tx.category?.id ?? "__null__";
        const cur = map.get(key) ?? {
          name: tx.category?.name ?? "—",
          total: 0,
        };
        cur.total += tx.amount;
        map.set(key, cur);
      }
      const rows = Array.from(map.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, 12);
      const total = rows.reduce((s, r) => s + r.total, 0);
      return {
        ok: true,
        data: { period, kind, total, currency: ctx.homeCurrency, rows },
      };
    }

    if (name === "list_accounts") {
      const accounts = await listAccounts(ctx.ledgerId, {
        includeArchived: false,
      });
      return {
        ok: true,
        data: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency ?? ctx.homeCurrency,
          balance: a.balance,
          tx_count: a.txCount,
        })),
      };
    }

    if (name === "compare_this_month_vs_last") {
      const tzNow = nowInBusinessTz();
      const year = tzNow.getUTCFullYear();
      const month = tzNow.getUTCMonth() + 1;
      const compare = await compareMonths(ctx.ledgerId, year, month);
      return {
        ok: true,
        data: {
          this_month: { ym: `${year}-${String(month).padStart(2, "0")}` },
          totals: compare.totals,
          ups: compare.expenseUp,
          downs: compare.expenseDown,
          currency: ctx.homeCurrency,
        },
      };
    }

    return { ok: false, error: `Unknown tool: ${name}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tool failed" };
  }
}

export async function runChat(
  history: ChatMessage[],
  ctx: { ledgerId: string; homeCurrency: string; locale: string }
): Promise<{ ok: true; reply: string } | { ok: false; error: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "AI chat ต้องการ ANTHROPIC_API_KEY — ตั้งใน env แล้วรีโหลด",
    };
  }

  const langInstruction =
    ctx.locale === "en"
      ? "Reply in conversational English."
      : ctx.locale === "ja"
      ? "Reply in conversational Japanese."
      : ctx.locale === "zh"
      ? "Reply in conversational Chinese."
      : "Reply in conversational Thai (use 'เรา' or 'คุณ' for the user).";

  const today = nowInBusinessTz().toISOString().slice(0, 10);

  const client = new Anthropic({ apiKey });

  // Build the message list as the SDK expects: alternating user/assistant
  // turns. We persist tool_use + tool_result blocks across iterations
  // because the model needs to see what it asked for AND what came back.
  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      tools: TOOLS,
      system: `You are a helpful personal-finance assistant for a ledger app called Jaitang. ${langInstruction}

Today's date: ${today} (Asia/Bangkok). Home currency: ${ctx.homeCurrency}.

You have read-only tools to inspect the user's ledger. Call them as needed to answer accurately. Don't guess at numbers — always call a tool for any amount or count question.

Format guidance:
- Reply in plain prose. No markdown headings, no bullet lists unless the user explicitly asked for one.
- Format amounts as "${ctx.homeCurrency} 1,234" inline. Be specific about which period a number covers.
- Keep replies short — 1-3 sentences for simple questions, max 5-6 for breakdowns.
- Don't list every category — pick the top 2-3 unless asked.
- If the user asks something the tools can't answer (e.g. "predict my future spending"), say so honestly — don't fabricate.`,
      messages,
    });

    // Collect tool_use blocks from this turn.
    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      // Final answer — concatenate any text blocks and return.
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { ok: true, reply: text };
    }

    // Run each tool call, then append assistant + tool_result back.
    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const result = await runTool(
        tu.name,
        tu.input as Record<string, unknown>,
        { ledgerId: ctx.ledgerId, homeCurrency: ctx.homeCurrency }
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(result),
        is_error: result.ok === false,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    ok: false,
    error: "AI hit the tool-call limit — try a simpler question.",
  };
}
