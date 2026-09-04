import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, User, Loader2, ScrollText } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { api } from "@/lib/api";
import type { ActionsResponse } from "@/lib/api";
import { statusLabel, when, titleCase } from "@/lib/format";

type Filter = "agent" | "all";

export function AuditLog({ token }: { token: string }) {
  const [filter, setFilter] = useState<Filter>("agent");
  const [data, setData] = useState<ActionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api.actions(token, filter === "agent" ? "agent" : undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [token, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const claimsById = useMemo(() => {
    const m: Record<number, { claim_number: string }> = {};
    for (const c of data?.claims ?? []) m[c.id as number] = { claim_number: c.claim_number as string };
    return m;
  }, [data]);

  const adjustersById = useMemo(() => {
    const m: Record<number, { name: string; role: string }> = {};
    for (const a of data?.adjusters ?? []) m[a.id as number] = { name: a.name as string, role: a.role as string };
    return m;
  }, [data]);

  const actions = data?.actions ?? [];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ScrollText className="text-primary size-5" />
            <h2 className="text-lg font-semibold">Agent audit log</h2>
          </div>
          <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
            Every servicing attempt, newest first, with the outcome, the rule text, and the deciding rule
            version. This is the trail that proves the same guard governs a human and the agent, and that
            every agent attempt is on the record.
          </p>
        </div>
        <div className="bg-muted flex gap-1 rounded-lg p-1">
          <button
            onClick={() => setFilter("agent")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "agent" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bot className="size-3.5" /> Agent only
          </button>
          <button
            onClick={() => setFilter("all")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Human + agent
          </button>
        </div>
      </div>

      {error && (
        <div className="border-destructive/40 bg-destructive/10 mb-4 rounded-lg border p-3 text-sm">{error}</div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Claim</th>
              <th className="px-3 py-2 font-medium">Actor</th>
              <th className="px-3 py-2 font-medium">Action</th>
              <th className="px-3 py-2 font-medium">Move</th>
              <th className="px-3 py-2 font-medium">Outcome</th>
              <th className="px-3 py-2 font-medium">Rule</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-3 py-8 text-center">
                  <Loader2 className="mr-2 inline size-4 animate-spin" />
                  Loading the audit trail…
                </td>
              </tr>
            )}
            {!loading && actions.length === 0 && (
              <tr>
                <td colSpan={7} className="text-muted-foreground px-3 py-8 text-center">
                  No attempts logged yet. Run the agent or propose a transition to fill the trail.
                </td>
              </tr>
            )}
            {!loading &&
              actions.map((a) => {
                const claim = claimsById[a.claim_id as number];
                const actor = adjustersById[a.actor_id as number];
                const isAgent = (a.actor_kind as string) === "agent";
                return (
                  <tr key={a.id} className="border-t align-top">
                    <td className="text-muted-foreground px-3 py-2 whitespace-nowrap text-xs">
                      {when(a.created_at as number)}
                    </td>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">
                      {claim ? claim.claim_number : `#${a.claim_id}`}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        {isAgent ? <Bot className="text-primary size-3.5" /> : <User className="text-muted-foreground size-3.5" />}
                        {actor ? actor.name : titleCase(a.actor_kind as string)}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">{a.action as string}</td>
                    <td className="text-muted-foreground px-3 py-2 whitespace-nowrap text-xs">
                      {a.from_status && a.to_status
                        ? `${statusLabel(a.from_status as string)} → ${statusLabel(a.to_status as string)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {Boolean(a.allowed) ? (
                        <Badge variant="default">allowed</Badge>
                      ) : (
                        <Badge variant="destructive">refused</Badge>
                      )}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 text-xs">{a.rule as string}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
