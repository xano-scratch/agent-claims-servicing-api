import { table, f } from "@xanots/sdk";
import { adjuster } from "./adjuster.js";

/**
 * An insurance claim, the subject of the governed state machine. `status` moves
 * only through the transitions the `transition_rule` table permits, and only via
 * the shared `enforce_transition` guard.
 *
 * `assigned_adjuster_id` is an OPTIONAL foreign key, so it uses the `0` sentinel
 * (`required: true, default: 0`) rather than `nullable` — a null in an int FK is
 * unqueryable (see the SDK's field notes), and `0` reads back cleanly as "unset".
 */
export const claim = table({
  name: "claim",
  schema: {
    claim_number: f.text({ required: true }),
    policy_ref: f.text({ required: true }),
    claimant_name: f.text({ required: true }),
    type: f.enum(["auto", "property", "health"], { required: true }),
    status: f.enum(
      ["submitted", "under_review", "approved", "denied", "paid", "closed"],
      { required: true },
    ),
    amount_cents: f.int({ required: true, default: 0 }),
    assigned_adjuster_id: f.tableRef(adjuster, { required: true, default: 0 }),
  },
  index: [{ type: "unique", fields: [{ name: "claim_number" }] }],
});
