import { query, input, s, ref, inp, cmp, col } from "@xanots/sdk";
import { claimsApi } from "./group.js";
import { adjuster } from "../tables/adjuster.js";
import { claim } from "../tables/claim.js";
import { claim_action } from "../tables/claim_action.js";

/**
 * The audit log. Every servicing attempt, newest first, with an optional
 * `actor_kind` filter (the demo filters to `agent`). Each row carries `allowed`,
 * the `rule` outcome, and the deciding `rule_version` — the trail a Director of AI
 * reads to see exactly what agents tried and how the rules answered.
 *
 * A small claim lookup (id, number, status) and the adjuster roster ride along so
 * the log renders claim numbers and actor names without a second round trip.
 */
export const actionsQuery = query({
  name: "actions",
  verb: "GET",
  apiGroup: claimsApi,
  auth: adjuster,
  input: { actor_kind: input.text({ required: false }) },
  stack: [
    s.db.query({
      table: claim_action,
      where: cmp(col("actor_kind"), "=", inp("actor_kind"), { ignoreEmpty: true }),
      sort: [{ sortBy: "id", dir: "desc" }],
      as: "actions",
    }),
    s.db.query({
      table: claim,
      sort: [{ sortBy: "id", dir: "asc" }],
      output: ["id", "claim_number", "status", "type"],
      as: "claims",
    }),
    s.db.query({
      table: adjuster,
      sort: [{ sortBy: "id", dir: "asc" }],
      output: ["id", "name", "role"],
      as: "adjusters",
    }),
  ],
  response: {
    actions: ref("actions"),
    claims: ref("claims"),
    adjusters: ref("adjusters"),
  },
});
