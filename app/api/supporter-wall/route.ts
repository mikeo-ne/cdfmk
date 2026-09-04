import { NextResponse } from "next/server";
import type { WallEntry } from "@/lib/types";
import { getStore } from "@/lib/server/store";

export const runtime = "nodejs";

/**
 * GET /api/supporter-wall
 * Public, privacy-masked feed. In Supabase mode this reads the
 * `public_supporter_wall` view (names masked by SQL, verified rows only).
 */
export async function GET() {
  const store = getStore();
  try {
    const entries: WallEntry[] = await store.wall(60);
    return NextResponse.json({ entries, source: store.kind });
  } catch (err) {
    console.error("[supporter-wall] failed", err);
    return NextResponse.json({ entries: [], source: store.kind });
  }
}
