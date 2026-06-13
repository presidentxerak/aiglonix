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
 * Team membership context. Designed to degrade gracefully: if the teams
 * migration (002) has NOT been applied, `profiles` has no `team_id` column,
 * `teamsEnabled` stays false and the app behaves exactly as before (one shared
 * space, no team_id on inserts). Once the migration is applied, the gate kicks
 * in and data is scoped per team.
 */

export interface TeamInfo {
  id: string;
  name: string;
  invite_code: string;
}

interface TeamContextValue {
  status: "loading" | "ready";
  teamsEnabled: boolean;
  teamId: string | null;
  team: TeamInfo | null;
  createTeam: (name: string) => Promise<void>;
  joinTeam: (code: string) => Promise<void>;
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
          setTeam({
            id: t.id as string,
            name: t.name as string,
            invite_code: t.invite_code as string,
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

  const createTeam = useCallback(
    async (name: string) => {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.rpc("create_team", { team_name: name });
      if (error) throw error;
      await load();
    },
    [load],
  );

  const joinTeam = useCallback(
    async (code: string) => {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.rpc("join_team", { code });
      if (error) throw error;
      await load();
    },
    [load],
  );

  return (
    <TeamContext.Provider
      value={{ status, teamsEnabled, teamId, team, createTeam, joinTeam }}
    >
      {children}
    </TeamContext.Provider>
  );
}
