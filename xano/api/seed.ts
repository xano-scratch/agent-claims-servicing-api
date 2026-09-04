import { query, input, s, c, ref, inp, expr } from "@xanots/sdk";
import { claimsApi } from "./group.js";
import { adjuster } from "../tables/adjuster.js";
import { claim } from "../tables/claim.js";
import { transition_rule } from "../tables/transition_rule.js";
import { claim_note } from "../tables/claim_note.js";
import { claim_action } from "../tables/claim_action.js";

// Demo credentials — deliberately public fixtures for an ephemeral, never a real
// secret. All three identities share one password to keep the demo simple.
const PW = "password123";
const OUT = ["id", "name", "email", "role"] as const;

/**
 * Idempotent bootstrap. On an empty environment (or `reset: true`) it wipes and
 * repopulates the adjusters, the versioned rule set, the claims, and a pre-walked
 * audit trail (human and agent, allowed and refused, interleaved) so the ephemeral
 * shows a working, auditable thing at once. It always mints and returns a fresh
 * token per identity so the frontend can act as any of them.
 *
 * The rule set carries the demo's key move: `under_review -> approved` exists at
 * v1 (handlers + supervisors) AND v2 (supervisors only). The guard reads v2, so a
 * handler and the agent are both refused that hop citing rule v2.
 */
export const seedQuery = query({
  name: "seed/reset",
  verb: "POST",
  apiGroup: claimsApi,
  input: { reset: input.bool({ required: false, default: false }) },
  stack: [
    s.db.query({ table: adjuster, returnType: "count", as: "adj_count" }),
    s.set_var("do_seed", c.bool(false)),
    s.conditional({
      when: expr(inp("reset"), "=", c.bool(true)),
      then: [s.set_var("do_seed", c.bool(true))],
    }),
    s.conditional({
      when: expr(ref("adj_count"), "=", c.int(0)),
      then: [s.set_var("do_seed", c.bool(true))],
    }),
    s.conditional({
      when: expr(ref("do_seed"), "=", c.bool(true)),
      then: [
        // Wipe children first, then parents, resetting id sequences for a stable demo.
        s.db.truncate({ table: claim_action, reset: true }),
        s.db.truncate({ table: claim_note, reset: true }),
        s.db.truncate({ table: claim, reset: true }),
        s.db.truncate({ table: transition_rule, reset: true }),
        s.db.truncate({ table: adjuster, reset: true }),

        // Identities: two humans and one AI agent, all in the same auth table.
        s.db.add({
          table: adjuster,
          row: { email: "handler@claims.example", password: PW, name: "Riley Chen", role: "handler" },
          as: "op_handler",
        }),
        s.db.add({
          table: adjuster,
          row: { email: "supervisor@claims.example", password: PW, name: "Sam Okafor", role: "supervisor" },
          as: "op_super",
        }),
        s.db.add({
          table: adjuster,
          row: { email: "agent@claims.example", password: PW, name: "Servicing Agent", role: "agent" },
          as: "op_agent",
        }),

        // The versioned, data-governed state machine.
        s.db.add({
          table: transition_rule,
          row: { from_status: "submitted", to_status: "under_review", allowed_roles: c.array(["handler", "supervisor", "agent"]), version: 1 },
        }),
        s.db.add({
          table: transition_rule,
          row: { from_status: "submitted", to_status: "denied", allowed_roles: c.array(["handler", "supervisor"]), version: 1 },
        }),
        // The tightening pair: v1 let handlers approve; v2 restricts approval to supervisors.
        s.db.add({
          table: transition_rule,
          row: { from_status: "under_review", to_status: "approved", allowed_roles: c.array(["handler", "supervisor"]), version: 1 },
        }),
        s.db.add({
          table: transition_rule,
          row: { from_status: "under_review", to_status: "approved", allowed_roles: c.array(["supervisor"]), version: 2 },
        }),
        s.db.add({
          table: transition_rule,
          row: { from_status: "under_review", to_status: "denied", allowed_roles: c.array(["handler", "supervisor"]), version: 1 },
        }),
        s.db.add({
          table: transition_rule,
          row: { from_status: "approved", to_status: "paid", allowed_roles: c.array(["supervisor"]), version: 1 },
        }),
        s.db.add({
          table: transition_rule,
          row: { from_status: "paid", to_status: "closed", allowed_roles: c.array(["handler", "supervisor"]), version: 1 },
        }),
        s.db.add({
          table: transition_rule,
          row: { from_status: "denied", to_status: "closed", allowed_roles: c.array(["handler", "supervisor"]), version: 1 },
        }),

        // Claims across statuses. Some are left fresh for the live demo; three are
        // pre-walked so the audit log is populated the moment the app opens.
        s.db.add({
          table: claim,
          row: { claim_number: "CLM-1001", policy_ref: "POL-88012", claimant_name: "Dana Whitfield", type: "auto", status: "submitted", amount_cents: 182000, assigned_adjuster_id: ref("op_handler.id") },
        }),
        s.db.add({
          table: claim,
          row: { claim_number: "CLM-1002", policy_ref: "POL-44120", claimant_name: "Marcus Lee", type: "property", status: "under_review", amount_cents: 92000, assigned_adjuster_id: ref("op_handler.id") },
          as: "cl2",
        }),
        s.db.add({
          table: claim,
          row: { claim_number: "CLM-1003", policy_ref: "POL-77341", claimant_name: "Priya Nair", type: "health", status: "under_review", amount_cents: 61500, assigned_adjuster_id: ref("op_super.id") },
        }),
        s.db.add({
          table: claim,
          row: { claim_number: "CLM-1004", policy_ref: "POL-51127", claimant_name: "Owen Brady", type: "auto", status: "under_review", amount_cents: 43000, assigned_adjuster_id: ref("op_handler.id") },
        }),
        s.db.add({
          table: claim,
          row: { claim_number: "CLM-1005", policy_ref: "POL-90210", claimant_name: "Lena Torres", type: "property", status: "approved", amount_cents: 340000, assigned_adjuster_id: ref("op_super.id") },
          as: "cl5",
        }),
        s.db.add({
          table: claim,
          row: { claim_number: "CLM-1006", policy_ref: "POL-33009", claimant_name: "Aiko Tanaka", type: "health", status: "paid", amount_cents: 28000, assigned_adjuster_id: ref("op_super.id") },
          as: "cl6",
        }),
        s.db.add({
          table: claim,
          row: { claim_number: "CLM-1007", policy_ref: "POL-62215", claimant_name: "Sofia Reyes", type: "auto", status: "denied", amount_cents: 15000, assigned_adjuster_id: ref("op_handler.id") },
        }),
        s.db.add({
          table: claim,
          row: { claim_number: "CLM-1008", policy_ref: "POL-71440", claimant_name: "Noah Kim", type: "property", status: "submitted", amount_cents: 210000, assigned_adjuster_id: 0 },
        }),

        // Notes on the pre-walked claims.
        s.db.add({
          table: claim_note,
          row: { claim_id: ref("cl2.id"), author_id: ref("op_handler.id"), body: c.text("Requested the police report before deciding this one.") },
        }),
        s.db.add({
          table: claim_note,
          row: { claim_id: ref("cl5.id"), author_id: ref("op_super.id"), body: c.text("Approved after the repair estimate checked out.") },
        }),

        // CLM-1002 trail: the agent legally advanced it to review, then BOTH a
        // handler and the agent were refused the approve hop, citing rule v2.
        s.db.add({
          table: claim_action,
          row: { claim_id: ref("cl2.id"), actor_id: ref("op_agent.id"), actor_kind: "agent", action: "propose_transition", from_status: "submitted", to_status: "under_review", allowed: true, rule: c.text("allowed: role agent may move submitted to under_review (rule v1)"), rule_version: 1 },
        }),
        s.db.add({
          table: claim_action,
          row: { claim_id: ref("cl2.id"), actor_id: ref("op_handler.id"), actor_kind: "human", action: "propose_transition", from_status: "under_review", to_status: "approved", allowed: false, rule: c.text("denied: role handler may not move under_review to approved (rule v2)"), rule_version: 2 },
        }),
        s.db.add({
          table: claim_action,
          row: { claim_id: ref("cl2.id"), actor_id: ref("op_agent.id"), actor_kind: "agent", action: "propose_transition", from_status: "under_review", to_status: "approved", allowed: false, rule: c.text("denied: role agent may not move under_review to approved (rule v2)"), rule_version: 2 },
        }),
        s.db.add({
          table: claim_action,
          row: { claim_id: ref("cl2.id"), actor_id: ref("op_handler.id"), actor_kind: "human", action: "add_note", allowed: true, rule: c.text("note added"), rule_version: 0 },
        }),
        s.db.add({
          table: claim_action,
          row: { claim_id: ref("cl2.id"), actor_id: ref("op_agent.id"), actor_kind: "agent", action: "add_note", allowed: false, rule: c.text("denied: the agent identity may not add notes"), rule_version: 0 },
        }),

        // CLM-1005 trail: a clean, fully allowed path to approved (handler opened
        // review, supervisor approved under rule v2).
        s.db.add({
          table: claim_action,
          row: { claim_id: ref("cl5.id"), actor_id: ref("op_handler.id"), actor_kind: "human", action: "propose_transition", from_status: "submitted", to_status: "under_review", allowed: true, rule: c.text("allowed: role handler may move submitted to under_review (rule v1)"), rule_version: 1 },
        }),
        s.db.add({
          table: claim_action,
          row: { claim_id: ref("cl5.id"), actor_id: ref("op_super.id"), actor_kind: "human", action: "propose_transition", from_status: "under_review", to_status: "approved", allowed: true, rule: c.text("allowed: role supervisor may move under_review to approved (rule v2)"), rule_version: 2 },
        }),

        // CLM-1006 trail: supervisor paid it; the agent had been refused the pay hop.
        s.db.add({
          table: claim_action,
          row: { claim_id: ref("cl6.id"), actor_id: ref("op_super.id"), actor_kind: "human", action: "propose_transition", from_status: "approved", to_status: "paid", allowed: true, rule: c.text("allowed: role supervisor may move approved to paid (rule v1)"), rule_version: 1 },
        }),
        s.db.add({
          table: claim_action,
          row: { claim_id: ref("cl6.id"), actor_id: ref("op_agent.id"), actor_kind: "agent", action: "propose_transition", from_status: "approved", to_status: "paid", allowed: false, rule: c.text("denied: role agent may not move approved to paid (rule v1)"), rule_version: 1 },
        }),
      ],
    }),

    // Always mint fresh tokens for the three identities (idempotent across calls).
    s.db.get({ table: adjuster, fieldName: "email", fieldValue: c.text("handler@claims.example"), output: [...OUT], as: "h" }),
    s.security.create_auth_token({ table: adjuster, id: ref("h.id"), as: "h_token" }),
    s.db.get({ table: adjuster, fieldName: "email", fieldValue: c.text("supervisor@claims.example"), output: [...OUT], as: "sup" }),
    s.security.create_auth_token({ table: adjuster, id: ref("sup.id"), as: "sup_token" }),
    s.db.get({ table: adjuster, fieldName: "email", fieldValue: c.text("agent@claims.example"), output: [...OUT], as: "ag" }),
    s.security.create_auth_token({ table: adjuster, id: ref("ag.id"), as: "ag_token" }),

    s.db.query({ table: claim, sort: [{ sortBy: "id", dir: "asc" }], as: "claims_list" }),
    s.db.query({ table: adjuster, sort: [{ sortBy: "id", dir: "asc" }], output: [...OUT], as: "adjusters_list" }),
  ],
  response: {
    handler: { id: ref("h.id"), name: ref("h.name"), email: ref("h.email"), role: ref("h.role"), token: ref("h_token") },
    supervisor: { id: ref("sup.id"), name: ref("sup.name"), email: ref("sup.email"), role: ref("sup.role"), token: ref("sup_token") },
    agent: { id: ref("ag.id"), name: ref("ag.name"), email: ref("ag.email"), role: ref("ag.role"), token: ref("ag_token") },
    claims: ref("claims_list"),
    adjusters: ref("adjusters_list"),
  },
});
