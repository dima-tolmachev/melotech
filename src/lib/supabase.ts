import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key.
 *
 * The frontend never talks to Supabase directly — all DB access flows through
 * our Route Handlers. RLS is enabled on every table with no policies, so the
 * public anon key has zero access; the service-role key (used here) bypasses
 * RLS. Never import this from a client component.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars",
  );
}

export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
});
