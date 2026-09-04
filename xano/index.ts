import { workspace } from "@xanots/sdk";

import { adjuster } from "./tables/adjuster.js";
import { claim } from "./tables/claim.js";
import { transition_rule } from "./tables/transition_rule.js";
import { claim_note } from "./tables/claim_note.js";
import { claim_action } from "./tables/claim_action.js";

import { claimsApi } from "./api/group.js";
import { enforceTransition } from "./functions/enforce_transition.js";
import { claimInterpreter } from "./agents/claim_interpreter.js";

import { seedQuery } from "./api/seed.js";
import { loginQuery } from "./api/login.js";
import { claimsListQuery } from "./api/claims_list.js";
import { claimsGetQuery } from "./api/claims_get.js";
import { proposeTransitionQuery } from "./api/propose_transition.js";
import { addNoteQuery } from "./api/add_note.js";
import { actionsQuery } from "./api/actions.js";
import { agentServiceClaimQuery } from "./api/agent_service_claim.js";

/**
 * Agent Claims-Servicing API — a governed insurance claims backend where a human
 * adjuster and an AI agent call the SAME permissioned, logged endpoints. One guard
 * (`enforce_transition`) is the only place a claim's status changes, so an illegal
 * action is refused identically whoever asks and every agent attempt is audited.
 */
export default workspace("agent-claims-servicing-api")
  .registerTables([adjuster, claim, transition_rule, claim_note, claim_action])
  .registerApiGroups([claimsApi])
  .registerFunctions([enforceTransition])
  .registerAgents([claimInterpreter])
  .registerQueries([
    seedQuery,
    loginQuery,
    claimsListQuery,
    claimsGetQuery,
    proposeTransitionQuery,
    addNoteQuery,
    actionsQuery,
    agentServiceClaimQuery,
  ]);
