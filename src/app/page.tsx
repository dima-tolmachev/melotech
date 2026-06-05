"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { OutputCard } from "@/components/OutputCard";
import { HistoryPanel } from "@/components/HistoryPanel";
import { SimilarConcepts } from "@/components/SimilarConcepts";
import { generate } from "@/lib/api-client";
import { PLATFORM_KEYS, PLATFORMS, type PlatformKey } from "@/lib/platforms";
import type { GenerateResponse } from "@/lib/types";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState<Set<PlatformKey>>(
    new Set(PLATFORM_KEYS),
  );
  const queryClient = useQueryClient();

  const mutation = useMutation<GenerateResponse, Error>({
    mutationFn: () => generate(prompt, [...selected]),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generations"] });
    },
  });

  function togglePlatform(key: PlatformKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const canSubmit =
    prompt.trim().length > 0 && selected.size > 0 && !mutation.isPending;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-50">
          🎵 Melotech Distribution Pipeline
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          One music concept → platform-optimized content for every channel.
        </p>
      </header>

      {/* --- Generation form --- */}
      <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          Music concept
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. A dreamy lo-fi track about late-night city drives, nostalgic and warm"
          rows={3}
          className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-100 outline-none focus:border-violet-500"
        />

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-zinc-300">
            Target platforms
          </p>
          <div className="flex flex-wrap gap-2">
            {PLATFORM_KEYS.map((key) => {
              const active = selected.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => togglePlatform(key)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    active
                      ? "border-violet-500 bg-violet-500/15 text-violet-200"
                      : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  <span className="block font-medium">{PLATFORMS[key].label}</span>
                  <span className="block text-xs opacity-70">
                    {PLATFORMS[key].tagline}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          className="mt-5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition enabled:hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mutation.isPending ? "Generating…" : "Generate"}
        </button>

        {mutation.isError && (
          <p className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
            {mutation.error.message}
          </p>
        )}
      </section>

      {/* --- Side-by-side comparison of the latest run --- */}
      {mutation.data && (
        <section className="mb-12">
          <h2 className="mb-4 text-lg font-semibold text-zinc-100">
            Latest results
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mutation.data.results.map((output, i) => (
              <OutputCard key={`${output.platform}-${i}`} output={output} />
            ))}
          </div>
        </section>
      )}

      {/* --- Creative feature: similar past concepts --- */}
      {mutation.data && (
        <SimilarConcepts
          items={mutation.data.similar}
          onReuse={(p) => {
            setPrompt(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {/* --- History with platform filter --- */}
      <HistoryPanel />
    </main>
  );
}
