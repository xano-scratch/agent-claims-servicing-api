import { apiGroup } from "@xanots/sdk";

/**
 * The one API group. Its canonical slug is PINNED so public paths are stable
 * (`/api:claims/...`) and `getPath()` resolves in the browser bundle from the
 * source alone, without a lock file.
 */
export const claimsApi = apiGroup({ name: "claims", canonical: "claims" });
