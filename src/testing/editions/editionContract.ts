/**
 * Test-facing export of the edition contract harness (am-edn-alignment-tooling-do1).
 */

import { registerEditionReviewState } from "../../content/checks/review/editionReviewState.ts";

registerEditionReviewState();

export type {
  EditionContractOptions,
  EditionContractResult,
} from "../../content/editions/editionContract.ts";
export { assertEditionContract } from "../../content/editions/editionContract.ts";
