import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import type { SimilarConcept } from "@/lib/types";

/**
 * Creative feature UI: shows past concepts semantically similar to the one just
 * generated, so users can see what they've explored before and reuse a concept.
 */
export function SimilarConcepts({
  items,
  onReuse,
}: {
  items: SimilarConcept[];
  onReuse: (prompt: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mb-12">
      <h2 className="mb-1 text-lg font-semibold text-zinc-100">
        Similar past concepts
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        You&apos;ve explored related ideas before (matched by meaning, via
        embeddings).
      </p>
      <div className="flex flex-col gap-2">
        {items.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-zinc-200">“{c.prompt}”</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-sky-300">
                  {(c.similarity * 100).toFixed(0)}% match
                </span>
                {c.platforms.map((p) => (
                  <span key={p} className="text-zinc-500">
                    {PLATFORMS[p as PlatformKey]?.label ?? p}
                  </span>
                ))}
                <time>{new Date(c.created_at).toLocaleDateString()}</time>
              </div>
            </div>
            <button
              onClick={() => onReuse(c.prompt)}
              className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-violet-500 hover:text-violet-200"
            >
              Use concept
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
