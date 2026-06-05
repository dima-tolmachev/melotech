"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchGenerations } from "@/lib/api-client";
import { PLATFORM_KEYS, PLATFORMS, type PlatformKey } from "@/lib/platforms";
import { OutputCard } from "./OutputCard";

type Filter = PlatformKey | "all";

export function HistoryPanel() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["generations", filter],
    queryFn: () => fetchGenerations(filter),
  });

  const filters: Filter[] = ["all", ...PLATFORM_KEYS];

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-lg font-semibold text-zinc-100">History</h2>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm transition ${
              filter === f
                ? "bg-violet-500 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {f === "all" ? "All" : PLATFORMS[f].label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-zinc-500">Loading history…</p>}
      {isError && <p className="text-sm text-red-400">Failed to load history.</p>}
      {data && data.length === 0 && (
        <p className="text-sm text-zinc-500">
          No generations yet. Create one above.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {data?.map((gen) => (
          <div
            key={gen.id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <p className="text-sm text-zinc-300">“{gen.prompt}”</p>
              <time className="shrink-0 text-xs text-zinc-600">
                {new Date(gen.created_at).toLocaleString()}
              </time>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gen.outputs.map((o, i) => (
                <OutputCard key={`${gen.id}-${o.platform}-${i}`} output={o} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
