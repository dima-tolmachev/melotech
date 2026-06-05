import { zodResponseFormat } from "openai/helpers/zod";
import { GENERATION_MODEL, openai } from "./openai";
import { getPlatform, type PlatformKey } from "./platforms";
import { supabase } from "./supabase";
import type { SimilarConcept } from "./types";

export type OutputSource = "llm" | "cache";

export interface PlatformResult {
  platform: PlatformKey;
  /** Platform-specific structured payload (shape defined by the platform schema). */
  content: Record<string, unknown>;
  /** 'llm' = freshly generated; 'cache' = semantic fallback after an LLM failure. */
  source: OutputSource;
  /** Cosine similarity of the cached match (only present when source === 'cache'). */
  similarity?: number;
  /** Set when generation failed AND no cached fallback was available. */
  error?: string;
}

/** Call the LLM for one platform and validate the structured output with Zod. */
async function generateWithLLM(
  platform: PlatformKey,
  concept: string,
): Promise<Record<string, unknown>> {
  const def = getPlatform(platform);

  const completion = await openai.beta.chat.completions.parse({
    model: GENERATION_MODEL,
    messages: [
      { role: "system", content: def.system },
      { role: "user", content: def.buildUserPrompt(concept) },
    ],
    response_format: zodResponseFormat(def.schema, "platform_output"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) throw new Error("LLM returned no parseable output");

  // Defense in depth: re-validate even though the API enforces the schema.
  return def.schema.parse(parsed) as Record<string, unknown>;
}

/**
 * Graceful degradation: when the LLM call fails, look up the most semantically
 * similar past output for the same platform via pgvector cosine similarity and
 * return it as a cached result.
 */
async function semanticFallback(
  platform: PlatformKey,
  embedding: number[],
): Promise<{ content: Record<string, unknown>; similarity: number } | null> {
  const { data, error } = await supabase.rpc("match_platform_output", {
    // pgvector expects the text form "[1,2,3]"; PostgREST would turn a raw JS
    // array into the Postgres array literal "{1,2,3}", which won't cast.
    query_embedding: JSON.stringify(embedding),
    target_platform: platform,
    match_threshold: 0,
  });

  if (error || !data || data.length === 0) return null;

  const match = data[0] as { content: Record<string, unknown>; similarity: number };
  return { content: match.content, similarity: match.similarity };
}

/**
 * Creative feature: find past concepts semantically similar to this one.
 * Reuses the stored prompt embeddings — surfaces "you've explored this before".
 */
export async function findSimilarConcepts(
  embedding: number[],
  excludeId: string,
): Promise<SimilarConcept[]> {
  const { data, error } = await supabase.rpc("match_similar_generations", {
    query_embedding: JSON.stringify(embedding),
    exclude_id: excludeId,
    match_threshold: 0.3,
    match_count: 3,
  });
  if (error || !data) return [];
  return data as SimilarConcept[];
}

/**
 * Generate output for a single platform with graceful fallback.
 *
 * Order of operations:
 *   1. Try the LLM (structured + validated).
 *   2. On failure, fall back to the nearest cached output for this platform.
 *   3. If there's nothing to fall back to, return an error result.
 */
export async function generateForPlatform(
  platform: PlatformKey,
  concept: string,
  embedding: number[] | null,
): Promise<PlatformResult> {
  try {
    const content = await generateWithLLM(platform, concept);
    return { platform, content, source: "llm" };
  } catch (llmError) {
    // Semantic fallback is only possible when we have an embedding to search by.
    const fallback = embedding ? await semanticFallback(platform, embedding) : null;
    if (fallback) {
      return {
        platform,
        content: fallback.content,
        source: "cache",
        similarity: fallback.similarity,
      };
    }
    return {
      platform,
      content: {},
      source: "llm",
      error:
        llmError instanceof Error ? llmError.message : "Generation failed",
    };
  }
}
