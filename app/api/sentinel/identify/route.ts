import { NextResponse } from "next/server";
import {
  IdentifyInputSchema,
  AircraftIdSchema,
  IDENTIFY_SYSTEM_PROMPT,
  type AircraftId,
} from "@/lib/sentinel/identify";
import { getSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

function fallback(hint?: string): AircraftId {
  return AircraftIdSchema.parse({
    identified: false,
    name: hint ? `Unidentified (${hint})` : "Unidentified aerial object",
    category: "unknown",
    confidence: 0,
    threat_level: "medium",
    notes: "AI identification unavailable - set MISTRAL_API_KEY to enable.",
  });
}

async function identifyWithMistral(
  image: string,
  hint?: string,
): Promise<AircraftId | null> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) return null;
  const model =
    process.env.MISTRAL_VISION_MODEL?.trim() || "pixtral-large-latest";
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
          { role: "system", content: IDENTIFY_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: hint
                  ? `On-device detector suggests: ${hint}. Identify the exact system.`
                  : "Identify the exact airborne system in this photo.",
              },
              { type: "image_url", image_url: image },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const content = (
      data as { choices?: { message?: { content?: string } }[] }
    )?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const parsed = AircraftIdSchema.safeParse(JSON.parse(content));
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
    if (!(await checkRateLimit(`sentinel:${user.id}`))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = IdentifyInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result =
      (await identifyWithMistral(parsed.data.image, parsed.data.hint)) ??
      fallback(parsed.data.hint);
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
