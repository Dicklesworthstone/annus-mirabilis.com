import { ExperimentRuntimeError } from "../refusal.ts";
import type { AcceptedSnapshot } from "../store/instanceStore.ts";
import { BM04_MODEL, type Bm04Parameters } from "./definition.ts";

function cell(value: string | number): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new ExperimentRuntimeError(
        "nonfinite-export-value",
        "Nonfinite data cannot be exported.",
        "bm-04",
      );
    return String(value);
  }
  // Quoting alone does not neutralize spreadsheet formulas in textual metadata.
  const safe = /^\s*[=+@-]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/** Export exactly one accepted snapshot, never draft parameters or a pending run. */
export function bm04DataCsv(snapshot: AcceptedSnapshot, sourceDigest: string): string {
  const p = snapshot.parameters as unknown as Bm04Parameters;
  if (!Number.isSafeInteger(p.cells) || p.cells < 3 || !Number.isFinite(p.W) || p.W <= 0) {
    throw new ExperimentRuntimeError(
      "accepted-grid-invalid",
      "The accepted grid is invalid.",
      "bm-04",
    );
  }
  const density = snapshot.outputs.find((output) => output.quantityId === "densityProfile");
  const osmotic = snapshot.outputs.find((output) => output.quantityId === "osmoticProfile");
  if (
    !density ||
    !osmotic ||
    density.status !== "value" ||
    osmotic.status !== "value" ||
    typeof density.value === "number" ||
    typeof osmotic.value === "number" ||
    density.value.length !== p.cells ||
    osmotic.value.length !== p.cells
  ) {
    throw new ExperimentRuntimeError(
      "profile-grid-mismatch",
      "Both accepted profiles must match the accepted spatial grid.",
      "bm-04",
    );
  }
  const metadata = [
    "bm-04",
    BM04_MODEL.ownerKind,
    BM04_MODEL.constantSetId,
    BM04_MODEL.id,
    sourceDigest,
    snapshot.instanceId,
    snapshot.runId,
    snapshot.snapshotVersion,
    snapshot.revisions.input,
    JSON.stringify(p),
  ].map(cell);
  const rows = [
    [
      "instrument_id",
      "execution_kind",
      "constant_set_id",
      "model_id",
      "prepared_source_digest",
      "instance_id",
      "run_id",
      "snapshot_version",
      "input_revision",
      "parameters_json",
      "cell",
      "x_m",
      "density_per_m",
      "osmotic_density_per_m",
    ].join(","),
  ];
  for (let i = 0; i < p.cells; i++) {
    const n = density.value.at(i);
    const osmoticN = osmotic.value.at(i);
    if (!Number.isFinite(n) || !Number.isFinite(osmoticN) || n < 0 || osmoticN < 0) {
      throw new ExperimentRuntimeError(
        "density-not-exportable",
        "Only finite, nonnegative accepted densities can be exported.",
        "bm-04",
      );
    }
    rows.push(
      [...metadata, ...[i + 1, ((i + 0.5) / p.cells) * p.W, n, osmoticN].map(cell)].join(","),
    );
  }
  return `${rows.join("\r\n")}\r\n`;
}
