import type { GenerateResponse, GenerationRecord } from "./types";
import type { PlatformKey } from "./platforms";

export async function generate(
  prompt: string,
  targetPlatforms: PlatformKey[],
): Promise<GenerateResponse> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, target_platforms: targetPlatforms }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? "Generation failed");
  }
  return data as GenerateResponse;
}

export async function fetchGenerations(
  platform: PlatformKey | "all",
): Promise<GenerationRecord[]> {
  const qs = platform === "all" ? "" : `?platform=${platform}`;
  const res = await fetch(`/api/generations${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Failed to load history");
  return (data.generations ?? []) as GenerationRecord[];
}
