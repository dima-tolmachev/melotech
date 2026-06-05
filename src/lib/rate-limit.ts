import { supabase } from "./supabase";

export const RATE_LIMIT_PER_MINUTE = Number(
  process.env.RATE_LIMIT_PER_MINUTE ?? 3,
);

/**
 * Rate limiting backed by the database so it works correctly on serverless /
 * multi-instance deployments (an in-memory counter would reset per cold start
 * and not be shared across instances).
 *
 * The brief specifies "no more than 3 generations per minute". We count
 * generation rows created in the last 60s. There's a small race window under
 * burst concurrency (two requests can both read count = 2 and both proceed);
 * acceptable for an MVP. A production version would use an atomic token bucket
 * (e.g. Redis INCR with TTL).
 */
export async function isRateLimited(): Promise<{
  limited: boolean;
  count: number;
}> {
  const { data, error } = await supabase.rpc("count_recent_generations", {
    window_seconds: 60,
  });
  if (error) {
    // Fail open: don't block generation if the rate-limit check itself errors.
    return { limited: false, count: 0 };
  }
  const count = (data as number) ?? 0;
  return { limited: count >= RATE_LIMIT_PER_MINUTE, count };
}
