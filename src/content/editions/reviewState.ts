/**
 * Edition review state check registry seam.
 * Specification: am-edn-alignment-tooling-do1 and am-edit-review-records-hofz
 */

export type ReviewStateCheckContext = Readonly<{
  unitId: string;
  paper: string;
  layer: "german" | "translation" | "gloss" | "source" | string;
  revision?: number | string | undefined;
  unitHash?: string | undefined;
  translatorId?: string | undefined;
  editorId?: string | undefined;
  checkingEditorId?: string | undefined;
  glossatorId?: string | undefined;
  editionEditors?: readonly string[] | undefined;
  [key: string]: unknown;
}>;

export type ReviewStateCheckResult = Readonly<{
  ok: boolean;
  code?: string | undefined;
  message?: string | undefined;
}>;

export type ReviewStateCheck = (context: ReviewStateCheckContext) => ReviewStateCheckResult;

/**
 * Strict default review state check that rejects any reviewed status with review-records-not-available.
 */
export const strictNoReviewedCheck: ReviewStateCheck = (context) => {
  return {
    ok: false,
    code: "review-records-not-available",
    message: `Review records are not available for unit "${context.unitId}". Registration required.`,
  };
};

let activeCheck: ReviewStateCheck = strictNoReviewedCheck;

/**
 * Registers the active review state check in the single registration slot.
 */
export function registerReviewStateCheck(check: ReviewStateCheck): void {
  activeCheck = check;
}

/**
 * Gets the current active review state check.
 */
export function getReviewStateCheck(): ReviewStateCheck {
  return activeCheck;
}

/**
 * Restores the default strict check (used in tests to verify the seam).
 */
export function resetReviewStateCheck(): void {
  activeCheck = strictNoReviewedCheck;
}
