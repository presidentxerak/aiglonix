import { NextResponse } from "next/server";
import {
  PlaceIdentifyInputSchema,
  PlaceVisionSchema,
  PlaceIdSchema,
  PLACE_SYSTEM_PROMPT,
  type PlaceVision,
} from "@/lib/place/identify";
import { geocodePlace } from "@/lib/geocode";
import { getSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/ratelimit";

async function recognise(image: string): Promise<PlaceVision | null> {
  const key = process.env.MISTRAL_API_KEY?.trim();
  if (!key) return null;
  const model =
    process.env.MISTRAL_VISION_MODEL?.trim() || "mistral-large-latest";
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
          { role: "system", content: PLACE_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify the place in this photo." },
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
    const parsed = PlaceVisionSchema.safeParse(JSON.parse(content));
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
    const parsed = PlaceIdentifyInputSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const vision = await recognise(parsed.data.image);
    if (!vision) {
      return NextResponse.json(
        { error: "Recognition unavailable" },
        { status: 422 },
      );
    }

    // geocode the recognised name precisely (name + city for disambiguation)
    const query = vision.city ? `${vision.name}, ${vision.city}` : vision.name;
    const geo = await geocodePlace(query);

    const result = PlaceIdSchema.parse({
      ...vision,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      display_name: geo?.display_name ?? null,
    });
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
