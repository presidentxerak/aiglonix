"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Clock, CheckCheck, SendHorizonal } from "lucide-react";
import {
  MessageInputSchema,
  MessageRowSchema,
  ProfileRowSchema,
} from "@/lib/schemas";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import { syncManager } from "@/lib/offline/sync";
import { useNetwork } from "@/components/shell/network-provider";
import { useTeam } from "@/lib/team/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatDateTime } from "@/lib/utils";

const CHANNEL = "ops";

interface DisplayMessage {
  client_id: string;
  user_id: string | null;
  body: string;
  sent_at: string;
  status: "pending" | "synced";
}

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

/**
 * Anti-phishing rendering (§2.7.3): URLs in messages are NEVER clickable.
 * The domain is highlighted and a warning is attached - a poisoned link in
 * tactical chat is the most likely attack vector.
 */
function SafeBody({ body, warning }: { body: string; warning: string }) {
  const parts = body.split(URL_REGEX);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (!part) return null;
        if (URL_REGEX.test(part)) {
          URL_REGEX.lastIndex = 0;
          let domain = part;
          try {
            domain = new URL(
              part.startsWith("http") ? part : `https://${part}`,
            ).hostname;
          } catch {
            // keep raw text as domain label
          }
          return (
            <span
              key={i}
              className="inline-block border border-high/40 bg-raised px-1 text-high rounded-[4px]"
            >
              <span className="font-bold">{domain}</span>{" "}
              <span className="text-xs text-fg-muted">- {warning}</span>
            </span>
          );
        }
        URL_REGEX.lastIndex = 0;
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export default function GhostSignalPage() {
  const t = useTranslations("ghost");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const { online } = useNetwork();
  const { teamId } = useTeam();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [callsigns, setCallsigns] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [selfId, setSelfId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Initial load: synced messages + local outbox, then Realtime subscription
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Outbox first - works fully offline
      const queue = await import("@/lib/offline/queue").then((m) =>
        m.listQueue(),
      );
      const pending: DisplayMessage[] = queue
        .filter((item) => item.kind === "message")
        .map((item) => ({
          client_id: item.payload.client_id,
          user_id: null,
          body: item.payload.body,
          sent_at: item.payload.sent_at,
          status: "pending" as const,
        }));
      if (!cancelled && pending.length > 0) {
        setMessages((prev) => mergeMessages(prev, pending));
      }

      if (!isSupabaseConfigured()) return;
      const supabase = getSupabaseBrowser();
      try {
        const [{ data: rows, error }, { data: profiles }, { data: auth }] =
          await Promise.all([
            supabase
              .from("messages")
              .select("*")
              .eq("channel", CHANNEL)
              .order("sent_at", { ascending: true })
              .limit(300),
            supabase.from("profiles").select("*"),
            supabase.auth.getUser(),
          ]);
        if (error) throw error;
        if (cancelled) return;
        setSelfId(auth.user?.id ?? null);
        const signs: Record<string, string> = {};
        for (const p of profiles ?? []) {
          const parsed = ProfileRowSchema.safeParse(p);
          if (parsed.success) signs[parsed.data.id] = parsed.data.callsign;
        }
        setCallsigns(signs);
        const synced: DisplayMessage[] = (rows ?? [])
          .map((row: unknown) => MessageRowSchema.safeParse(row))
          .filter((r) => r.success)
          .map((r) => ({
            client_id: r.data.client_id,
            user_id: r.data.user_id,
            body: r.data.body,
            sent_at: r.data.sent_at,
            status: "synced" as const,
          }));
        setMessages((prev) => mergeMessages(synced, prev));
      } catch {
        if (!cancelled && navigator.onLine) {
          toast.error(tCommon("errors.generic"));
        }
      }
    })();

    if (!isSupabaseConfigured()) {
      return () => {
        cancelled = true;
      };
    }
    const supabase = getSupabaseBrowser();
    const channel = supabase
      .channel("ghost-signal-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const parsed = MessageRowSchema.safeParse(payload.new);
          if (parsed.success && parsed.data.channel === CHANNEL) {
            setMessages((prev) =>
              mergeMessages(prev, [
                {
                  client_id: parsed.data.client_id,
                  user_id: parsed.data.user_id,
                  body: parsed.data.body,
                  sent_at: parsed.data.sent_at,
                  status: "synced",
                },
              ]),
            );
          }
        },
      )
      .subscribe();

    // Outbox cascade: each delivered item flips its badge ⏳ → ✅ (staggered
    // 120ms by the sync worker - the queue visibly drains, §2.5 moment 4)
    const offSynced = syncManager.on("synced", (item) => {
      if (item.kind !== "message") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.client_id === item.payload.client_id
            ? { ...m, status: "synced" }
            : m,
        ),
      );
    });

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
      offSynced();
    };
  }, [tCommon]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  // Client timestamp is ground truth (§8): chronological order by sent_at
  const sorted = useMemo(
    () => [...messages].sort((a, b) => a.sent_at.localeCompare(b.sent_at)),
    [messages],
  );

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const payload = MessageInputSchema.safeParse({
      client_id: crypto.randomUUID(),
      channel: CHANNEL,
      body: body.trim(),
      sent_at: new Date().toISOString(),
    });
    if (!payload.success) return;
    setBody("");
    // Immediate local write + optimistic UI - outbox pattern (§8)
    setMessages((prev) =>
      mergeMessages(prev, [
        {
          client_id: payload.data.client_id,
          user_id: selfId,
          body: payload.data.body,
          sent_at: payload.data.sent_at,
          status: "pending",
        },
      ]),
    );
    try {
      await syncManager.submit({
        kind: "message",
        id: payload.data.client_id,
        payload: payload.data,
        team_id: teamId,
        queued_at: new Date().toISOString(),
      });
    } catch {
      toast.error(tCommon("errors.generic"));
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] md:h-dvh max-w-3xl mx-auto w-full">
      <div className="px-4 py-3 border-b border-line">
        <h1 className="font-bold text-lg">{t("title")}</h1>
        <p className="text-xs text-fg-muted">
          {online ? t("subtitle") : t("offlineInfo")}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {sorted.length === 0 && (
          <p className="text-sm text-fg-muted text-center py-12">
            {t("empty")}
          </p>
        )}
        {sorted.map((m) => {
          const own = m.user_id === null || m.user_id === selfId;
          return (
            <div
              key={m.client_id}
              className={cn("flex", own ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "card max-w-[85%] px-3 py-2 text-sm",
                  own && "border-l-2 border-l-accent",
                )}
              >
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-xs font-bold text-fg-muted">
                    {m.user_id ? (callsigns[m.user_id] ?? "Operator") : "-"}
                  </span>
                  <span className="text-xs text-fg-disabled tabular">
                    {formatDateTime(m.sent_at, locale)}
                  </span>
                </div>
                <SafeBody body={m.body} warning={t("externalLink")} />
                <div
                  className={cn(
                    "mt-1 flex items-center gap-1 text-xs transition-colors duration-300",
                    m.status === "pending" ? "text-offline" : "text-ok",
                  )}
                >
                  {m.status === "pending" ? (
                    <Clock size={12} aria-hidden />
                  ) : (
                    <CheckCheck size={12} aria-hidden />
                  )}
                  {m.status === "pending" ? t("pending") : t("synced")}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => void handleSend(e)}
        className="flex gap-2 border-t border-line p-3"
      >
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("placeholder")}
          maxLength={2000}
          aria-label={t("placeholder")}
        />
        <Button
          type="submit"
          disabled={body.trim().length === 0}
          aria-label={tCommon("actions.send")}
        >
          <SendHorizonal size={18} aria-hidden />
        </Button>
      </form>
    </div>
  );
}

/** Merge by client_id - synced state always wins over pending. */
function mergeMessages(
  base: DisplayMessage[],
  incoming: DisplayMessage[],
): DisplayMessage[] {
  const map = new Map<string, DisplayMessage>();
  for (const m of base) map.set(m.client_id, m);
  for (const m of incoming) {
    const existing = map.get(m.client_id);
    if (!existing || existing.status === "pending") {
      map.set(m.client_id, {
        ...m,
        user_id: m.user_id ?? existing?.user_id ?? null,
      });
    }
  }
  return [...map.values()];
}
