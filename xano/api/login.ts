import { query, input, s, c, ref, inp, expr } from "@xanots/sdk";
import { claimsApi } from "./group.js";
import { adjuster } from "../tables/adjuster.js";

/**
 * The one auth entry point for human and agent identities alike. Exchange email +
 * password for a bearer token that carries the adjuster's id.
 *
 * The password is taken as `input.text()` (not `input.password`, which would hash
 * the submission a second time), and the read names the internal `password` column
 * in `output` so `check_password` can see the stored hash.
 */
export const loginQuery = query({
  name: "login",
  verb: "POST",
  apiGroup: claimsApi,
  input: {
    email: input.email({ required: true, methods: ["lower"] }),
    password: input.text({ required: true }),
  },
  stack: [
    s.db.get({
      table: adjuster,
      fieldName: "email",
      fieldValue: inp("email"),
      output: ["id", "name", "email", "role", "password"],
      as: "u",
    }),
    s.precondition({
      expr: expr(ref("u", { safe: true }), "!=", c.null()),
      error: c.text("No adjuster with that email."),
      error_type: "notfound",
    }),
    s.security.check_password({
      text_password: inp("password"),
      hash_password: ref("u.password"),
      as: "ok",
    }),
    s.precondition({
      expr: expr(ref("ok"), "=", c.bool(true)),
      error: c.text("Wrong password."),
      error_type: "unauthorized",
    }),
    s.security.create_auth_token({ table: adjuster, id: ref("u.id"), as: "token" }),
  ],
  response: {
    token: ref("token"),
    id: ref("u.id"),
    name: ref("u.name"),
    email: ref("u.email"),
    role: ref("u.role"),
  },
});
