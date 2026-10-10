#!/usr/bin/env bun
/**
 * Renders editorial acceptance sections into provenance receipts.
 * Specification: am-edit-review-records-hofz (§17.2, §17.7) and am-src-receipt-format-npo5
 */

import { loadOwnersRegistry, type OwnersRegistry } from "../src/content/owners/parseOwners.ts";
import {
  writeGeneratedSection,
  writeGeneratedSectionSync,
} from "../src/content/provenance/writeGeneratedSection.ts";
import type { ReviewRecord } from "../src/content/schemas/review.ts";

export type ContributorCredit = Readonly<{
  role: "translator" | "checking-editor" | "glossator" | "edition-editor";
  contributorId: string;
}>;

/**
 * Pure renderer that produces markdown text for the editorial-acceptance section.
 */
/**
 * The bead that owns the absence of review records, named in the pending line.
 *
 * A receipt's pending grammar requires an owner (see PENDING_LINE below), and the honest owner of
 * "no review records exist yet" is the bead that builds them. It is a default rather than a
 * constant so a caller rendering on behalf of another bead can say so.
 */
export const DEFAULT_PENDING_OWNER = "am-edit-review-records-hofz";

/**
 * THE EXACT FORM A RECEIPT ACCEPTS, and the reason this is a function rather than a literal.
 *
 * `parseReceipt.ts` refuses any section whose content contains "Status: pending" unless the whole
 * line matches `/^Status: pending \(owner: ([a-z0-9-]+)\)$/m`, and `docs/editorial/RECEIPT_FORMAT.md`
 * documents that grammar. This renderer emitted "Status: pending (no review records recorded)."
 * instead, which contains the trigger text and matches nothing -- so for as long as it existed, the
 * ONLY output this function could produce for an empty record set was one the receipt checker
 * rejects with `receipt-pending-malformed`. It was never caught because the command had never been
 * run against a real receipt: all six carried the markers with nothing between them.
 *
 * The test beside this asserts the rendered line against parseReceipt's own regex rather than
 * against a copy of the string, so the two cannot drift apart again without going red.
 */
const PENDING_LINE = (ownerBead: string): string => `Status: pending (owner: ${ownerBead})`;

export function renderEditorialAcceptanceContent(
  records: readonly ReviewRecord[],
  ownersRegistry: OwnersRegistry,
  options?: {
    credits?: readonly ContributorCredit[] | undefined;
    ownerBead?: string | undefined;
  },
): string {
  const lines: string[] = [];

  if (records.length === 0) {
    lines.push(PENDING_LINE(options?.ownerBead ?? DEFAULT_PENDING_OWNER));
    return lines.join("\n");
  }

  const germanAccepted = records.filter(
    (r) => r.reviewType === "german-source" && r.result === "accepted",
  );
  for (const record of germanAccepted) {
    const owner = ownersRegistry.getOwner(record.reviewer);
    const displayName = owner?.displayName || record.reviewer;
    lines.push(`German source review: accepted by ${displayName} on ${record.date}.`);
  }
  if (germanAccepted.length > 0) {
    lines.push("");
  }

  lines.push("### Verified Review Records");
  lines.push("");

  for (const record of records) {
    const owner = ownersRegistry.getOwner(record.reviewer);
    const displayName = owner?.displayName || record.reviewer;
    const scopeIds = record.scope.map((s) => s.recordId).join(", ");

    lines.push(`- **Review Record**: \`${record.id}\``);
    lines.push(`  - **Type**: \`${record.reviewType}\``);
    lines.push(`  - **Reviewer**: ${displayName} (\`${record.reviewer}\`)`);
    lines.push(`  - **Date**: ${record.date}`);
    lines.push(`  - **Outcome**: \`${record.result}\``);
    lines.push(`  - **Scope**: ${scopeIds}`);
    if (record.notes) {
      lines.push(`  - **Notes**: ${record.notes}`);
    }
  }

  if (options?.credits && options.credits.length > 0) {
    lines.push("");
    lines.push("### Translation & Editorial Credits");
    lines.push("");
    for (const credit of options.credits) {
      const owner = ownersRegistry.getOwner(credit.contributorId);
      const name = owner?.displayName || credit.contributorId;
      lines.push(`- **${credit.role}**: ${name} (\`${credit.contributorId}\`)`);
    }
  }

  return lines.join("\n");
}

/**
 * Updates the editorial acceptance section of a provenance receipt markdown file.
 */
export async function updateReceiptEditorialAcceptance(
  receiptPath: string,
  records: readonly ReviewRecord[],
  ownersRegistry: OwnersRegistry = loadOwnersRegistry(),
  options?: {
    credits?: readonly ContributorCredit[] | undefined;
    ownerBead?: string | undefined;
  },
): Promise<{ prefixSha256: string; suffixSha256: string }> {
  const content = renderEditorialAcceptanceContent(records, ownersRegistry, options);
  return writeGeneratedSection(receiptPath, "editorial-acceptance", content);
}

/**
 * Synchronous version of updateReceiptEditorialAcceptance.
 */
export function updateReceiptEditorialAcceptanceSync(
  receiptPath: string,
  records: readonly ReviewRecord[],
  ownersRegistry: OwnersRegistry = loadOwnersRegistry(),
  options?: {
    credits?: readonly ContributorCredit[] | undefined;
    ownerBead?: string | undefined;
  },
): { prefixSha256: string; suffixSha256: string } {
  const content = renderEditorialAcceptanceContent(records, ownersRegistry, options);
  return writeGeneratedSectionSync(receiptPath, "editorial-acceptance", content);
}

// CLI handler
if ((import.meta as { main?: boolean }).main) {
  const args = process.argv.slice(2);
  let receiptPath = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--receipt" && i + 1 < args.length) {
      const val = args[++i];
      if (val) {
        receiptPath = val;
      }
    }
  }

  if (!receiptPath) {
    console.error("Usage: bun scripts/render-review-acceptance.ts --receipt <path>");
    process.exit(1);
  }

  const registry = loadOwnersRegistry();
  // In CLI mode, if invoked without records, render pending or default
  updateReceiptEditorialAcceptanceSync(receiptPath, [], registry);
  console.log(`Updated editorial acceptance in ${receiptPath}`);
}
