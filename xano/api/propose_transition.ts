import { query, input, s, ref, inp, auth } from "@xanots/sdk";
import { claimsApi } from "./group.js";
import { adjuster } from "../tables/adjuster.js";
import { enforceTransition } from "../functions/enforce_transition.js";

/**
 * The HUMAN path. An authenticated adjuster proposes a status move; the request
 * is handed straight to the shared `enforce_transition` guard, attributed to the
 * caller (`auth("id")`). The guard allows or refuses on the versioned rule set and
 * writes the audit row — the SAME code the agent path runs.
 */
export const proposeTransitionQuery = query({
  name: "propose-transition",
  verb: "POST",
  apiGroup: claimsApi,
  auth: adjuster,
  input: {
    claim_id: input.int({ required: true }),
    to_status: input.enum(
      ["submitted", "under_review", "approved", "denied", "paid", "closed"],
      { required: true },
    ),
  },
  stack: [
    s.function.run({
      fn: enforceTransition,
      input: {
        claim_id: inp("claim_id"),
        to_status: inp("to_status"),
        actor_id: auth("id"),
      },
      as: "guard",
    }),
  ],
  response: {
    allowed: ref("guard.allowed"),
    rule: ref("guard.rule"),
    rule_version: ref("guard.rule_version"),
    from_status: ref("guard.from_status"),
    to_status: ref("guard.to_status"),
    actor_kind: ref("guard.actor_kind"),
    claim: ref("guard.claim"),
  },
});
