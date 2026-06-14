import { NextResponse } from "next/server";
import { GeocodeInputSchema } from "@/lib/voice/types";
import { searchPlaces } from "@/lib/geocode";
import { getSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

/** Autocomplete: ranked place candidates for a partial query. */
export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await checkRateLimit(`voice:${user.id}`))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = GeocodeInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const results = await searchPlaces(parsed.data.query, parsed.data.near, 5);
    return NextResponse.json({ results }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
