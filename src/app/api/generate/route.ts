import { NextResponse } from "next/server";
import { z } from "zod";
import { generateForPlatform } from "@/lib/generate";
import { embed } from "@/lib/openai";
import { isPlatformKey, PLATFORM_KEYS } from "@/lib/platforms";
import { isRateLimited, RATE_LIMIT_PER_MINUTE } from "@/lib/rate-limit";
import { supabase } from "@/lib/supabase";
import type { GenerateResponse } from "@/lib/types";

export const runtime = "nodejs";

const bodySchema = z.object({
  prompt: z.string().trim().min(1, "prompt is required").max(2000),
  target_platforms: z
    .array(z.string())
    .min(1, "select at least one platform")
    .refine((arr) => arr.every(isPlatformKey), {
      message: `platforms must be one of: ${PLATFORM_KEYS.join(", ")}`,
    }),
});

export async function POST(request: Request) {
  // 1. Validate input.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const { prompt } = parsed.data;
  // Dedupe + narrow to typed platform keys.
  const platforms = [...new Set(parsed.data.target_platforms)].filter(
    isPlatformKey,
  );

  // 2. Rate limit (≤ N generations/minute).
  const { limited } = await isRateLimited();
  if (limited) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded: max ${RATE_LIMIT_PER_MINUTE} generations per minute. Try again shortly.`,
      },
      { status: 429 },
    );
  }

  // 3. Embed the concept once — used both to seed the semantic cache and to
  //    find fallbacks if a platform's generation fails. Best-effort: if
  //    embedding fails we still generate, just without the semantic safety net.
  let embedding: number[] | null = null;
  try {
    embedding = await embed(prompt);
  } catch {
    embedding = null;
  }

  // 4. Generate for all selected platforms in parallel.
  const results = await Promise.all(
    platforms.map((platform) =>
      generateForPlatform(platform, prompt, embedding),
    ),
  );

  // 5. Persist the generation and its successful outputs.
  const { data: generation, error: genErr } = await supabase
    .from("generations")
    .insert({ prompt, platforms })
    .select("id, created_at")
    .single();

  if (genErr || !generation) {
    return NextResponse.json(
      { error: "Failed to store generation" },
      { status: 500 },
    );
  }

  const rows = results
    .filter((r) => !r.error)
    .map((r) => ({
      generation_id: generation.id,
      platform: r.platform,
      content: r.content,
      source: r.source,
      // Only fresh LLM outputs seed the cache; pgvector text form "[...]".
      embedding:
        r.source === "llm" && embedding ? JSON.stringify(embedding) : null,
    }));

  if (rows.length > 0) {
    await supabase.from("platform_outputs").insert(rows);
  }

  const response: GenerateResponse = {
    id: generation.id,
    prompt,
    platforms,
    created_at: generation.created_at,
    results: results.map((r) => ({
      platform: r.platform,
      content: r.content,
      source: r.source,
      similarity: r.similarity,
      error: r.error,
    })),
  };

  return NextResponse.json(response, { status: 200 });
}
