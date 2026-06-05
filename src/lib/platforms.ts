import { z } from "zod";

/**
 * Config-driven platform registry.
 *
 * Melotech distributes to 50+ platforms, each with different output
 * requirements. Rather than hardcoding three branches, every platform is a
 * declarative entry: an output schema (the single source of truth for both
 * runtime validation and the LLM's structured-output contract) plus a prompt
 * builder. Supporting a new platform = adding one entry here. Nothing else in
 * the pipeline — API, storage, frontend — needs to change.
 */

export interface PlatformDefinition<S extends z.ZodTypeAny = z.ZodTypeAny> {
  /** Stable key used in the API and DB. */
  key: string;
  /** Human label for the UI. */
  label: string;
  /** What this platform optimizes for — shown in the UI. */
  tagline: string;
  /** Output shape: drives both Zod validation and OpenAI structured output. */
  schema: S;
  /** System instruction describing the platform's content requirements. */
  system: string;
  /** Builds the user prompt from the raw music concept. */
  buildUserPrompt: (concept: string) => string;
}

// --- Spotify: full streaming metadata ---------------------------------------
const spotifySchema = z.object({
  title: z.string().describe("Catchy track title"),
  genre: z.string().describe("Primary genre"),
  mood: z.string().describe("Overall mood/vibe"),
  bpm: z.number().int().describe("Tempo in beats per minute"),
  instruments: z.array(z.string()).describe("Key instruments featured"),
  description: z.string().describe("Streaming-platform description, 1-2 sentences"),
});

// --- TikTok: short hook + trending hashtags ---------------------------------
const tiktokSchema = z.object({
  hook: z.string().describe("Punchy hook description for a short-form clip"),
  hashtags: z
    .array(z.string())
    .describe("Exactly 3 trending, relevant hashtags including the # symbol"),
});

// --- YouTube: SEO-optimized listing -----------------------------------------
const youtubeSchema = z.object({
  title: z.string().describe("SEO-optimized, click-worthy video title"),
  description: z.string().describe("SEO-rich description, 2-4 sentences"),
  tags: z.array(z.string()).describe("Relevant SEO search tags"),
});

export const PLATFORMS = {
  spotify: {
    key: "spotify",
    label: "Spotify",
    tagline: "Full streaming metadata",
    schema: spotifySchema,
    system:
      "You are a music metadata specialist preparing a track for Spotify. " +
      "Produce complete, accurate streaming metadata. Be specific and realistic.",
    buildUserPrompt: (concept) =>
      `Generate Spotify metadata for this music concept:\n\n"${concept}"`,
  },
  tiktok: {
    key: "tiktok",
    label: "TikTok",
    tagline: "Hook + trending hashtags",
    schema: tiktokSchema,
    system:
      "You are a TikTok growth strategist. Craft a scroll-stopping hook and " +
      "exactly 3 trending, relevant hashtags (each starting with #) for a " +
      "short-form clip built around the music concept.",
    buildUserPrompt: (concept) =>
      `Create a TikTok hook and 3 hashtags for this music concept:\n\n"${concept}"`,
  },
  youtube: {
    key: "youtube",
    label: "YouTube",
    tagline: "SEO title + description + tags",
    schema: youtubeSchema,
    system:
      "You are a YouTube SEO expert. Produce a search-optimized title, a " +
      "keyword-rich description, and relevant tags to maximize discoverability " +
      "for a music video built around the concept.",
    buildUserPrompt: (concept) =>
      `Generate SEO-optimized YouTube metadata for this music concept:\n\n"${concept}"`,
  },
} satisfies Record<string, PlatformDefinition>;

export type PlatformKey = keyof typeof PLATFORMS;

export const PLATFORM_KEYS = Object.keys(PLATFORMS) as PlatformKey[];

export function isPlatformKey(value: string): value is PlatformKey {
  return value in PLATFORMS;
}

export function getPlatform(key: PlatformKey): PlatformDefinition {
  return PLATFORMS[key];
}
