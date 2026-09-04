import { defineFunction, input, s, c, ref, inp, expr, col, withFilters, fl } from "@xanots/sdk";
import { adjuster } from "../tables/adjuster.js";
import { claim } from "../tables/claim.js";
import { transition_rule } from "../tables/transition_rule.js";
import { claim_action } from "../tables/claim_action.js";

/**
 * THE shared guard. This is the ONLY place a claim's status changes, and BOTH the
 * human endpoint (`propose-transition`) and the agent endpoint (`agent/service-claim`)
 * call it with `s.function.run`. So a legal move succeeds and an illegal one is
 * refused identically, whoever asks, and every attempt is written to `claim_action`.
 *
 * Decision, in order:
 *  1. look up the actor (its role) and the claim (its current status);
 *  2. derive `actor_kind` from the actor's role (the `agent` role IS the AI identity);
 *  3. find the GOVERNING rule for this exact (from, to) hop — the highest `version`;
 *  4. allow when the actor's role is in that rule's `allowed_roles`, else refuse;
 *     with no rule at all for the hop, refuse at version 0;
 *  5. apply the move only on allow, and ALWAYS write the audit row.
 */
export const enforceTransition = defineFunction({
  name: "enforce_transition",
  input: {
    claim_id: input.int({ required: true }),
    to_status: input.text({ required: true }),
    actor_id: input.int({ required: true }),
  },
  stack: [
    s.db.get_by_id({ table: adjuster, id: inp("actor_id"), as: "actor" }),
    s.precondition({
      expr: expr(ref("actor", { safe: true }), "!=", c.null()),
      error: c.text("Unknown actor."),
      error_type: "unauthorized",
    }),
    s.db.get_by_id({ table: claim, id: inp("claim_id"), as: "claim" }),
    s.precondition({
      expr: expr(ref("claim", { safe: true }), "!=", c.null()),
      error: c.text("Claim not found."),
      error_type: "notfound",
    }),

    // The agent role IS the AI service identity; everything else is a person.
    s.set_var("actor_kind", c.text("human")),
    s.conditional({
      when: expr(ref("actor.role"), "=", c.text("agent")),
      then: [s.set_var("actor_kind", c.text("agent"))],
    }),

    // The governing rule = the highest-version row for this exact (from, to) hop.
    // No paging, so this binds a bare array; sort desc + `first` takes the top version.
    s.db.query({
      table: transition_rule,
      where: [
        expr(col("from_status"), "=", ref("claim.status")),
        expr(col("to_status"), "=", inp("to_status")),
      ],
      sort: [{ sortBy: "version", dir: "desc" }],
      as: "rules",
    }),
    s.set_var("rule", withFilters(ref("rules"), fl.first())),

    s.set_var("rule_version", c.int(0)),
    s.set_var("allowed", c.bool(false)),
    s.set_var("rule_text", c.text("")),
    s.conditional({
      when: expr(ref("rule", { safe: true }), "!=", c.null()),
      then: [
        s.set_var("rule_version", ref("rule.version")),
        // Membership: is the actor's role listed in this rule's allowed_roles?
        s.set_var("role_ok", withFilters(ref("actor.role"), fl.in(ref("rule.allowed_roles")))),
        s.conditional({
          when: expr(ref("role_ok"), "=", c.bool(true)),
          then: [
            s.set_var("allowed", c.bool(true)),
            s.set_var(
              "rule_text",
              withFilters(
                c.text("allowed: role "),
                fl.concat(ref("actor.role")),
                fl.concat(c.text(" may move ")),
                fl.concat(ref("claim.status")),
                fl.concat(c.text(" to ")),
                fl.concat(inp("to_status")),
                fl.concat(c.text(" (rule v")),
                fl.concat(ref("rule.version")),
                fl.concat(c.text(")")),
              ),
            ),
          ],
          else: [
            s.set_var(
              "rule_text",
              withFilters(
                c.text("denied: role "),
                fl.concat(ref("actor.role")),
                fl.concat(c.text(" may not move ")),
                fl.concat(ref("claim.status")),
                fl.concat(c.text(" to ")),
                fl.concat(inp("to_status")),
                fl.concat(c.text(" (rule v")),
                fl.concat(ref("rule.version")),
                fl.concat(c.text(")")),
              ),
            ),
          ],
        }),
      ],
      else: [
        s.set_var(
          "rule_text",
          withFilters(
            c.text("denied: no rule permits "),
            fl.concat(ref("claim.status")),
            fl.concat(c.text(" to ")),
            fl.concat(inp("to_status")),
          ),
        ),
      ],
    }),

    // Apply the move only on allow.
    s.conditional({
      when: expr(ref("allowed"), "=", c.bool(true)),
      then: [
        s.db.edit({
          table: claim,
          fieldName: "id",
          fieldValue: inp("claim_id"),
          row: { status: inp("to_status") },
        }),
      ],
    }),

    // ALWAYS write the audit row — this is what makes every attempt readable.
    s.db.add({
      table: claim_action,
      row: {
        claim_id: inp("claim_id"),
        actor_id: inp("actor_id"),
        actor_kind: ref("actor_kind"),
        action: "propose_transition",
        from_status: ref("claim.status"),
        to_status: inp("to_status"),
        allowed: ref("allowed"),
        rule: ref("rule_text"),
        rule_version: ref("rule_version"),
      },
      as: "action_row",
    }),
    s.db.get_by_id({ table: claim, id: inp("claim_id"), as: "final_claim" }),
  ],
  response: {
    allowed: ref("allowed"),
    rule: ref("rule_text"),
    rule_version: ref("rule_version"),
    from_status: ref("claim.status"),
    to_status: inp("to_status"),
    actor_kind: ref("actor_kind"),
    action_id: ref("action_row.id"),
    claim: ref("final_claim"),
  },
});
