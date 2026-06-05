import { NextResponse } from "next/server";
import { isPlatformKey } from "@/lib/platforms";
import { supabase } from "@/lib/supabase";
import type { GenerationRecord, PlatformOutputDTO } from "@/lib/types";

export const runtime = "nodejs";

/**
 * GET /api/generations?platform=tiktok&limit=50
 *
 * Returns generation history (newest first). When `platform` is provided, only
 * generations that targeted that platform are returned, and their outputs are
 * narrowed to that platform.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platformParam = searchParams.get("platform");
  const limit = Math.min(Number(searchParams.get("limit") ?? 50) || 50, 100);

  const platform =
    platformParam && isPlatformKey(platformParam) ? platformParam : null;

  let query = supabase
    .from("generations")
    .select(
      "id, prompt, platforms, created_at, platform_outputs(platform, content, source)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (platform) {
    // contains: generations whose platforms[] includes the filter value.
    query = query.contains("platforms", [platform]);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Failed to load generations" },
      { status: 500 },
    );
  }

  const records: GenerationRecord[] = (data ?? []).map((g) => {
    const outputs = (g.platform_outputs ?? []) as PlatformOutputDTO[];
    return {
      id: g.id,
      prompt: g.prompt,
      platforms: g.platforms,
      created_at: g.created_at,
      // When filtering, only show the matching platform's output.
      outputs: platform
        ? outputs.filter((o) => o.platform === platform)
        : outputs,
    };
  });

  return NextResponse.json({ generations: records });
}
