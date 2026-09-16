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
export function renderEditorialAcceptanceContent(
  records: readonly ReviewRecord[],
  ownersRegistry: OwnersRegistry,
  options?: {
    credits?: readonly ContributorCredit[] | undefined;
  },
): string {
  const lines: string[] = [];

  if (records.length === 0) {
    lines.push("Status: pending (no review records recorded).");
    return lines.join("\n");
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
