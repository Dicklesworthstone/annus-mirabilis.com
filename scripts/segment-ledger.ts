/**
 * Propose blocks and sentences from a reviewed ledger, reconcile with frozen manifest,
 * and confirm alias records.
 * Usage:
 *   bun scripts/segment-ledger.ts --slug brownian-motion
 *   bun scripts/segment-ledger.ts --slug brownian-motion --confirm s1-p2=retired:s1-p1 --editor jemanuel --reason "editorial" [--update]
 *   bun scripts/segment-ledger.ts --slug brownian-motion --write-blocks [--update]
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AliasKind } from "../src/content/aliases.ts";
import { inspectLedgerPresence } from "../src/content/editions/ledgerPresence.ts";
import {
  confirmAlias,
  germanAlignableIds,
  segmentLedger,
  writeProposedBlocks,
} from "../src/content/editions/segmentLedger.ts";
import { parseRouteSlug, type RouteSlug } from "../src/content/ids.ts";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

const slugRaw = argValue("--slug") ?? "brownian-motion";
const parsed = parseRouteSlug(slugRaw);
if (!parsed.ok) {
  console.error(parsed.error);
  process.exit(2);
}
const slug: RouteSlug = parsed.value;

// Handle --confirm flag
const confirmRaw = argValue("--confirm");
if (confirmRaw || hasFlag("--confirm")) {
  const confirmStr = confirmRaw ?? "";
  const parts = confirmStr.split("=");
  const diffIdOrRetired = parts[0] ?? "";
  const repairStr = parts[1] ?? "";

  const repairParts = repairStr.split(":");
  const kind = (repairParts[0] ?? "retired") as AliasKind;
  const repIds = (repairParts[1] ?? "").split(",").filter(Boolean);
  const retiredId = diffIdOrRetired.includes(":")
    ? diffIdOrRetired.split(":")[1]!
    : diffIdOrRetired;

  const result = confirmAlias({
    slug,
    differenceId: diffIdOrRetired,
    repair: {
      kind,
      retiredId,
      replacementIds: repIds,
    },
    editor: argValue("--editor"),
    reason: argValue("--reason"),
    confirm: true,
    update: hasFlag("--update"),
  });

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

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

if (result.status === "proposed" && hasFlag("--write-blocks")) {
  const writeRes = writeProposedBlocks({
    slug,
    blocks: result.blocks,
    differences: result.differences,
    writeBlocks: true,
    update: hasFlag("--update"),
  });
  console.log(JSON.stringify(writeRes, null, 2));
  process.exit(writeRes.ok ? 0 : 1);
}

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
