import { NextResponse } from "next/server";
import type { DistrictStat } from "@/lib/types";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";

/**
 * GET /api/stats
 * Verified endorsement counts per district. In Supabase mode this calls the
 * `get_regional_endorsement_stats()` SECURITY DEFINER RPC.
 */
export async function GET() {
  const store = getStore();
  try {
    const stats: DistrictStat[] = await store.stats();
    return NextResponse.json({ stats, source: store.kind });
  } catch (err) {
    console.error("[stats] failed", err);
    return NextResponse.json({ stats: [], source: store.kind });
  }
}
