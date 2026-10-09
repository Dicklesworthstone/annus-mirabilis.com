/**
 * EVERY manifest `quantityId` that resolves to no registered quantity, sorted into the three
 * buckets am-8be1 asks for, with the evidence that put each one there.
 *
 * The bead's first acceptance item is a report with its denominator; its second is a
 * classification, and that is the expensive half. A flat list of 220 is a slog nobody will start.
 * So this sorts by what the manifest itself declares, which is evidence rather than opinion, and
 * leaves only the residue for editorial judgement:
 *
 *   enumerated-control   the parameter declares `modelDomain.enumerated`, so its values are names
 *                        (coin, uniform, gaussian), not magnitudes. AGENTS.md's quantity model is
 *                        dimension-and-unit shaped; a selector is not a quantity and plausibly
 *                        should not carry a quantityId at all.
 *   buffer-shaped        the output is an array per frame or per walker rather than a scalar. The
 *                        bead names this as the interesting question: "an array of positions may
 *                        need a declared kind of its own rather than an id".
 *   scalar-candidate     everything else. These are the ones that really are magnitudes and need
 *                        either a rename to an existing quantity, a unit variant pointing at one,
 *                        or a new quantity minted.
 *
 * The buckets are REPORTED, not asserted: nothing here decides what should happen, and a heuristic
 * that sorted wrongly would still list the id under its lab for a reader to re-judge. Run it with
 * `bun scripts/report-unregistered-quantity-ids.ts`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load as loadYaml } from "js-yaml";
import { isRegisteredQuantityId } from "../src/content/quantities/registry.ts";

const DIR = join("content", "experiments");

type Entry = Record<string, unknown>;
type Row = {
  lab: string;
  field: "outputs" | "parameters";
  entryId: string;
  quantityId: string;
  unit: string;
  bucket: "enumerated-control" | "buffer-shaped" | "scalar-candidate";
  why: string;
};

/** Plural or sequence-shaped ids, which is how a buffer announces itself in this corpus. */
const BUFFERISH =
  /(Positions|Times|Displacements|Edges|Counts|Frequencies|Frames|Series|Samples|Values|Probabilities|Histogram)$/;

function classify(field: Row["field"], entry: Entry): { bucket: Row["bucket"]; why: string } {
  const domain = entry.modelDomain as { enumerated?: unknown } | undefined;
  if (Array.isArray(domain?.enumerated))
    return {
      bucket: "enumerated-control",
      why: `modelDomain.enumerated [${domain.enumerated.map(String).join(", ")}]`,
    };
  const id = String(entry.id ?? "");
  if (field === "outputs" && BUFFERISH.test(id))
    return { bucket: "buffer-shaped", why: `output id "${id}" is sequence-shaped` };
  return { bucket: "scalar-candidate", why: "no enumerated domain and a scalar-shaped id" };
}

function main(): void {
  const rows: Row[] = [];
  let manifests = 0;
  const totals = { outputs: 0, parameters: 0 };

  for (const file of readdirSync(DIR)
    .filter((f) => f.endsWith(".yaml"))
    .sort()) {
    const manifest = loadYaml(readFileSync(join(DIR, file), "utf8")) as Record<string, unknown>;
    manifests += 1;
    for (const field of ["outputs", "parameters"] as const) {
      const list = manifest[field];
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
        const entry = raw as Entry;
        const quantityId = entry.quantityId;
        if (typeof quantityId !== "string") continue;
        totals[field] += 1;
        if (isRegisteredQuantityId(quantityId)) continue;
        const { bucket, why } = classify(field, entry);
        rows.push({
          lab: file.replace(/\.yaml$/, ""),
          field,
          entryId: String(entry.id ?? "(no id)"),
          quantityId,
          unit: String(entry.displayUnit ?? entry.unit ?? ""),
          bucket,
          why,
        });
      }
    }
  }

  const refs = totals.outputs + totals.parameters;
  const labs = new Set(rows.map((r) => r.lab));
  console.log(
    `[census] unregistered-quantity-ids examined ${refs} quantityId references ` +
      `(${totals.outputs} outputs, ${totals.parameters} parameters) across ${manifests} manifests`,
  );
  console.log(
    `[census] ${rows.length} resolve to no registered quantity, across ${labs.size} of ${manifests} laboratories`,
  );

  for (const bucket of ["scalar-candidate", "buffer-shaped", "enumerated-control"] as const) {
    const inBucket = rows.filter((r) => r.bucket === bucket);
    const distinct = new Set(inBucket.map((r) => r.quantityId));
    console.log(
      `\n=== ${bucket}: ${inBucket.length} references, ${distinct.size} distinct ids ===`,
    );
    for (const r of inBucket.sort((a, b) => (a.lab + a.entryId).localeCompare(b.lab + b.entryId))) {
      console.log(
        `  ${r.lab.padEnd(8)} ${r.field.slice(0, 6).padEnd(7)} ${r.entryId.padEnd(26)} ` +
          `${r.quantityId.padEnd(30)} ${(r.unit || "-").padEnd(8)} ${r.why}`,
      );
    }
  }

  // Ids used by more than one laboratory matter most: an unregistered id shared across labs is the
  // case AGENTS.md warns about, where "two outputs can share an invented id with different
  // dimensions without anyone noticing".
  const byId = new Map<string, Set<string>>();
  for (const r of rows) byId.set(r.quantityId, (byId.get(r.quantityId) ?? new Set()).add(r.lab));
  const shared = [...byId].filter(([, labsFor]) => labsFor.size > 1).sort();
  console.log(`\n=== shared across laboratories: ${shared.length} ids ===`);
  for (const [id, labsFor] of shared)
    console.log(`  ${id.padEnd(30)} ${[...labsFor].sort().join(", ")}`);
}

main();
