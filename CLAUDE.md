# CLAUDE.md — How AI coding tools were used

This project was built with **Claude Code** (Anthropic's CLI agent) driving the
implementation, with a human in the loop making the product and architecture
decisions. This file documents that workflow honestly, as required by the brief.

## Workflow

1. **Brief intake.** The PDF brief was read and decomposed into a checklist:
   backend endpoint, per-platform LLM generation, storage, the three frontend
   views, the two constraints (rate limiting, graceful fallback), and the
   required/bonus items.

2. **Prior-art search.** Before writing code, GitHub was searched for existing
   solutions to the same case study to learn from their architecture choices
   (two public solutions existed — one monorepo + BullMQ worker, one
   NestJS + Next.js). The takeaway: both were heavier than a 1-day MVP needs.
   We deliberately chose the lightest design that still demonstrates the
   "thinking" the brief asks for.

3. **Decision points were surfaced to the human**, not assumed: scope
   (tight MVP vs. full production), LLM provider (OpenAI), and storage
   (Supabase Postgres). These shaped the stack.

4. **Build order, bottom-up:** DB schema → server libs (platform registry,
   OpenAI, Supabase, generation, rate limit) → API routes → frontend → docs →
   deploy. Each layer was kept small and reviewed before moving on.

## Where AI helped most

- **Boilerplate velocity.** Scaffolding Next.js, the TanStack Query wiring,
  Tailwind components, and the Supabase migration SQL were generated quickly.
- **Schema-as-contract pattern.** Using one Zod schema per platform as the
  single source of truth for both runtime validation and OpenAI structured
  outputs (`zodResponseFormat`) — this keeps the LLM output trustworthy.
- **pgvector gotchas.** The agent flagged that PostgREST serializes a JS array
  to `{1,2,3}` (Postgres array literal) instead of `[1,2,3]` (pgvector text
  form), so embeddings are inserted/queried as `JSON.stringify(embedding)`.

## Where human judgment overrode the default

- **Scope discipline.** The brief says "a working MVP beats a perfect
  unfinished product." We rejected the queue/worker/realtime/credits approach
  seen in prior solutions as over-engineering for one day.
- **Security.** RLS is enabled on all tables with no policies, so the public
  Supabase key has zero DB access; all reads/writes go through server-side
  Route Handlers using the service-role key.
- **Config-driven platforms.** Rather than hardcoding three platforms, the
  registry (`src/lib/platforms.ts`) makes each platform one declarative entry —
  directly addressing the brief's "50+ platforms" framing.
- **Creative feature reuses existing infra.** "Similar past concepts" (the bonus
  feature) is built on the embeddings already stored for the fallback cache —
  one new pgvector RPC, no new data plumbing. Verified end-to-end through the
  real UI (80% match surfaced for a related lo-fi concept).

## What was verified, not assumed

- The generation endpoint, rate limiting (429 after 3/min), and the semantic
  fallback path were exercised against the live OpenAI + Supabase stack before
  calling the feature done.

## Honest limitations

- Rate limiting is a DB count over a 60s window — correct for serverless but
  with a small race window under burst concurrency (noted in
  `src/lib/rate-limit.ts`). Production would use an atomic token bucket.
- No auth — rate limiting and history are global, not per-user. Adding
  per-user scoping is the natural next step.
