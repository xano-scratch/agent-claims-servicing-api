import { table, f } from "@xanots/sdk";

/**
 * The governed, versioned state machine, in data. One row says "these roles may
 * move a claim from `from_status` to `to_status`", at a given `version`.
 *
 * The rule set is VERSIONED: a `(from_status, to_status)` pair may carry several
 * rows, and the HIGHEST version governs. That is how a policy tightens over time
 * (v1 let handlers approve; v2 restricts approval to supervisors) while the change
 * stays auditable, and the deciding version rides on every decision.
 *
 * `allowed_roles` is a typed list of role names (`string[]`). The guard checks the
 * caller's role against it identically for a human and the agent identity.
 */
export const transition_rule = table({
  name: "transition_rule",
  schema: {
    from_status: f.text({ required: true }),
    to_status: f.text({ required: true }),
    allowed_roles: f.text({ required: true, array: true }),
    version: f.int({ required: true, default: 1 }),
  },
});
