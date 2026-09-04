import { agent, input } from "@xanots/sdk";

/**
 * The Play-4 agent. It reads ONE plain-language servicing instruction and the
 * claim's current status, and decides which status the instruction is asking to
 * move the claim to. That is ALL it does: it interprets intent into a target
 * status, and the shared `enforce_transition` guard decides whether the move is
 * allowed. The model never gets to grant permission.
 *
 * Runs on the keyless `xano-free` provider, so the ephemeral deploys and runs the
 * live agent with no external credentials. Structured output pins the result to a
 * valid status enum plus a one-sentence reading.
 */
export const claimInterpreter = agent({
  name: "claim_instruction_interpreter",
  llm: {
    type: "xano-free",
    maxSteps: 2,
    systemPrompt:
      "You are a claims-servicing assistant. You read one instruction about a single " +
      "insurance claim and decide which status the person wants the claim moved to. " +
      "You choose exactly one target status from the allowed set. You do NOT decide " +
      "whether the move is permitted; a separate rule check does that. Keep your reading " +
      "to one short sentence.",
    prompt:
      "Claim {{ $args.claim_number }} is currently in status '{{ $args.current_status }}'. " +
      "The valid claim statuses are: submitted, under_review, approved, denied, paid, closed. " +
      'The instruction is: "{{ $args.instruction }}". ' +
      "Choose the single target status the instruction is asking for, and describe your reading in one short sentence.",
  },
  output: {
    schema: {
      target_status: input.enum([
        "submitted",
        "under_review",
        "approved",
        "denied",
        "paid",
        "closed",
      ]),
      interpretation: input.text(),
    },
  },
});
