import { table, f } from "@xanots/sdk";
import { claim } from "./claim.js";
import { adjuster } from "./adjuster.js";

/**
 * The audit row for EVERY servicing attempt, human and agent interleaved. The
 * shared guard writes one on every proposed transition (allowed or refused), and
 * the note endpoint writes one on every note attempt.
 *
 * `allowed` records the outcome, `rule` the human-readable reason (e.g. "denied:
 * role handler may not move under_review to approved (rule v2)"), and
 * `rule_version` the deciding version. `actor_kind` tags whether a person or the
 * AI agent asked. `from_status`/`to_status` are nullable (a note carries neither).
 */
export const claim_action = table({
  name: "claim_action",
  schema: {
    claim_id: f.tableRef(claim, { required: true }),
    actor_id: f.tableRef(adjuster, { required: true }),
    actor_kind: f.enum(["human", "agent"], { required: true }),
    action: f.text({ required: true }),
    from_status: f.text({ nullable: true }),
    to_status: f.text({ nullable: true }),
    allowed: f.bool({ default: false }),
    rule: f.text(),
    rule_version: f.int({ default: 0 }),
  },
});
