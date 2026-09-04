import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, User, Bot, Loader2, AlertCircle, RotateCcw, ScrollText, LayoutList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { api } from "@/lib/api";
import type { Identity, IdentityKey, Claim, Adjuster, ClaimDetail as ClaimDetailT } from "@/lib/api";
import { statusLabel, statusVariant, money, titleCase } from "@/lib/format";
import { ClaimDetail, type Notice } from "@/components/ClaimDetail";
import { AuditLog } from "@/components/AuditLog";

const IDENTITY_KEYS: IdentityKey[] = ["handler", "supervisor", "agent"];
const DEMO_PW = "password123";
type View = "workspace" | "audit";

function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function App() {
  const [identities, setIdentities] = useState<Record<IdentityKey, Identity> | null>(null);
  const [currentKey, setCurrentKey] = useState<IdentityKey>(() => {
    const p = readParam("as");
    return p === "supervisor" || p === "agent" || p === "handler" ? p : "handler";
  });
  const [claims, setClaims] = useState<Claim[]>([]);
  const [adjusters, setAdjusters] = useState<Adjuster[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ClaimDetailT | null>(null);
  const [view, setView] = useState<View>(() => (readParam("view") === "audit" ? "audit" : "workspace"));
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const current: Identity | null = identities ? identities[currentKey] : null;
  const token = current?.token ?? "";

  const adjustersById = useMemo(() => {
    const map: Record<number, Adjuster> = {};
    for (const a of adjusters) map[a.id as number] = a;
    return map;
  }, [adjusters]);

  // Bootstrap: seed the environment (idempotent), then sign in as each identity
  // through the real login endpoint so their tokens are freshly minted.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const seed = await api.seed();
        const emails: Record<IdentityKey, string> = {
          handler: seed.handler.email as string,
          supervisor: seed.supervisor.email as string,
          agent: seed.agent.email as string,
        };
        const [h, s, a] = await Promise.all([
          api.login(emails.handler, DEMO_PW),
          api.login(emails.supervisor, DEMO_PW),
          api.login(emails.agent, DEMO_PW),
        ]);
        if (!live) return;
        setIdentities({ handler: h, supervisor: s, agent: a });
        setClaims(seed.claims as Claim[]);
        setAdjusters(seed.adjusters as Adjuster[]);
        setSelectedId(seed.claims[0]?.id ?? null);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const loadList = useCallback(async () => {
    if (!token) return;
    try {
      const r = await api.listClaims(token, statusFilter === "all" ? undefined : statusFilter);
      setClaims(r.claims);
      setAdjusters(r.adjusters);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [token, statusFilter]);

  const loadDetail = useCallback(async () => {
    if (!token || selectedId == null) {
      setDetail(null);
      return;
    }
    try {
      setDetail(await api.getClaim(token, selectedId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [token, selectedId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function switchTo(key: IdentityKey) {
    setCurrentKey(key);
    setNotice(null);
  }

  async function onReset() {
    setBusy(true);
    setNotice(null);
    try {
      await api.seed(true);
      await Promise.all([loadList(), loadDetail()]);
      setNotice({ tone: "info", text: "Demo data reset to a clean slate." });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const refresh = useCallback(async () => {
    await Promise.all([loadList(), loadDetail()]);
  }, [loadList, loadDetail]);

  const filtered = claims;

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-primary size-5" />
                <h1 className="text-xl font-semibold tracking-tight">Agent Claims-Servicing API</h1>
              </div>
              <p className="text-muted-foreground max-w-2xl text-sm">
                A human adjuster and an AI agent call the same permissioned, logged endpoints. An illegal
                claim action is refused the same way for both, and every agent attempt is written to an
                audit trail.
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="secondary">Play 4 · Agent Intelligence Layer</Badge>
                <Badge variant="secondary">Insurance · claims</Badge>
                <Badge variant="outline">API-layer RBAC</Badge>
              </div>
            </div>

            {/* Login / role picker: sign in as a handler, a supervisor, or the agent identity. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs font-medium">Signed in as</span>
              <div className="bg-muted flex gap-1 rounded-lg p-1">
                {IDENTITY_KEYS.map((k) => {
                  const id = identities?.[k];
                  const active = k === currentKey;
                  return (
                    <button
                      key={k}
                      onClick={() => switchTo(k)}
                      disabled={!id}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {k === "agent" ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
                      {id ? (id.name as string) : titleCase(k)}
                    </button>
                  );
                })}
              </div>
              {current && (
                <span className="text-muted-foreground text-right text-xs">
                  {titleCase(current.role as string)} · {current.email as string} · password{" "}
                  <code className="bg-muted rounded px-1 py-0.5">{DEMO_PW}</code>
                </span>
              )}
            </div>
          </div>

          {/* View toggle + reset */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="bg-muted flex gap-1 rounded-lg p-1">
              <button
                onClick={() => setView("workspace")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === "workspace"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutList className="size-3.5" /> Claims workspace
              </button>
              <button
                onClick={() => setView("audit")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  view === "audit"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ScrollText className="size-3.5" /> Agent audit log
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={onReset} disabled={busy}>
              <RotateCcw className="size-3.5" /> Reset demo data
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {error && (
          <div className="border-destructive/40 bg-destructive/10 mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm">
            <AlertCircle className="text-destructive size-4" />
            {error}
          </div>
        )}

        {!ready ? (
          <div className="text-muted-foreground flex items-center gap-2 py-20 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Seeding the environment and signing in…
          </div>
        ) : view === "audit" ? (
          <AuditLog token={token} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="mb-3 flex flex-wrap gap-1">
                {["all", "submitted", "under_review", "approved", "denied", "paid", "closed"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                      statusFilter === s
                        ? "border-primary bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "all" ? "All" : statusLabel(s)}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {filtered.map((c) => {
                  const assignee = adjustersById[c.assigned_adjuster_id as number];
                  const selected = c.id === selectedId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedId(c.id as number);
                        setNotice(null);
                      }}
                      className={`flex flex-col gap-1 rounded-lg border p-3 text-left transition-colors ${
                        selected ? "border-primary bg-accent/40" : "hover:bg-accent/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{c.claim_number}</span>
                        <Badge variant={statusVariant(c.status as string)}>{statusLabel(c.status as string)}</Badge>
                      </div>
                      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                        <span>
                          {c.claimant_name} · {titleCase(c.type as string)}
                        </span>
                        <span>{money(c.amount_cents as number)}</span>
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {assignee ? `Assigned to ${assignee.name}` : "Unassigned"}
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                    No claims match this filter.
                  </div>
                )}
              </div>
            </aside>

            <section>
              {detail && current ? (
                <ClaimDetail
                  key={selectedId ?? "none"}
                  detail={detail}
                  token={token}
                  current={current}
                  adjustersById={adjustersById}
                  notice={notice}
                  setNotice={setNotice}
                  busy={busy}
                  setBusy={setBusy}
                  onChanged={refresh}
                />
              ) : (
                <div className="text-muted-foreground flex items-center justify-center rounded-lg border border-dashed py-24 text-sm">
                  Select a claim to see its status, the moves your role may make, and its audit trail.
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
