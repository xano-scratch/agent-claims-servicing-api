import { query, input, s, c, ref, inp, auth, expr } from "@xanots/sdk";
import { claimsApi } from "./group.js";
import { adjuster } from "../tables/adjuster.js";
import { claim } from "../tables/claim.js";
import { claim_note } from "../tables/claim_note.js";
import { claim_action } from "../tables/claim_action.js";

/**
 * Add a note to a claim. Role-guarded: the agent identity may NOT add notes. The
 * refused attempt is still written to `claim_action` (so the audit trail records
 * what the agent tried), and then the request is refused with 403. A human's note
 * is written and logged as an allowed action.
 */
export const addNoteQuery = query({
  name: "add-note",
  verb: "POST",
  apiGroup: claimsApi,
  auth: adjuster,
  input: {
    claim_id: input.int({ required: true }),
    body: input.text({ required: true }),
  },
  stack: [
    s.db.get_by_id({ table: adjuster, id: auth("id"), as: "me" }),
    s.precondition({
      expr: expr(ref("me", { safe: true }), "!=", c.null()),
      error: c.text("Unknown adjuster."),
      error_type: "unauthorized",
    }),
    s.db.get_by_id({ table: claim, id: inp("claim_id"), as: "claim" }),
    s.precondition({
      expr: expr(ref("claim", { safe: true }), "!=", c.null()),
      error: c.text("Claim not found."),
      error_type: "notfound",
    }),

    // Record a refused note attempt for the agent identity BEFORE refusing it, so
    // the trail shows what the agent tried.
    s.conditional({
      when: expr(ref("me.role"), "=", c.text("agent")),
      then: [
        s.db.add({
          table: claim_action,
          row: {
            claim_id: inp("claim_id"),
            actor_id: ref("me.id"),
            actor_kind: "agent",
            action: "add_note",
            allowed: false,
            rule: c.text("denied: the agent identity may not add notes"),
            rule_version: 0,
          },
        }),
      ],
    }),
    s.precondition({
      expr: expr(ref("me.role"), "!=", c.text("agent")),
      error: c.text("The agent identity may not add notes."),
      error_type: "accessdenied",
    }),

    // Human path: write the note and log the allowed action.
    s.db.add({
      table: claim_note,
      row: {
        claim_id: inp("claim_id"),
        author_id: ref("me.id"),
        body: inp("body"),
      },
      as: "note",
    }),
    s.db.add({
      table: claim_action,
      row: {
        claim_id: inp("claim_id"),
        actor_id: ref("me.id"),
        actor_kind: "human",
        action: "add_note",
        allowed: true,
        rule: c.text("note added"),
        rule_version: 0,
      },
    }),
  ],
  response: { note: ref("note"), allowed: c.bool(true) },
});
