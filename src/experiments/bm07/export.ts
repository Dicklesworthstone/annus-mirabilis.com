import type { AcceptedSnapshot, NumericView } from "../store/instanceStore.ts";
import type { Bm07Parameters } from "./definition.ts";
/** Canonical SI data and accepted metadata only. Hidden parameters and private
 * predictions are deliberately absent; this export is not observational evidence. */
export function inferenceObservationCsv(snapshot: AcceptedSnapshot, sourceDigest: string): string {
  if (snapshot.experimentId !== "bm-07" || !/^source:sha256:[a-f0-9]{64}$/.test(sourceDigest))
    throw new TypeError("Invalid inference export identity.");
  const p = snapshot.parameters as Bm07Parameters;
  const array = (id: string): NumericView => {
    const r = snapshot.outputs.find((o) => o.quantityId === id);
    if (r?.status !== "value" || typeof r.value === "number")
      throw new TypeError("Observation data is unavailable.");
    return r.value;
  };
  const times = array("observationTimes"),
    positions = array("observationPositions"),
    increments = array("observationIncrements");
  const meta = {
    kind: "synthetic-observations",
    units: "SI",
    sourceDigest,
    seed: p.seed,
    M: p.M,
    d: p.d,
    dt: p.dt,
    generatorT: p.generatorT,
    generatorEta: p.generatorEta,
    generatorRadius: p.generatorRadius,
  };
  const rows = [
    `# ${JSON.stringify(meta)}`,
    [
      "time_s",
      ...Array.from({ length: p.d }, (_, i) => `position_${i === 0 ? "x" : "y"}_m`),
      ...Array.from({ length: p.d }, (_, i) => `increment_${i === 0 ? "x" : "y"}_m`),
    ].join(","),
  ];
  for (let i = 0; i < times.length; i++)
    rows.push(
      [
        times.at(i),
        ...Array.from({ length: p.d }, (_, c) => positions.at(i * p.d + c)),
        ...Array.from({ length: p.d }, (_, c) => (i === 0 ? "" : increments.at((i - 1) * p.d + c))),
      ].join(","),
    );
  return rows.join("\n") + "\n";
}
