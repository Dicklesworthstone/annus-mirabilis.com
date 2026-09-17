/**
 * Validate explicit many-to-many alignment edges.
 * Usage: bun scripts/align-editions.ts
 */

import { inspectAllLedgers } from "../src/content/editions/ledgerPresence.ts";
import { getReviewStateCheck } from "../src/content/editions/reviewState.ts";

const presence = inspectAllLedgers();
const check = getReviewStateCheck();
const reviewProbe = check({
  unitId: "s0-p1-s1",
  paper: "brownian-motion",
  layer: "translation",
});
console.log(
  JSON.stringify(
    {
      ledgers: presence,
      reviewStateDefault: reviewProbe,
      message: "Alignment is by permanent id. Ledgers absent remain not-available.",
    },
    null,
    2,
  ),
);
