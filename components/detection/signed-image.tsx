"use client";

import { useEffect, useState } from "react";

/**
 * Renders a detection photo from the PRIVATE `detections` bucket. The image is
 * never public: this fetches a short-lived signed URL via /api/storage/sign
 * (server, service role) when it mounts. Fails silently (shows nothing) if the
 * path can't be signed.
 */
export function SignedImage({
  path,
  className,
  alt = "",
}: {
  path: string;
  className?: string;
  alt?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/storage/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path }),
        });
        if (!res.ok) throw new Error("sign");
        const data = (await res.json()) as { url?: string };
        if (cancelled) return;
        if (data.url) setUrl(data.url);
        else setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (failed) return null;
  if (!url) {
    return <div className={`${className ?? ""} animate-pulse bg-raised`} aria-hidden />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} loading="lazy" className={className} />;
}
