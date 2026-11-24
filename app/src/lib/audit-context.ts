import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Who is writing, and from which screen — for the change_log trigger.
 *
 * The server reaches Supabase with the service-role key, so the database
 * sees one anonymous writer for everybody. getServerSupabase() reads the
 * scope here and sends it as two request headers, x-jaitang-actor and
 * x-jaitang-via; PostgREST exposes request headers to the trigger, which
 * files them next to the row it logs. A write with no scope still logs,
 * with both empty.
 *
 * The scope lives in AsyncLocalStorage rather than being passed down,
 * because the writes happen deep in lib/ (setRecurringMonthAmount,
 * deleteTransaction, …) behind signatures that never needed a user.
 */

/** Through which screen a write came. Stored as text, so adding one
 *  needs no migration — only a label in messages (history.via.*). */
export type AuditVia =
  | "form" // /transactions/new, the edit page, the list's delete
  | "quick" // quick add
  | "reports" // /reports inline edits and rows
  | "scan" // a scanned receipt — saved as items, or added to a rule
  | "import" // Numbers import, or the image import on /reports
  | "recurring" // /recurring and the recurring panel
  | "restore" // restoring a backup file
  | "wipe" // the danger zone on /settings
  | "recategorize" // AI re-categorising
  | "trip"; // taking a row out of a trip, or deleting the trip

type AuditScope = { actor: string | null; via: AuditVia | null };

const storage = new AsyncLocalStorage<AuditScope>();

/**
 * Open the scope for the request that is running, or return the one it
 * already has. requireSession() calls this BEFORE its first await, which
 * is what makes it work: the synchronous start of an async function runs
 * in its caller's context, so the scope lands on the action that awaited
 * requireSession and on everything that action does afterwards. Opened
 * after an await, it would only exist inside requireSession.
 *
 * Reusing an open scope keeps a `via` set earlier in the action when
 * something deeper calls requireSession() again.
 */
export function openAuditScope(): AuditScope {
  const open = storage.getStore();
  if (open) return open;
  const scope: AuditScope = { actor: null, via: null };
  storage.enterWith(scope);
  return scope;
}

/** Name the screen for every write the current action makes from here on. */
export function setAuditVia(via: AuditVia): void {
  const open = storage.getStore();
  if (open) open.via = via;
  else storage.enterWith({ actor: null, via });
}

/** The headers getServerSupabase() attaches. Empty outside any scope. */
export function auditHeaders(): Record<string, string> {
  const scope = storage.getStore();
  const headers: Record<string, string> = {};
  if (scope?.actor) headers["x-jaitang-actor"] = scope.actor;
  if (scope?.via) headers["x-jaitang-via"] = scope.via;
  return headers;
}

/**
 * Run `fn` as a request of its own, with no scope inherited. Tests use
 * it to stand in for separate requests; nothing in the app needs it.
 */
export function runAsNewRequest<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run(undefined as unknown as AuditScope, fn);
}
