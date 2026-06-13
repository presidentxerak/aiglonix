"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Profile + team context. Degrades gracefully: if the teams migration (002)
 * isn't applied, `profiles` has no `team_id` column, `teamsEnabled` stays false
 * and the app behaves as one shared space. Management actions (rename/leave/...)
 * need migration 004.
 */

export interface TeamInfo {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
}

interface TeamContextValue {
  status: "loading" | "ready";
  teamsEnabled: boolean;
  userId: string | null;
  callsign: string;
  teamId: string | null;
  team: TeamInfo | null;
  isOwner: boolean;
  createTeam: (name: string) => Promise<void>;
  joinTeam: (code: string) => Promise<void>;
  updateCallsign: (name: string) => Promise<void>;
  renameTeam: (name: string) => Promise<void>;
  leaveTeam: () => Promise<void>;
  regenerateCode: () => Promise<void>;
}

const TeamContext = createContext<TeamContextValue | null>(null);

export function useTeam(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeam must be used within a TeamProvider");
  return ctx;
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [teamsEnabled, setTeamsEnabled] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [callsign, setCallsign] = useState("");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamInfo | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setStatus("ready");
      return;
    }
    try {
      const supabase = getSupabaseBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStatus("ready");
        return;
      }
      setUserId(user.id);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error || !data) {
        setStatus("ready");
        return;
      }
      const row = data as Record<string, unknown>;
      if (typeof row.callsign === "string") setCallsign(row.callsign);
      const hasTeams = "team_id" in row;
      setTeamsEnabled(hasTeams);
      const tid =
        hasTeams && typeof row.team_id === "string" ? row.team_id : null;
      setTeamId(tid);
      if (tid) {
        const { data: t } = await supabase
          .from("teams")
          .select("*")
          .eq("id", tid)
          .single();
        if (t) {
          const tr = t as Record<string, unknown>;
          setTeam({
            id: tr.id as string,
            name: tr.name as string,
            invite_code: tr.invite_code as string,
            created_by:
              typeof tr.created_by === "string" ? tr.created_by : null,
          });
        }
      } else {
        setTeam(null);
      }
    } catch {
      // network/permission error -> stay in shared mode
    } finally {
      setStatus("ready");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rpc = useCallback(
    async (fn: string, args?: Record<string, unknown>) => {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.rpc(fn, args);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const createTeam = useCallback(
    (name: string) => rpc("create_team", { team_name: name }),
    [rpc],
  );
  const joinTeam = useCallback(
    (code: string) => rpc("join_team", { code }),
    [rpc],
  );
  const updateCallsign = useCallback(
    (name: string) => rpc("update_callsign", { new_callsign: name }),
    [rpc],
  );
  const renameTeam = useCallback(
    (name: string) => rpc("rename_team", { new_name: name }),
    [rpc],
  );
  const leaveTeam = useCallback(() => rpc("leave_team"), [rpc]);
  const regenerateCode = useCallback(
    () => rpc("regenerate_invite_code"),
    [rpc],
  );

  const isOwner = Boolean(team && userId && team.created_by === userId);

  return (
    <TeamContext.Provider
      value={{
        status,
        teamsEnabled,
        userId,
        callsign,
        teamId,
        team,
        isOwner,
        createTeam,
        joinTeam,
        updateCallsign,
        renameTeam,
        leaveTeam,
        regenerateCode,
      }}
    >
      {children}
    </TeamContext.Provider>
  );
}
