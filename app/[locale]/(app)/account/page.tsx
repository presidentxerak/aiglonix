"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserCog, Users, Copy, Check, RefreshCw, LogOut, Crown } from "lucide-react";
import { useTeam } from "@/lib/team/context";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

interface Member {
  id: string;
  callsign: string;
  is_owner: boolean;
}

export default function AccountPage() {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const {
    userId,
    callsign,
    team,
    isOwner,
    teamsEnabled,
    updateCallsign,
    renameTeam,
    leaveTeam,
    regenerateCode,
  } = useTeam();

  const [email, setEmail] = useState("");
  const [name, setName] = useState(callsign);
  const [teamName, setTeamName] = useState(team?.name ?? "");
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setName(callsign), [callsign]);
  useEffect(() => setTeamName(team?.name ?? ""), [team?.name]);

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) return;
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setEmail(user?.email ?? "");
      if (team) {
        const { data } = await supabase.rpc("list_team_members");
        if (data) setMembers(data as Member[]);
      }
    })();
  }, [team]);

  async function run(fn: () => Promise<void>, ok: string, fail: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch {
      toast.error(fail);
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!team) return;
    void navigator.clipboard?.writeText(team.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="max-w-2xl mx-auto w-full px-4 py-4 space-y-6">
      <h1 className="font-bold text-lg flex items-center gap-2">
        <UserCog size={20} className="text-accent" aria-hidden />
        {t("title")}
      </h1>

      {/* Profile */}
      <div className="card p-4 space-y-3">
        <h2 className="font-bold">{t("profile")}</h2>
        <div>
          <Label htmlFor="callsign">{t("callsign")}</Label>
          <div className="flex gap-2">
            <Input
              id="callsign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              className="flex-1"
            />
            <Button
              disabled={busy || !name.trim() || name.trim() === callsign}
              onClick={() =>
                void run(
                  () => updateCallsign(name.trim()),
                  t("saved"),
                  tCommon("errors.generic"),
                )
              }
            >
              {t("save")}
            </Button>
          </div>
        </div>
        <div>
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" value={email} readOnly className="opacity-70" />
        </div>
      </div>

      {/* Team */}
      {teamsEnabled && team && (
        <div className="card p-4 space-y-4">
          <h2 className="font-bold flex items-center gap-2">
            <Users size={18} className="text-accent" aria-hidden />
            {t("team")}
          </h2>

          <div>
            <Label htmlFor="teamName">{t("teamName")}</Label>
            <div className="flex gap-2">
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                maxLength={60}
                disabled={!isOwner}
                className="flex-1"
              />
              {isOwner && (
                <Button
                  disabled={
                    busy || !teamName.trim() || teamName.trim() === team.name
                  }
                  onClick={() =>
                    void run(
                      () => renameTeam(teamName.trim()),
                      t("saved"),
                      t("ownerOnly"),
                    )
                  }
                >
                  {t("save")}
                </Button>
              )}
            </div>
            {!isOwner && (
              <p className="text-xs text-fg-muted mt-1">{t("ownerOnly")}</p>
            )}
          </div>

          <div>
            <Label>{t("inviteCode")}</Label>
            <div className="flex gap-2 items-center">
              <code className="flex-1 bg-base border border-line px-2 py-2 text-sm tabular tracking-widest">
                {team.invite_code}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={copyCode}
                aria-label={t("copy")}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
              {isOwner && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  aria-label={t("regenerate")}
                  onClick={() =>
                    void run(
                      () => regenerateCode(),
                      t("codeRegenerated"),
                      t("ownerOnly"),
                    )
                  }
                >
                  <RefreshCw size={16} />
                </Button>
              )}
            </div>
            <p className="text-xs text-fg-muted mt-1">{t("inviteHint")}</p>
          </div>

          {members.length > 0 && (
            <div>
              <Label>{t("members", { count: members.length })}</Label>
              <ul className="space-y-1 mt-1">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    {m.is_owner ? (
                      <Crown size={14} className="text-medium" aria-hidden />
                    ) : (
                      <span className="w-3.5" aria-hidden />
                    )}
                    <span className="text-fg">{m.callsign}</span>
                    {m.id === userId && (
                      <span className="text-xs text-fg-muted">({t("you")})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            variant="danger"
            className="w-full"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(t("leaveConfirm"))) return;
              void run(() => leaveTeam(), t("left"), tCommon("errors.generic"));
            }}
          >
            <LogOut size={16} aria-hidden />
            {t("leave")}
          </Button>
        </div>
      )}
    </div>
  );
}
