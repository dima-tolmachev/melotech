# Melotech — Multi-Platform Distribution Pipeline

Turn one raw music concept into platform-optimized content for Spotify, TikTok,
YouTube — and, by design, dozens more. Built for the Melotech full-stack case
study.

![stack](https://img.shields.io/badge/Next.js-15-black) ![db](https://img.shields.io/badge/Supabase-Postgres%20%2B%20pgvector-3ECF8E) ![llm](https://img.shields.io/badge/OpenAI-gpt--4o--mini-412991)

## What it does

1. You submit a music concept and pick target platforms (multi-select).
2. The backend generates a **different, platform-optimized output per platform**
   in parallel via an LLM with structured (schema-validated) output.
3. Results are stored and shown **side-by-side**.
4. A **history** view lets you browse past generations, filtered by platform.

## Architecture

| Layer    | Choice                                                            |
| -------- | ---------------------------------------------------------------- |
| Frontend | Next.js 15 (App Router), React 19, Tailwind v4, TanStack Query   |
| Backend  | Next.js Route Handlers (`/api/generate`, `/api/generations`)     |
| LLM      | OpenAI `gpt-4o-mini`, structured outputs via Zod schemas         |
| Storage  | Supabase Postgres; `pgvector` for the semantic fallback cache    |

### Key design ideas

- **Config-driven platforms** (`src/lib/platforms.ts`). Each platform is one
  declarative entry: a Zod output schema (the single source of truth for both
  validation *and* the LLM's structured-output contract) + a prompt builder.
  Supporting a new platform = adding one entry. The API, storage, and UI all
  adapt automatically — directly addressing the brief's "50+ platforms".
- **Trustworthy LLM output.** Generation uses OpenAI structured outputs bound
  to the Zod schema, then re-validates. Output is never stored unvalidated.
- **Graceful degradation.** If an LLM call fails, the pipeline falls back to the
  most semantically-similar past output for that platform (pgvector cosine
  similarity) and labels it as a cached result, instead of failing the request.
- **Rate limiting** at ≤ 3 generations/minute, backed by the DB so it holds on
  serverless/multi-instance deployments.
- **Creative feature — "Similar past concepts".** After each generation, the
  pipeline surfaces the most semantically-similar past concepts (pgvector
  cosine similarity over the stored prompt embeddings) with a match score and a
  one-click "Use concept" action. Reuses the exact embedding layer that powers
  the fallback cache — useful for a 50-platform catalog where you want to avoid
  re-treading ideas and quickly riff on what worked.
- **Locked-down DB.** RLS is on with no policies; only server-side code (with
  the service-role key) can touch the database.

## Constraints from the brief — how they're met

| Constraint                                  | Where                                  |
| ------------------------------------------- | -------------------------------------- |
| `{ prompt, target_platforms }` endpoint     | `src/app/api/generate/route.ts`        |
| Per-platform optimized LLM output           | `src/lib/platforms.ts` + `generate.ts` |
| Store results with platform metadata        | `generations` + `platform_outputs`     |
| Return all platforms simultaneously         | `Promise.all` in the generate route    |
| Platform selector (multi-select)            | `src/app/page.tsx`                      |
| Side-by-side comparison                     | `src/app/page.tsx`                      |
| History with platform filter               | `src/components/HistoryPanel.tsx`      |
| Rate limiting (3/min)                       | `src/lib/rate-limit.ts`                |
| Graceful fallback on LLM failure            | `src/lib/generate.ts` (semantic cache) |

## Local setup

```bash
pnpm install
cp .env.example .env.local   # fill in the values
pnpm dev
```

Required env vars (see `.env.example`):

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RATE_LIMIT_PER_MINUTE` (default 3)

The full database schema (tables, RLS, pgvector HNSW index, and the
`match_platform_output`, `count_recent_generations`, and
`match_similar_generations` functions) is in [`db/schema.sql`](./db/schema.sql)
— run it against a fresh Supabase/Postgres project to reproduce the backend.

## API

### `POST /api/generate`

```jsonc
// request
{ "prompt": "dreamy lo-fi about city drives", "target_platforms": ["spotify", "tiktok", "youtube"] }

// response
{
  "id": "uuid",
  "prompt": "...",
  "platforms": ["spotify", "tiktok", "youtube"],
  "created_at": "...",
  "results": [
    { "platform": "spotify", "content": { ... }, "source": "llm" },
    { "platform": "tiktok",  "content": { ... }, "source": "cache", "similarity": 0.91 }
  ]
}
```

### `GET /api/generations?platform=tiktok`

Returns generation history (newest first), optionally filtered by platform.

## AI tooling

See [CLAUDE.md](./CLAUDE.md) for how AI coding tools were used during the build.
