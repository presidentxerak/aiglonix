"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { useTeam } from "@/lib/team/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/brand/logo";

/**
 * Blocks the app until the operator belongs to a team - but ONLY when the
 * teams migration is applied (teamsEnabled). Otherwise it's a transparent
 * pass-through (shared mode, unchanged behaviour).
 */
export function TeamGate({ children }: { children: ReactNode }) {
  const { status, teamsEnabled, teamId, createTeam, joinTeam } = useTeam();
  const t = useTranslations("team");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (status === "loading") {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Logo size={44} className="animate-pulse" />
      </div>
    );
  }
  if (!teamsEnabled || teamId) return <>{children}</>;

  async function handleCreate() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createTeam(name.trim());
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }
  async function handleJoin() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      await joinTeam(code.trim());
    } catch {
      toast.error(t("joinError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Logo size={48} className="mx-auto mb-3" />
          <h1 className="font-bold text-xl">{t("title")}</h1>
          <p className="text-sm text-fg-muted mt-1">{t("subtitle")}</p>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="font-bold flex items-center gap-2">
            <Users size={18} className="text-accent" aria-hidden />
            {t("createTitle")}
          </h2>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={60}
          />
          <Button
            className="w-full"
            disabled={busy || !name.trim()}
            onClick={() => void handleCreate()}
          >
            {t("createCta")}
          </Button>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="font-bold">{t("joinTitle")}</h2>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={t("codePlaceholder")}
            maxLength={6}
            className="uppercase tabular tracking-widest"
          />
          <Button
            variant="secondary"
            className="w-full"
            disabled={busy || !code.trim()}
            onClick={() => void handleJoin()}
          >
            {t("joinCta")}
          </Button>
        </div>
      </div>
    </div>
  );
}
