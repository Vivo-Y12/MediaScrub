import { NextResponse } from "next/server";
import { db } from "@/db";
import { counters } from "@/db/schema";

/** Compatibility-only read endpoint; the site never calls it. No data is sent after processing. */
export async function GET() {
  if (!db) return NextResponse.json({ filesProcessed: 0 }, { headers: { "Cache-Control": "no-store" } });
  try {
    const rows = await db.select().from(counters);
    return NextResponse.json({ filesProcessed: rows.find(r => r.key === "files_processed")?.value ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ filesProcessed: 0 }, { headers: { "Cache-Control": "no-store" } });
  }
}

/** Disabled: an untrusted client must never be able to increment a public counter. */
export async function POST() {
  return NextResponse.json({ error: "The legacy telemetry endpoint is disabled" }, { status: 410 });
}
