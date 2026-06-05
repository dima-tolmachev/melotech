import { PLATFORMS, type PlatformKey } from "@/lib/platforms";
import type { PlatformOutputDTO } from "@/lib/types";

/**
 * Renders a single platform's output. The content shape varies per platform,
 * so the renderer is generic: arrays become chips, everything else becomes a
 * labelled field. Adding a new platform needs no new UI code.
 */
function FieldValue({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((item, i) => (
          <span
            key={i}
            className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-xs text-violet-300"
          >
            {String(item)}
          </span>
        ))}
      </div>
    );
  }
  return <span className="text-sm text-zinc-200">{String(value)}</span>;
}

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  llm: { label: "Generated", cls: "bg-emerald-500/15 text-emerald-300" },
  cache: { label: "Cached fallback", cls: "bg-amber-500/15 text-amber-300" },
};

export function OutputCard({ output }: { output: PlatformOutputDTO }) {
  const def = PLATFORMS[output.platform as PlatformKey];
  const badge = SOURCE_BADGE[output.source] ?? SOURCE_BADGE.llm;

  return (
    <div className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-zinc-100">{def?.label ?? output.platform}</h3>
          <p className="text-xs text-zinc-500">{def?.tagline}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs ${badge.cls}`}>
          {badge.label}
          {output.source === "cache" && typeof output.similarity === "number"
            ? ` · ${(output.similarity * 100).toFixed(0)}%`
            : ""}
        </span>
      </div>

      {output.error ? (
        <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
          ⚠ {output.error} — no cached fallback available.
        </p>
      ) : (
        <dl className="flex flex-col gap-3">
          {Object.entries(output.content).map(([key, value]) => (
            <div key={key}>
              <dt className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                {key}
              </dt>
              <dd>
                <FieldValue value={value} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
