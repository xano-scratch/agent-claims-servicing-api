import { query, input, s, c, ref, inp, expr, col } from "@xanots/sdk";
import { claimsApi } from "./group.js";
import { adjuster } from "../tables/adjuster.js";
import { claim } from "../tables/claim.js";
import { claimInterpreter } from "../agents/claim_interpreter.js";
import { enforceTransition } from "../functions/enforce_transition.js";

/**
 * The AGENT path (Play 4). A permissioned, logged endpoint an agent calls to
 * service a claim from a plain-language instruction.
 *
 *  1. `s.ai.agent.run` interprets the instruction into a target status (it only
 *     reads intent; it does not decide permission);
 *  2. the SAME `enforce_transition` guard the human path uses then allows or
 *     refuses the move, attributed to the seeded agent identity (`actor_kind=agent`).
 *
 * So a legal action succeeds and an illegal one is refused with the deciding rule
 * version, exactly as for a human, and every attempt is written to the audit trail.
 */
export const agentServiceClaimQuery = query({
  name: "agent/service-claim",
  verb: "POST",
  apiGroup: claimsApi,
  auth: adjuster,
  input: {
    claim_id: input.int({ required: true }),
    instruction: input.text({ required: true }),
  },
  stack: [
    s.db.get_by_id({ table: claim, id: inp("claim_id"), as: "claim0" }),
    s.precondition({
      expr: expr(ref("claim0", { safe: true }), "!=", c.null()),
      error: c.text("Claim not found."),
      error_type: "notfound",
    }),

    // The AI service identity every agent attempt is attributed to.
    s.db.query({
      table: adjuster,
      where: expr(col("role"), "=", c.text("agent")),
      returnType: "single",
      as: "agent_identity",
    }),
    s.precondition({
      expr: expr(ref("agent_identity", { safe: true }), "!=", c.null()),
      error: c.text("No agent identity is seeded."),
      error_type: "standard",
    }),

    // Interpret the instruction into a target status (the live LLM step).
    s.ai.agent.run({
      agent: claimInterpreter,
      args: {
        instruction: inp("instruction"),
        current_status: ref("claim0.status"),
        claim_number: ref("claim0.claim_number"),
      },
      as: "run",
    }),

    // Run the SAME guard as the human path, as the agent identity.
    s.function.run({
      fn: enforceTransition,
      input: {
        claim_id: inp("claim_id"),
        to_status: ref("run.result.target_status"),
        actor_id: ref("agent_identity.id"),
      },
      as: "guard",
    }),
  ],
  response: {
    interpreted_status: ref("run.result.target_status"),
    interpretation: ref("run.result.interpretation"),
    allowed: ref("guard.allowed"),
    rule: ref("guard.rule"),
    rule_version: ref("guard.rule_version"),
    from_status: ref("guard.from_status"),
    to_status: ref("guard.to_status"),
    actor_kind: ref("guard.actor_kind"),
    claim: ref("guard.claim"),
  },
});
