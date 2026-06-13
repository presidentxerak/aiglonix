"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plug, KeyRound, Trash2, Copy, Check } from "lucide-react";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function ConnectorsPage() {
  const t = useTranslations("connectors");
  const tCommon = useTranslations("common");
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const origin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );
  const endpoint = `${origin}/api/connectors/ingest`;

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.rpc("list_api_keys");
      if (error) throw error;
      setKeys((data as ApiKeyRow[]) ?? []);
    } catch {
      toast.error(tCommon("errors.generic"));
    }
  }, [tCommon]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase.rpc("create_api_key", {
        key_name: name.trim(),
      });
      if (error) throw error;
      setFreshKey(data as string);
      setName("");
      await load();
    } catch {
      toast.error(tCommon("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  async function revokeKey(id: string) {
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.rpc("revoke_api_key", { key_id: id });
      if (error) throw error;
      toast.success(t("revoked"));
      await load();
    } catch {
      toast.error(tCommon("errors.generic"));
    }
  }

  function copy(text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const curl = `curl -X POST ${endpoint} \\
  -H "Authorization: Bearer aglx_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"kind":"detection","lat":48.8584,"lng":2.2945,"drone_type":"airplane","confidence":0.92}'`;

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-4 space-y-6">
      <div>
        <h1 className="font-bold text-lg flex items-center gap-2">
          <Plug size={20} className="text-accent" aria-hidden />
          {t("title")}
        </h1>
        <p className="text-xs text-fg-muted mt-1">{t("subtitle")}</p>
      </div>

      {/* New key reveal */}
      {freshKey && (
        <div className="card card-critical p-4 space-y-2">
          <p className="text-sm font-bold">{t("newKeyTitle")}</p>
          <p className="text-xs text-fg-muted">{t("newKeyWarn")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate bg-base border border-line px-2 py-1.5 text-xs tabular">
              {freshKey}
            </code>
            <Button size="sm" onClick={() => copy(freshKey)}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setFreshKey(null)}
          >
            {t("done")}
          </Button>
        </div>
      )}

      {/* Create */}
      <div className="card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <KeyRound size={18} className="text-accent" aria-hidden />
          {t("createLabel")}
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={60}
            className="flex-1"
          />
          <Button disabled={busy || !name.trim()} onClick={() => void createKey()}>
            {t("createCta")}
          </Button>
        </div>
      </div>

      {/* Key list */}
      <div className="card divide-y divide-line">
        {keys.length === 0 ? (
          <p className="p-4 text-sm text-fg-muted">{t("noKeys")}</p>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {k.name}
                  {k.revoked_at && (
                    <span className="ml-2 text-xs text-critical">
                      {t("revokedTag")}
                    </span>
                  )}
                </p>
                <p className="text-xs text-fg-muted tabular">
                  {k.key_prefix}…
                </p>
              </div>
              {!k.revoked_at && (
                <button
                  type="button"
                  onClick={() => void revokeKey(k.id)}
                  aria-label={t("revoke")}
                  className="text-fg-muted hover:text-critical transition-colors cursor-pointer p-2"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Docs */}
      <div className="card p-4 space-y-3">
        <h2 className="font-bold">{t("docsTitle")}</h2>
        <p className="text-sm text-fg-muted">{t("docsIntro")}</p>
        <div>
          <p className="text-xs text-fg-muted mb-1">{t("endpoint")}</p>
          <code className="block bg-base border border-line px-2 py-1.5 text-xs tabular break-all">
            POST {endpoint}
          </code>
        </div>
        <div>
          <p className="text-xs text-fg-muted mb-1">{t("example")}</p>
          <pre className="bg-base border border-line p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">
            {curl}
          </pre>
        </div>
        <p className="text-xs text-fg-muted">{t("kinds")}</p>
      </div>
    </div>
  );
}
