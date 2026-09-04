import { query, input, s, ref, inp, cmp, col } from "@xanots/sdk";
import { claimsApi } from "./group.js";
import { adjuster } from "../tables/adjuster.js";
import { claim } from "../tables/claim.js";

/**
 * List claims (any authenticated identity), oldest first, optionally filtered by
 * status. `status` is free text so an absent value simply drops the filter
 * (`ignoreEmpty`) and a bad one returns no rows, rather than a 400 at the boundary.
 *
 * Also returns a lightweight adjuster roster (no password) so the board can show
 * who a claim is assigned to by name.
 */
export const claimsListQuery = query({
  name: "list",
  verb: "GET",
  apiGroup: claimsApi,
  auth: adjuster,
  input: { status: input.text({ required: false }) },
  stack: [
    s.db.query({
      table: claim,
      where: cmp(col("status"), "=", inp("status"), { ignoreEmpty: true }),
      sort: [{ sortBy: "id", dir: "asc" }],
      as: "claims",
    }),
    s.db.query({
      table: adjuster,
      sort: [{ sortBy: "id", dir: "asc" }],
      output: ["id", "name", "email", "role"],
      as: "adjusters",
    }),
  ],
  response: { claims: ref("claims"), adjusters: ref("adjusters") },
});
