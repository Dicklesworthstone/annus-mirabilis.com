import type { KitchenAccepted } from "../../../experiments/bm07/kitchen/session.ts";
import { array, display, identity } from "../presentation.ts";
import { InferenceValue as Value, InferenceInterval as Interval } from "../InferencePlots.tsx";

export function KitchenPlot({ accepted }: { accepted: KitchenAccepted }) {
  const { document, report, snapshot } = accepted;
  const indices = report.tracks.find(t => t.key === report.selectedTrack)!.indices;
  const points = indices.slice(0, 1000).map(i => document.points[i]!);
  const values = points.flatMap(p => p[report.options.axis] === null ? [] : [p[report.options.axis]!]);
  const min = Math.min(...values, 0), max = Math.max(...values, min + 1);
  const first = points[0]!.time, last = Math.max(first + 1, points.at(-1)!.time);
  const x = (t: number) => 65 + 475 * (t - first) / (last - first);
  const y = (v: number) => 230 - 190 * (v - min) / (max - min);
  return <figure className="plot" {...identity(snapshot)}>
    <svg role="img" viewBox="0 0 570 290" aria-label="Recorded source-pixel positions against actual timestamps. Circles are measurements, crosses are excluded points, and triangles are interpolated points. Missing positions are not drawn. All observations are in the table.">
      <path className="axis" d="M65 25V235H540"/>
      {[0, .5, 1].map(f => <g key={f}><text x="58" y={y(min + f * (max - min)) + 4} textAnchor="end">{display(min + f * (max - min))}</text><text x={65 + f * 475} y="255" textAnchor="middle">{display(first + f * (last - first))}</text></g>)}
      {points.map((p, i) => {
        const coordinate = p[report.options.axis]; if (coordinate === null || p.status === "lost") return null;
        const cx = x(p.time), cy = y(coordinate);
        return p.status === "measured" ? <circle key={i} cx={cx} cy={cy} r="2.6" className="kitchen-measured"/>
          : p.status === "excluded" ? <path key={i} d={`M${cx-3} ${cy-3}l6 6m0 -6l-6 6`} className="kitchen-excluded"/>
          : <path key={i} d={`M${cx} ${cy-4}l4 7h-8z`} className="kitchen-interpolated"/>;
      })}
      <text x="65" y="17">{report.options.axis} position (source pixels)</text><text x="300" y="282" textAnchor="middle">Actual recorded time (s)</text>
    </svg>
    <figcaption>Circles: measured. Crosses: excluded. Triangles: interpolated. No connecting line invents a path through missing observations. {indices.length > 1000 ? "The plot shows the first 1,000 rows of this track; analysis and export use the entire accepted track." : "The plot shows every row of this track with a recorded position."}</figcaption>
  </figure>;
}

export function KitchenResults({ accepted }: { accepted: KitchenAccepted }) {
  const { report: r, snapshot: s, document: d } = accepted;
  const meaning = r.numberMeaning === "synthetic-recovery" ? "Synthetic recovery, not an experimental molecular count"
    : r.numberMeaning === "consistency-check" ? "Consistency check against a defined value"
    : r.numberMeaning === "independent-estimate" ? "Conditional inference using an independently measured gas constant"
    : "No molecular-number interpretation is available";
  return <div className="kitchen-results" {...identity(s)}>
    <p className="notice" data-kitchen-origin={d.metadata.data_origin}>{d.metadata.data_origin === "synthetic" ? "Synthetic practice data. These generated positions are not experimental evidence." : "Reader-supplied observations. This site has not independently verified their acquisition, calibration or provenance."}</p>
    <p className="accepted-caption">Accepted sample: {d.metadata.sample || "Unnamed"}. Track: {r.tracks.find(t=>t.key===r.selectedTrack)!.label}. Coordinate: {r.options.axis}. Scale: {r.scale === null ? "unknown" : `${display(r.scale, 1e6)} μm per source pixel (${r.scaleSource})`}. Exposure: {d.metadata.exposure_s ? `${d.metadata.exposure_s} s` : "unknown"}.</p>
    <KitchenPlot accepted={accepted}/>
    <h3>What the retained observations support</h3>
    <table><caption>Diffusion and camera-error estimates from accepted inputs</caption><tbody>
      <tr><th scope="row">Complete disjoint pairs</th><td><Value snapshot={s} id="pairCount"/></td></tr>
      <tr><th scope="row">Residual degrees of freedom</th><td><Value snapshot={s} id="pairDegrees"/></td></tr>
      <tr><th scope="row">Ignore drift and camera error (μm²/s)</th><td><Value snapshot={s} id="naiveD" factor={1e12}/></td></tr>
      <tr><th scope="row">Noise-corrected pair estimate (μm²/s)</th><td><Value snapshot={s} id="correctedD" factor={1e12}/></td></tr>
      <tr><th scope="row">Stationary-click variance (μm²)</th><td><Value snapshot={s} id="noiseVariance" factor={1e12}/></td></tr>
      <tr><th scope="row">Fitted coordinate drift (μm/s)</th><td><Value snapshot={s} id="drift" factor={1e6}/></td></tr>
    </tbody></table>
    <p>Point estimates do not establish the model. A negative corrected estimate remains visible; it is not replaced by zero.</p>
    <h3>Conditional diffusion interval</h3>
    <p data-kitchen-interval><Interval snapshot={s} id="diffusionInterval" factor={1e12}/></p>
    <p className="fine">When admitted: μm²/s, {display(r.options.coverage, 100)}% target coverage under the specified Gaussian camera model. The conservative procedure includes stationary-click sampling uncertainty, not uncertainty in calibration or physical assumptions.</p>
    <h3>Radius comes before molecular number</h3>
    <p>Displacement alone does not identify radius and molecular number separately. A radius calculated from these same displacements using an assumed molecular number would return that assumption. An independent radius declaration is required.</p>
    <p>Compatible radius × molecular-number product (m/mol): <Value snapshot={s} id="radiusNumberProduct"/>.</p>
    <h4 data-kitchen-meaning={r.numberMeaning}>{meaning}</h4>
    <p>Molecular-number result (mol⁻¹): <Value snapshot={s} id="molecularNumber"/>.</p>
    <p>Conditional interval (mol⁻¹): <Interval snapshot={s} id="molecularInterval"/>.</p>
    {r.numberMeaning === "consistency-check" && <><p>Ratio to the defined Avogadro constant: <Value snapshot={s} id="consistencyRatio"/>.</p><p>Equivalent Boltzmann-constant estimate (J/K): <Value snapshot={s} id="estimatedBoltzmannConstant"/>.</p></>}
    <p className="fine">Gas-constant source: {r.constantSetId}. Classification: {r.gasConstantProvenance}. The interpretation depends on these declared inputs and does not certify a real suspension.</p>
    <p className="notice">{r.combinedIntervalReason}</p>
    <details open={r.intervalReasons.length > 0}><summary>Assumptions, missing information and lost observations</summary>
      <p>{r.counts.measured} measured, {r.counts.excluded} excluded, {r.counts.interpolated} interpolated, {r.counts.lost} lost; {r.counts.retainedPairs} retained of {r.counts.attemptedPairs} attempted pairs. {r.counts.stationary} stationary-feature clicks.</p>
      {Object.keys(r.lostPairs).length > 0 && <p>Pair defects (one pair can have multiple reasons): {Object.entries(r.lostPairs).map(([key,n])=>`${key}: ${n}`).join("; ")}.</p>}
      {r.intervalReasons.length > 0 && <p className="notice">{r.intervalReasons.join(" ")}</p>}
      {r.warnings.map((warning,i)=><p key={i}>{warning}</p>)}
    </details>
    <details><summary>Inspect the actual disjoint pairs used</summary><div className="table-scroll"><table data-kitchen-pairs><caption>All retained pairs; positions in metres and actual times in seconds</caption><thead><tr><th scope="col">Pair</th><th scope="col">Start time</th><th scope="col">End time</th><th scope="col">Start position</th><th scope="col">End position</th></tr></thead><tbody>{Array.from({length:r.counts.retainedPairs},(_,i)=><tr key={i}><th scope="row">{i+1}</th>{["pairTimes","pairs"].flatMap(id=>[0,1].map(c=><td key={`${id}-${c}`}>{display(array(s,id).at(2*i+c)!)}</td>))}</tr>)}</tbody></table></div></details>
  </div>;
}
