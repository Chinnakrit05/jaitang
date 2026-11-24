import { createClient } from "@supabase/supabase-js";
import { auditHeaders } from "@/lib/audit-context";

/**
 * Server-side Supabase client using the service-role key.
 * Bypasses RLS — only use from server code (route handlers, server actions).
 * Never import this from a client component.
 *
 * Every request carries who is writing and from which screen (see
 * audit-context.ts), for the change_log trigger. A new client per call
 * is what lets those headers follow the action that is running.
 */
export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: auditHeaders() },
  });
}
