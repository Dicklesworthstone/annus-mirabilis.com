import type { AcceptedSnapshot, NumericView } from "../store/instanceStore.ts";
import type { Bm08Parameters } from "./definition.ts";
function array(snapshot: AcceptedSnapshot, id: string): NumericView {
  const result = snapshot.outputs.find(output => output.quantityId === id);
  if (!result || result.status !== "value" || typeof result.value === "number") throw new TypeError(`Missing accepted camera array: ${id}`);
  return result.value;
}
export function cameraObservationCsv(snapshot: AcceptedSnapshot, sourceDigest: string): string {
  if (snapshot.experimentId !== "bm-08" || !/^source:sha256:[a-f0-9]{64}$/.test(sourceDigest)) throw new TypeError("Expected an accepted camera snapshot and source digest.");
  const p = snapshot.parameters as Bm08Parameters;
  const lines = ["# Synthetic camera data; not historical or empirical observations", `# source ${sourceDigest}`, `# physical_seed ${p.seed}; noise_seed ${p.noiseSeed}; stationary_seed ${p.clickSeed}`, `# exposure_s ${p.exposure}; sigma_m ${p.sigma}; stage_drift_m_per_s ${p.stageDrift}; flow_drift_m_per_s ${p.flowDrift}; generator_D_m2_per_s ${p.D}`, "# All positions are SI; exposure averages precede stage drift and localization error."];
  lines.push("time_s,coordinate,latent_start_m,exposure_average_m,camera_position_m");
  const times = array(snapshot, "times"), latent = array(snapshot, "idealPositions"), blurred = array(snapshot, "blurredPositions"), observed = array(snapshot, "positions");
  if (times.length !== p.M + 1 || [latent, blurred, observed].some(a => a.length !== (p.M + 1) * p.d)) throw new TypeError("Inconsistent camera frame layout.");
  for (let i = 0; i < times.length; i++) for (let c = 0; c < p.d; c++) lines.push([times.at(i), c === 0 ? "x" : "y", latent.at(i * p.d + c), blurred.at(i * p.d + c), observed.at(i * p.d + c)].join(","));
  return `${lines.join("\n")}\n`;
}
