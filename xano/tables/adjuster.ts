import { table, f } from "@xanots/sdk";

/**
 * The auth table. Human adjusters AND the AI agent identity live here, so the
 * SAME per-endpoint auth (`auth: adjuster`) and the SAME role check bind a human
 * and an agent caller alike.
 *
 * `role` is the permission tier the governed state machine reads. `handler` and
 * `supervisor` are human roles with different transition rights; `agent` is the
 * scoped service identity an agent token carries. A `transition_rule`'s
 * `allowed_roles` list is checked against this value, the same way for either.
 */
export const adjuster = table({
  name: "adjuster",
  auth: true,
  schema: {
    email: f.email({ required: true }),
    password: f.password({ required: true }),
    name: f.text({ required: true }),
    role: f.enum(["handler", "supervisor", "agent"], { required: true }),
  },
  index: [{ type: "unique", fields: [{ name: "email" }] }],
});
