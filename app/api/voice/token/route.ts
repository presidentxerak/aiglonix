import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/**
 * Mint a short-lived Deepgram token so the browser can open a realtime STT
 * WebSocket without ever seeing the long-lived DEEPGRAM_API_KEY. If no key is
 * configured (or the grant fails) we report { enabled: false } and the client
 * falls back to the browser's Web Speech API - the feature still works.
 */
export async function GET() {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const key = process.env.DEEPGRAM_API_KEY?.trim();
    if (!key) {
      return NextResponse.json({ enabled: false }, { status: 200 });
    }

    const res = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        Authorization: `Token ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 60 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ enabled: false }, { status: 200 });
    }
    const data: unknown = await res.json();
    const token = (data as { access_token?: string })?.access_token;
    const expiresIn = (data as { expires_in?: number })?.expires_in ?? 60;
    if (typeof token !== "string") {
      return NextResponse.json({ enabled: false }, { status: 200 });
    }
    return NextResponse.json({ enabled: true, token, expiresIn });
  } catch {
    return NextResponse.json({ enabled: false }, { status: 200 });
  }
}
