/**
 * Propose blocks and sentences from a reviewed ledger.
 * Usage: bun scripts/segment-ledger.ts --slug brownian-motion
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { inspectLedgerPresence, type RouteSlug } from "../src/content/editions/ledgerPresence.ts";
import { germanAlignableIds, segmentLedger } from "../src/content/editions/segmentLedger.ts";
import { parseRouteSlug } from "../src/content/ids.ts";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

const slugRaw = argValue("--slug") ?? "brownian-motion";
const parsed = parseRouteSlug(slugRaw);
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}
const slug: RouteSlug = parsed.value;
const presence = inspectLedgerPresence(slug);
if (presence.presence === "absent") {
  console.log(
    JSON.stringify(
      {
        status: "absent",
        code: "ledger-absent",
        slug,
        path: presence.path,
        message: "No ledger present. Absence is not completeness.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
const text = readFileSync(join(process.cwd(), presence.path), "utf8");
const result = segmentLedger({ ledgerText: text });
if (result.status === "proposed") {
  console.log(
    JSON.stringify(
      {
        status: "proposed",
        slug,
        ids: germanAlignableIds(result.blocks),
        differences: result.differences,
      },
      null,
      2,
    ),
  );
} else {
  console.log(JSON.stringify(result, null, 2));
}
