// The one contract: paths and request/response TYPES come from the xanots query
// defs, never hand-typed. Change a def and everything here follows.
//
//   • `import type` for shapes — InferInput/InferResponse erase to nothing.
//   • Import the lean def VALUE for getPath()/verb — but NOT the agent endpoint:
//     its stack builds the LLM graph (s.ai.agent.run), so importing its value
//     would pull that graph into the browser bundle. Its path/verb live in the
//     ROUTES table below and only its TYPE is imported (type-only, erased).
import type { InferInput, InferResponse } from "@xanots/sdk";

import { seedQuery } from "../../../xano/api/seed.js";
import { loginQuery } from "../../../xano/api/login.js";
import { claimsListQuery } from "../../../xano/api/claims_list.js";
import { claimsGetQuery } from "../../../xano/api/claims_get.js";
import { proposeTransitionQuery } from "../../../xano/api/propose_transition.js";
import { addNoteQuery } from "../../../xano/api/add_note.js";
import { actionsQuery } from "../../../xano/api/actions.js";
import type { agentServiceClaimQuery } from "../../../xano/api/agent_service_claim.js";

/** The deployed backend URL — injected as window.XANO_HOST by `deploy --static`. */
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

// Stack-heavy escape hatch: plain metadata, no def import, no agent graph in the
// bundle. Kept in sync with `npx xanots routes xano/index.ts`.
export const ROUTES = {
  agentService: { path: "/api:claims/agent/service-claim", verb: "POST" },
} as const;

// ── Types derived from the defs ──────────────────────────────────────────────
export type SeedResponse = InferResponse<typeof seedQuery>;
export type IdentityKey = "handler" | "supervisor" | "agent";
// Seed identities come from a `db.get` (a row is `T | null`); strip the
// nullability the seeded values never actually carry — still def-derived, so a
// field rename stays a compile error.
export type Identity = { [K in keyof SeedResponse["handler"]]-?: NonNullable<SeedResponse["handler"][K]> };

export type ListResponse = InferResponse<typeof claimsListQuery>;
export type Claim = ListResponse["claims"][number];
export type Adjuster = ListResponse["adjusters"][number];

export type ClaimDetail = InferResponse<typeof claimsGetQuery>;
export type ClaimNote = ClaimDetail["notes"][number];
export type ClaimActionRow = ClaimDetail["actions"][number];

export type ProposeBody = InferInput<typeof proposeTransitionQuery>;
export type ProposeResponse = InferResponse<typeof proposeTransitionQuery>;
export type AgentServiceResponse = InferResponse<typeof agentServiceClaimQuery>;
export type ActionsResponse = InferResponse<typeof actionsQuery>;

/** The claim status union, derived straight from the propose-transition input enum. */
export type Status = NonNullable<ProposeBody["to_status"]>;

export const ALL_STATUSES: Status[] = [
  "submitted",
  "under_review",
  "approved",
  "denied",
  "paid",
  "closed",
];

// The candidate next moves per status (the demo's known state graph). The GUARD
// still decides permission; these only populate the "propose" buttons.
export const NEXT_STATUSES: Record<Status, Status[]> = {
  submitted: ["under_review", "denied"],
  under_review: ["approved", "denied"],
  approved: ["paid"],
  denied: ["closed"],
  paid: ["closed"],
  closed: [],
};

// ── One fetch helper, with a bounded retry on the ephemeral's transient 401/429 ─
async function call<T>(path: string, method: string, token?: string, body?: unknown): Promise<T> {
  const maxTries = token ? 3 : 1;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const res = await fetch(XANO_HOST + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return (await res.json()) as T;

    // A freshly minted token can lag on the ephemeral gateway (401), and bursty
    // use can rate-limit (429). Retry those briefly; surface anything else.
    if ((res.status === 401 || res.status === 429) && attempt < maxTries - 1) {
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
      continue;
    }
    let message = res.statusText;
    try {
      const text = await res.text();
      const parsed = JSON.parse(text) as { message?: string };
      message = parsed.message || text || message;
    } catch {
      /* keep statusText */
    }
    lastErr = new Error(message);
    break;
  }
  throw lastErr instanceof Error ? lastErr : new Error("Request failed");
}

export const api = {
  seed: (reset = false) =>
    call<SeedResponse>(seedQuery.getPath(), seedQuery.verb, undefined, { reset }),
  login: (email: string, password: string) =>
    call<Identity>(loginQuery.getPath(), loginQuery.verb, undefined, { email, password }),
  listClaims: (token: string, status?: string) =>
    call<ListResponse>(
      claimsListQuery.getPath() + (status ? `?status=${encodeURIComponent(status)}` : ""),
      claimsListQuery.verb,
      token,
    ),
  getClaim: (token: string, claimId: number) =>
    call<ClaimDetail>(
      claimsGetQuery.getPath({ params: { claim_id: String(claimId) } }),
      claimsGetQuery.verb,
      token,
    ),
  propose: (token: string, body: ProposeBody) =>
    call<ProposeResponse>(proposeTransitionQuery.getPath(), proposeTransitionQuery.verb, token, body),
  addNote: (token: string, claimId: number, noteBody: string) =>
    call<{ allowed: boolean }>(addNoteQuery.getPath(), addNoteQuery.verb, token, {
      claim_id: claimId,
      body: noteBody,
    }),
  actions: (token: string, actorKind?: string) =>
    call<ActionsResponse>(
      actionsQuery.getPath() + (actorKind ? `?actor_kind=${encodeURIComponent(actorKind)}` : ""),
      actionsQuery.verb,
      token,
    ),
  serviceClaim: (token: string, claimId: number, instruction: string) =>
    call<AgentServiceResponse>(ROUTES.agentService.path, ROUTES.agentService.verb, token, {
      claim_id: claimId,
      instruction,
    }),
};
