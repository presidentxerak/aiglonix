import { NextResponse } from "next/server";
import {
  VoiceExtractInputSchema,
  ExtractedPlaceSchema,
  type ExtractedPlace,
} from "@/lib/voice/types";
import { heuristicExtract, EXTRACT_SYSTEM_PROMPT } from "@/lib/voice/extract";
import { getSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

/**
 * Turn a spoken transcript into a structured place + action. Uses Mistral when
 * MISTRAL_API_KEY is set, otherwise a deterministic heuristic so the pipeline
 * works with zero external keys. The API key never reaches the client.
 */
async function extractWithMistral(
  transcript: string,
): Promise<ExtractedPlace | null> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.MISTRAL_MODEL?.trim() || "mistral-small-latest";
  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: EXTRACT_SYSTEM_PROMPT },
          { role: "user", content: transcript },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const content = (
      data as { choices?: { message?: { content?: string } }[] }
    )?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const parsed = ExtractedPlaceSchema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allowed = await checkRateLimit(`voice:${user.id}`);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = VoiceExtractInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const place =
      (await extractWithMistral(parsed.data.transcript)) ??
      heuristicExtract(parsed.data.transcript);

    return NextResponse.json(place, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
