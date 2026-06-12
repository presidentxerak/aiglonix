import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServer, getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Short-lived signed URLs for the PRIVATE `detections` bucket (§2.7.6).
 * Detection images are never publicly reachable; authenticated operators
 * obtain a 1-hour URL through this route.
 */

const SignRequestSchema = z.object({
  // `${userId uuid}/${detectionId uuid}.jpg`
  path: z
    .string()
    .max(128)
    .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i),
});

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const parsed = SignRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.storage
      .from("detections")
      .createSignedUrl(parsed.data.path, 3600);
    if (error || !data) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
