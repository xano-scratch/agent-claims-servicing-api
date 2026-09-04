import { table, f } from "@xanots/sdk";
import { claim } from "./claim.js";
import { adjuster } from "./adjuster.js";

/**
 * A free-text note on a claim, written by a human adjuster. Adding one is
 * role-guarded (the agent identity may not), and every attempt, allowed or
 * refused, is mirrored into `claim_action`.
 */
export const claim_note = table({
  name: "claim_note",
  schema: {
    claim_id: f.tableRef(claim, { required: true }),
    author_id: f.tableRef(adjuster, { required: true }),
    body: f.text({ required: true }),
  },
});
