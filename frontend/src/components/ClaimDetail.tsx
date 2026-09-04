import { useState } from "react";
import { Bot, User, Send, Loader2, Check, X, Sparkles, ArrowRight, MessageSquarePlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import { api, NEXT_STATUSES } from "@/lib/api";
import type { ClaimDetail as ClaimDetailT, Identity, Adjuster, Status } from "@/lib/api";
import { statusLabel, statusVariant, money, titleCase, when } from "@/lib/format";

export type Notice = { tone: "ok" | "blocked" | "info"; text: string } | null;

const AGENT_EXAMPLES = [
  "Advance this claim to approved",
  "Move this claim into review",
  "Mark this claim as paid",
];

function NoticeBanner({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const tone =
    notice.tone === "ok"
      ? "border-primary/40 bg-primary/10"
      : notice.tone === "blocked"
        ? "border-destructive/40 bg-destructive/10"
        : "border-border bg-muted";
  const Icon = notice.tone === "ok" ? Check : notice.tone === "blocked" ? X : Sparkles;
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${tone}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{notice.text}</span>
    </div>
  );
}

export function ClaimDetail(props: {
  detail: ClaimDetailT;
  token: string;
  current: Identity;
  adjustersById: Record<number, Adjuster>;
  notice: Notice;
  setNotice: (n: Notice) => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onChanged: () => Promise<void>;
}) {
  const { detail, token, current, adjustersById, notice, setNotice, busy, setBusy, onChanged } = props;
  const [instruction, setInstruction] = useState("");
  const [noteBody, setNoteBody] = useState("");

  const claim = detail.claim;
  if (!claim) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed py-24 text-center text-sm">
        Claim not found.
      </div>
    );
  }
  const claimId = claim.id as number;
  const status = claim.status as Status;
  const candidates = NEXT_STATUSES[status] ?? [];

  async function onPropose(to: Status) {
    setBusy(true);
    setNotice({ tone: "info", text: `Proposing ${statusLabel(to)} as ${current.name}…` });
    try {
      const r = await api.propose(token, { claim_id: claimId, to_status: to });
      setNotice(
        Boolean(r.allowed)
          ? { tone: "ok", text: `Allowed. ${String(r.rule)}` }
          : { tone: "blocked", text: `Refused. ${String(r.rule)}` },
      );
      await onChanged();
    } catch (e) {
      setNotice({ tone: "blocked", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function onAgent(text: string) {
    const instr = text.trim();
    if (!instr) return;
    setBusy(true);
    setNotice({ tone: "info", text: "Running the agent over this claim…" });
    try {
      const r = await api.serviceClaim(token, claimId, instr);
      const read = `The agent read that as target "${statusLabel(String(r.interpreted_status))}" (${String(
        r.interpretation,
      )}).`;
      setNotice(
        Boolean(r.allowed)
          ? { tone: "ok", text: `${read} Allowed: ${String(r.rule)}` }
          : { tone: "blocked", text: `${read} Refused: ${String(r.rule)}` },
      );
      setInstruction("");
      await onChanged();
    } catch (e) {
      setNotice({ tone: "blocked", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function onAddNote() {
    const body = noteBody.trim();
    if (!body) return;
    setBusy(true);
    try {
      await api.addNote(token, claimId, body);
      setNotice({ tone: "ok", text: "Note added." });
      setNoteBody("");
      await onChanged();
    } catch (e) {
      // The agent identity is refused here (403), but the attempt is still logged.
      setNotice({ tone: "blocked", text: e instanceof Error ? e.message : String(e) });
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  const assignee = adjustersById[claim.assigned_adjuster_id as number];

  return (
    <div className="flex flex-col gap-5">
      {/* Claim header */}
      <div className="rounded-lg border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{claim.claim_number}</h2>
              <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {claim.claimant_name} · {titleCase(claim.type as string)} · policy {claim.policy_ref}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">{money(claim.amount_cents as number)}</div>
            <div className="text-muted-foreground text-xs">
              {assignee ? `Assigned to ${assignee.name}` : "Unassigned"}
            </div>
          </div>
        </div>
      </div>

      <NoticeBanner notice={notice} />

      {/* Propose a transition — the human path through the shared guard */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <User className="text-muted-foreground size-4" />
          <h3 className="text-sm font-semibold">Propose a transition</h3>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          As <span className="text-foreground font-medium">{current.name}</span> ({titleCase(current.role as string)}). The
          shared guard checks the versioned rule set and either applies the move or refuses it with the
          deciding rule version.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {candidates.length === 0 && (
            <span className="text-muted-foreground text-sm">This claim is in a terminal status.</span>
          )}
          {candidates.map((to) => (
            <Button key={to} variant="outline" size="sm" disabled={busy} onClick={() => onPropose(to)}>
              <ArrowRight className="size-3.5" /> {statusLabel(to)}
            </Button>
          ))}
        </div>
      </div>

      {/* Ask the agent — the agent path through the SAME guard */}
      <div className="border-primary/30 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <Bot className="text-primary size-4" />
          <h3 className="text-sm font-semibold">Ask the agent</h3>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          A plain-language instruction. The agent interprets it into a target status, then the SAME guard
          decides, attributed to the agent identity. A legal move succeeds; an illegal one is refused
          identically to a human.
        </p>
        <Textarea
          className="mt-3"
          rows={2}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g. Advance this claim to approved"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy || !instruction.trim()} onClick={() => onAgent(instruction)}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Run agent
          </Button>
          {AGENT_EXAMPLES.map((ex) => (
            <button
              key={ex}
              disabled={busy}
              onClick={() => setInstruction(ex)}
              className="text-muted-foreground hover:text-foreground rounded-full border px-2.5 py-1 text-xs"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <MessageSquarePlus className="text-muted-foreground size-4" />
          <h3 className="text-sm font-semibold">Notes</h3>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {detail.notes.length === 0 && <p className="text-muted-foreground text-sm">No notes yet.</p>}
          {detail.notes.map((n) => {
            const author = adjustersById[n.author_id as number];
            return (
              <div key={n.id} className="bg-muted/40 rounded-md p-2.5 text-sm">
                <div className="text-muted-foreground mb-0.5 text-xs">
                  {author ? author.name : `Adjuster #${n.author_id}`} · {when(n.created_at as number)}
                </div>
                {n.body}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Textarea
            rows={2}
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Add a note (the agent identity is not permitted to)…"
          />
          <div>
            <Button variant="outline" size="sm" disabled={busy || !noteBody.trim()} onClick={onAddNote}>
              Add note
            </Button>
          </div>
        </div>
      </div>

      {/* Recent audit trail for this claim */}
      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Recent activity on this claim</h3>
        <Separator className="my-3" />
        <div className="flex flex-col gap-2">
          {detail.actions.length === 0 && <p className="text-muted-foreground text-sm">No activity yet.</p>}
          {detail.actions.map((a) => {
            const actor = adjustersById[a.actor_id as number];
            const isAgent = (a.actor_kind as string) === "agent";
            return (
              <div key={a.id} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5">
                  {isAgent ? <Bot className="text-primary size-4" /> : <User className="text-muted-foreground size-4" />}
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{actor ? actor.name : (a.actor_kind as string)}</span>
                    {Boolean(a.allowed) ? (
                      <Badge variant="default">allowed</Badge>
                    ) : (
                      <Badge variant="destructive">refused</Badge>
                    )}
                    {a.from_status && a.to_status && (
                      <span className="text-muted-foreground text-xs">
                        {statusLabel(a.from_status as string)} → {statusLabel(a.to_status as string)}
                      </span>
                    )}
                    <span className="text-muted-foreground ml-auto text-xs">{when(a.created_at as number)}</span>
                  </div>
                  <div className="text-muted-foreground text-xs">{a.rule as string}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
