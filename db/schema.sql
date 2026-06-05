-- Melotech distribution pipeline — full database schema.
-- Apply against a fresh Postgres/Supabase project to reproduce the backend.
-- (In the live project these were applied as ordered migrations; this file is
--  the consolidated, runnable equivalent.)

-- pgvector powers the semantic fallback cache and "similar concepts" feature.
create extension if not exists vector with schema extensions;

-- A user-submitted music concept + the platforms it targeted.
create table if not exists public.generations (
  id          uuid primary key default gen_random_uuid(),
  prompt      text not null,
  platforms   text[] not null,
  created_at  timestamptz not null default now()
);

-- One row per (generation, platform): the platform-optimized LLM output.
create table if not exists public.platform_outputs (
  id             uuid primary key default gen_random_uuid(),
  generation_id  uuid not null references public.generations(id) on delete cascade,
  platform       text not null,
  content        jsonb not null,                          -- platform-specific payload
  source         text not null default 'llm' check (source in ('llm','cache')),
  embedding      extensions.vector(1536),                 -- embedding of the source prompt
  created_at     timestamptz not null default now()
);

create index if not exists platform_outputs_generation_id_idx on public.platform_outputs (generation_id);
create index if not exists platform_outputs_platform_idx on public.platform_outputs (platform);
create index if not exists generations_created_at_idx on public.generations (created_at desc);

-- Approximate-nearest-neighbour index for semantic lookups.
create index if not exists platform_outputs_embedding_idx
  on public.platform_outputs
  using hnsw (embedding extensions.vector_cosine_ops);

-- Lock the DB down to server-side access only: RLS on, no policies, so the
-- public anon key has zero access. The app uses the service-role key.
alter table public.generations enable row level security;
alter table public.platform_outputs enable row level security;

-- Semantic fallback: nearest successful LLM output for a platform by prompt embedding.
create or replace function public.match_platform_output(
  query_embedding extensions.vector(1536),
  target_platform text,
  match_threshold float default 0.0
)
returns table (id uuid, generation_id uuid, platform text, content jsonb, similarity float)
language sql stable
as $$
  select po.id, po.generation_id, po.platform, po.content,
         1 - (po.embedding <=> query_embedding) as similarity
  from public.platform_outputs po
  where po.platform = target_platform
    and po.source = 'llm'
    and po.embedding is not null
    and 1 - (po.embedding <=> query_embedding) >= match_threshold
  order by po.embedding <=> query_embedding
  limit 1;
$$;

-- Rate limiting: count generations created in the last `window_seconds`.
create or replace function public.count_recent_generations(window_seconds int default 60)
returns int
language sql stable
as $$
  select count(*)::int
  from public.generations
  where created_at > now() - make_interval(secs => window_seconds);
$$;

-- Creative feature "Similar past concepts": nearest distinct past generations.
create or replace function public.match_similar_generations(
  query_embedding extensions.vector(1536),
  exclude_id uuid,
  match_threshold float default 0.3,
  match_count int default 3
)
returns table (id uuid, prompt text, platforms text[], created_at timestamptz, similarity float)
language sql stable
as $$
  select * from (
    -- distinct on prompt: a concept run multiple times appears once (best match)
    select distinct on (g.prompt)
      g.id, g.prompt, g.platforms, g.created_at,
      1 - (po.embedding <=> query_embedding) as similarity
    from public.platform_outputs po
    join public.generations g on g.id = po.generation_id
    where po.embedding is not null
      and g.id <> exclude_id
    order by g.prompt, po.embedding <=> query_embedding
  ) sub
  where sub.similarity >= match_threshold
  order by sub.similarity desc
  limit match_count;
$$;
