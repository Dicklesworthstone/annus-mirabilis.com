import type { AcceptedSnapshot } from "../../experiments/store/instanceStore.ts";
import { array, display, result, scalar } from "./presentation.ts";

/** Text-only interpolation boundary for the shared SSR / browser inference views. */
export function inferenceText(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
export function inferenceValue(snapshot: AcceptedSnapshot, id: string, factor = 1): string {
  const value = result(snapshot, id), e = inferenceText;
  if (value.status === "value" && typeof value.value === "number")
    return `<span data-output="${e(id)}" data-value="${value.value}">${display(value.value, factor)}</span>`;
  const reason = value.status === "underdetermined" ? value.compatibleFamily
    : "reason" in value ? value.reason : "No scalar value for this question.";
  return `<span data-output="${e(id)}" data-result-status="${e(value.status)}">${e(reason)}</span>`;
}
export function inferenceInterval(snapshot: AcceptedSnapshot, id: string, factor = 1): string {
  if (result(snapshot, id).status !== "value") return inferenceValue(snapshot, id);
  const values = array(snapshot, id);
  if (values.length !== 2) throw new TypeError("An inference interval requires exactly two endpoints.");
  return `<span data-output="${inferenceText(id)}" data-lower="${values.at(0)}" data-upper="${values.at(1)}">${display(values.at(0), factor)} – ${display(values.at(1), factor)}</span>`;
}
export function inferenceIdentity(snapshot: AcceptedSnapshot): string {
  return `data-instance-id="${inferenceText(snapshot.instanceId)}" data-run-id="${inferenceText(snapshot.runId)}" data-snapshot-version="${snapshot.snapshotVersion}"`;
}

/** BM-07 and the reasoning workbench share this view. All scientific curves are
 * accepted owner outputs; the logarithms and scale factors below are layout only.
 */
export function renderInferenceFamily(snapshot: AcceptedSnapshot, band = false): string {
  if (result(snapshot, "familyNumbers").status !== "value")
    return `<p class="notice">${inferenceValue(snapshot, "familyNumbers")}</p>`;
  const radii = array(snapshot, "familyRadii"), numbers = array(snapshot, "familyNumbers");
  const lower = band ? array(snapshot, "familyLowerNumbers") : numbers;
  const upper = band ? array(snapshot, "familyUpperNumbers") : numbers;
  if (radii.length < 2 || [numbers, lower, upper].some((v) => v.length !== radii.length))
    throw new TypeError("A compatible family requires matching radius and number arrays.");
  for (let i = 0; i < radii.length; i++) {
    if (![radii.at(i), lower.at(i), numbers.at(i), upper.at(i)].every((v) => Number.isFinite(v) && v > 0) ||
        lower.at(i) > numbers.at(i) || numbers.at(i) > upper.at(i) || (i > 0 && radii.at(i) <= radii.at(i - 1)))
      throw new TypeError("A compatible family must have positive ordered coordinates and bounds.");
  }
  const last = radii.length - 1;
  const loX = Math.log10(radii.at(0)), hiX = Math.log10(radii.at(last));
  const loY = Math.log10(Math.min(...lower.copy())), hiY = Math.log10(Math.max(...upper.copy()));
  const x = (v: number) => 76 + 450 * (Math.log10(v) - loX) / (hiX - loX || 1);
  const y = (v: number) => 242 - 201 * (Math.log10(v) - loY) / (hiY - loY || 1);
  const indices = [0, Math.floor(last / 2), last];
  const points = (values: typeof numbers) => Array.from({ length: radii.length }, (_, i) => `${x(radii.at(i))},${y(values.at(i))}`).join(" ");
  const ticks = indices.map((i) => `<text x="${x(radii.at(i))}" y="266" text-anchor="middle">${display(radii.at(i), 1e6)}</text><text x="68" y="${y(numbers.at(i)) + 4}" text-anchor="end">${display(numbers.at(i), 1e-23)}</text>`).join("");
  const bounds = band ? `<polyline class="comparison-curve" stroke-dasharray="5 4" points="${points(lower)}"/><polyline class="comparison-curve" stroke-dasharray="5 4" points="${points(upper)}"/>` : "";
  const rows = Array.from({ length: radii.length }, (_, i) => `<tr><th scope="row">${display(radii.at(i), 1e6)}</th><td>${display(numbers.at(i), 1e-23)}</td>${band ? `<td>${display(lower.at(i), 1e-23)}</td><td>${display(upper.at(i), 1e-23)}</td>` : ""}</tr>`).join("");
  return `<figure class="plot" ${inferenceIdentity(snapshot)}><svg role="img" viewBox="0 0 570 300" aria-label="Compatible radius and molecular-number pairs on logarithmic axes. Larger radius means smaller molecular number; the complete numeric table follows."><path class="axis" d="M76 25V245H530"/>${ticks}${bounds}<polyline class="curve" data-family-curve points="${points(numbers)}"/><text x="76" y="17">N (10²³ mol⁻¹); logarithmic axes</text><text x="300" y="292" text-anchor="middle">Assumed radius (μm)</text></svg><figcaption>Each point on the solid curve gives the same diffusion estimate at the stated temperature and viscosity. ${band ? "Dashed curves map the 95% diffusion interval into a compatible band. They do not identify a single radius or a single molecular number. This band is not the combined interval obtained after admitting a radius measurement." : "This is a compatible family, not a confidence region and not a second measurement of the radius."}</figcaption><details data-preserve-detail="family"><summary>Read all compatible pairs</summary><div class="table-scroll" role="region" aria-label="Compatible radius–number pairs" tabindex="0"><table><caption>Radius–number family for this accepted estimate${band ? "; bounds from diffusion uncertainty only" : ""}</caption><thead><tr><th scope="col">Radius (μm)</th><th scope="col">N (10²³ mol⁻¹)</th>${band ? '<th scope="col">Lower N</th><th scope="col">Upper N</th>' : ""}</tr></thead><tbody>${rows}</tbody></table></div></details></figure>`;
}

/** BM-08's moment table, also usable when the inference deliberately withholds
 * covariance and does not know the generator's D or noise variance.
 */
export function renderCameraMoments(snapshot: AcceptedSnapshot, showModel = true): string {
  const rows = [["Increment variance", "sampleVariance", "expectedVariance", "sdVariance"],
    ["Adjacent-increment covariance", "sampleCovariance", "expectedCovariance", "sdCovariance"]] as const;
  return `<div class="table-scroll" role="region" aria-label="Camera increment moments" tabindex="0"><table><caption>Per-coordinate moments after subtracting known synthetic drift; μm²</caption><thead><tr><th scope="col">Moment</th><th scope="col">Sample</th>${showModel ? '<th scope="col">Camera model</th><th scope="col">Asymptotic sampling SD</th>' : ""}</tr></thead><tbody>${rows.map(([label, sample, expected, sd]) => `<tr><th scope="row">${label}</th><td>${inferenceValue(snapshot, sample, 1e12)}</td>${showModel ? `<td>${inferenceValue(snapshot, expected, 1e12)}</td><td>${inferenceValue(snapshot, sd, 1e12)}</td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}

export function renderCompatibleLine(snapshot: AcceptedSnapshot): string {
  const diffusion = array(snapshot, "familyDiffusion"), noise = array(snapshot, "familyNoise"), covariance = array(snapshot, "familyCovariance");
  if (diffusion.length !== noise.length || noise.length !== covariance.length) throw new TypeError("Incomplete camera family.");
  const maxD = scalar(snapshot, "maximumDiffusion"), maxNoise = scalar(snapshot, "maximumNoise");
  const points = Array.from({ length: diffusion.length }, (_, i) => `${76 + 450 * diffusion.at(i) / maxD},${242 - 201 * noise.at(i) / maxNoise}`).join(" ");
  const rows = Array.from({ length: diffusion.length }, (_, i) => `<tr><th scope="row">${display(diffusion.at(i), 1e12)}</th><td>${display(noise.at(i), 1e12)}</td><td>${display(covariance.at(i), 1e12)}</td></tr>`).join("");
  return `<figure class="plot"><svg role="img" viewBox="0 0 570 300" aria-label="A compatible diffusion–noise segment. All listed pairs reproduce the same measured increment variance; predicted covariances differ."><path class="axis" d="M76 25V245H530"/><polyline class="curve" points="${points}"/><text x="76" y="17">Localization variance (μm²)</text><text x="68" y="246" text-anchor="end">0</text><text x="68" y="45" text-anchor="end">${display(maxNoise, 1e12)}</text><text x="76" y="266" text-anchor="middle">0</text><text x="526" y="266" text-anchor="end">${display(maxD, 1e12)}</text><text x="300" y="292" text-anchor="middle">Diffusion coefficient (μm²/s)</text></svg><figcaption>The solid segment is the family compatible with the sample variance, not a confidence region. Its zero-diffusion boundary is not a measured estimate. Covariance or another spacing supplies a second relation.</figcaption><details data-preserve-detail="camera-family"><summary>Compare candidate pairs without the graph</summary><div class="table-scroll" role="region" aria-label="Diffusion–noise candidate pairs" tabindex="0"><table><caption>Every row reproduces the same variance; all values are model consequences</caption><thead><tr><th scope="col">D (μm²/s)</th><th scope="col">Noise variance (μm²)</th><th scope="col">Predicted covariance (μm²)</th></tr></thead><tbody>${rows}</tbody></table></div></details></figure>`;
}
