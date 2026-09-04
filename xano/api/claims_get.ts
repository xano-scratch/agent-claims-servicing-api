import { query, input, s, c, ref, inp, expr, col } from "@xanots/sdk";
import { claimsApi } from "./group.js";
import { adjuster } from "../tables/adjuster.js";
import { claim } from "../tables/claim.js";
import { claim_note } from "../tables/claim_note.js";
import { claim_action } from "../tables/claim_action.js";

/**
 * Fetch one claim with everything a reviewer needs to audit it: its assigned
 * adjuster (read by field match so the `0` unassigned sentinel binds `null`
 * cleanly), its notes oldest-first, and its full `claim_action` trail newest-first
 * (human and agent interleaved).
 *
 * The claim id rides in the PATH (`get/{claim_id}`) so the route is addressable and
 * `getPath()` types the param.
 */
export const claimsGetQuery = query({
  name: "get/{claim_id}",
  verb: "GET",
  apiGroup: claimsApi,
  auth: adjuster,
  input: { claim_id: input.int({ required: true }) },
  stack: [
    s.db.get_by_id({ table: claim, id: inp("claim_id"), as: "claim" }),
    s.precondition({
      expr: expr(ref("claim", { safe: true }), "!=", c.null()),
      error: c.text("Claim not found."),
      error_type: "notfound",
    }),
    s.db.get({
      table: adjuster,
      fieldName: "id",
      fieldValue: ref("claim.assigned_adjuster_id"),
      output: ["id", "name", "email", "role"],
      as: "assignee",
    }),
    s.db.query({
      table: claim_note,
      where: expr(col("claim_id"), "=", inp("claim_id")),
      sort: [{ sortBy: "id", dir: "asc" }],
      as: "notes",
    }),
    s.db.query({
      table: claim_action,
      where: expr(col("claim_id"), "=", inp("claim_id")),
      sort: [{ sortBy: "id", dir: "desc" }],
      as: "actions",
    }),
  ],
  response: {
    claim: ref("claim"),
    assignee: ref("assignee"),
    notes: ref("notes"),
    actions: ref("actions"),
  },
});
