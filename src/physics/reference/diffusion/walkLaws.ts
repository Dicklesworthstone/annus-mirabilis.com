import { erfc } from "../special/erf.ts";
import { makeRefusal } from "../../../experiments/results/refusals.ts";
import { executionOutcomeRegistry } from "../../../experiments/results/outcomes.ts";
import type { ScientificResult } from "../../../experiments/results/types.ts";
import type { Computation } from "./ftcs.ts";

export type WalkKernel = "coin" | "uniform" | "gaussian";
export type StepKernel = Readonly<
  { kind: WalkKernel; stepRms: number } |
  { kind: "biased-coin"; stepRms: number; probability: number } |
  { kind: "cauchy"; scale: number }
>;
export const WALK_KERNELS = Object.freeze({
  coin: Object.freeze({ stepKernel: 0, drawsPerStep: 1, fourthMomentFactor: 1, excessKurtosis: -2 }),
  uniform: Object.freeze({ stepKernel: 1, drawsPerStep: 1, fourthMomentFactor: 1.8, excessKurtosis: -1.2 }),
  gaussian: Object.freeze({ stepKernel: 3, drawsPerStep: 2, fourthMomentFactor: 3, excessKurtosis: 0 }),
});
const identity = (quantityId: string, unit: string, owner: string, semanticKind = "declared-step-model") => ({ quantityId, unit, semanticKind, ownerId: `diffusion.${owner}` });
function outside(quantityId: string, unit: string, owner: string, condition: string, reason: string): ScientificResult {
  return { ...identity(quantityId, unit, owner), status: "outside-domain", domainKind: "model", condition, reason,
    boundary: { alternativeModel: "Use independent symmetric steps with finite variance, or explicitly include drift or a different transport law." } };
}
function value(quantityId: string, unit: string, owner: string, v: number, positive = false): ScientificResult {
  if (!Number.isFinite(v) || (positive && v <= 0)) return { ...identity(quantityId, unit, owner), status: "outside-domain", domainKind: "numerical", condition: "binary64-range", reason: "The result is outside the representable numerical range.", boundary: { alternativeModel: "Use a rescaled calculation." } };
  return { ...identity(quantityId, unit, owner), status: "value", value: v };
}
const invalid = (message: string): Computation<never> => ({ kind: "refused", refusal: makeRefusal("invalid-parameter", { capabilityId: "diffusion.walkLaws" }, { details: { requirements: message } }) });
const numerical = (reason: string): Computation<never> => ({ kind: "outcome", outcome: { outcome: "invariant-violation", ...executionOutcomeRegistry["invariant-violation"], details: { reason } } });
const isCount = (n: number, maximum = 10000) => Number.isSafeInteger(n) && n >= 0 && n <= maximum;

/** Analytic teaching deviations are never passed to a sampler. */
export function kernelMoments(kernel: StepKernel): Readonly<{ mean: ScientificResult; secondMoment: ScientificResult; variance: ScientificResult; fourthMoment: ScientificResult }> {
  const names = [["mean", "stepMean", "m"], ["secondMoment", "stepSecondMoment", "m2"], ["variance", "stepVariance", "m2"], ["fourthMoment", "stepFourthMoment", "m4"]] as const;
  const bad = (reason: string) => Object.fromEntries(names.map(([key, id, unit]) => [key, outside(id, unit, "kernelMoments", "finite-moments", reason)])) as ReturnType<typeof kernelMoments>;
  if (!kernel || typeof kernel !== "object") return bad("Declare a supported step kernel.");
  if (kernel.kind === "cauchy") return bad("The Cauchy step law has no finite mean, variance, or fourth moment; it does not supply this diffusion coefficient.");
  const s = kernel.stepRms;
  if (!Number.isFinite(s) || s <= 0) return bad("The step scale must be positive and finite.");
  if (kernel.kind === "biased-coin") {
    const p = kernel.probability;
    if (!Number.isFinite(p) || p < 0 || p > 1) return bad("The biased coin probability must lie between zero and one.");
    return { mean: value("stepMean", "m", "kernelMoments", (2*p-1)*s), secondMoment: value("stepSecondMoment", "m2", "kernelMoments", s*s, true), variance: value("stepVariance", "m2", "kernelMoments", 4*p*(1-p)*s*s, p>0 && p<1), fourthMoment: value("stepFourthMoment", "m4", "kernelMoments", s**4, true) };
  }
  if (!Object.hasOwn(WALK_KERNELS, kernel.kind)) return bad("Declare a supported step kernel.");
  return { mean: value("stepMean", "m", "kernelMoments", 0), secondMoment: value("stepSecondMoment", "m2", "kernelMoments", s*s, true), variance: value("stepVariance", "m2", "kernelMoments", s*s, true), fourthMoment: value("stepFourthMoment", "m4", "kernelMoments", WALK_KERNELS[kernel.kind].fourthMomentFactor*s**4, true) };
}
export function kernelDiffusivity(kernel: StepKernel, tau: number): Readonly<{ diffusion: ScientificResult; drift: ScientificResult; centeredDiffusion: ScientificResult }> {
  const m = kernelMoments(kernel);
  const bad = (id: string, unit: string, reason: string) => outside(id, unit, "kernelDiffusivity", "symmetric-finite-variance", reason);
  if (!Number.isFinite(tau) || tau <= 0 || m.mean.status !== "value" || m.variance.status !== "value" || typeof m.mean.value !== "number" || typeof m.variance.value !== "number") {
    const reason = "A positive step interval and finite step moments are required; the Cauchy variance is not finite.";
    return { diffusion: bad("diffusionCoefficient", "m2/s", reason), drift: bad("driftVelocity", "m/s", reason), centeredDiffusion: bad("centeredDiffusionCoefficient", "m2/s", reason) };
  }
  const centered = value("centeredDiffusionCoefficient", "m2/s", "kernelDiffusivity", m.variance.value/(2*tau), m.variance.value>0);
  return {
    diffusion: m.mean.value === 0 ? value("diffusionCoefficient", "m2/s", "kernelDiffusivity", m.variance.value/(2*tau), m.variance.value>0) : bad("diffusionCoefficient", "m2/s", "A nonzero mean step produces drift. The pure-diffusion argument omits that first-order term."),
    drift: value("driftVelocity", "m/s", "kernelDiffusivity", m.mean.value/tau), centeredDiffusion: centered,
  };
}
export function continuumLimit({ stepScale, tau, scaling }: { stepScale: number; tau: number; scaling: "fixed-step" | "fixed-ratio" }): ScientificResult {
  if (!Number.isFinite(stepScale) || stepScale <= 0 || !Number.isFinite(tau) || tau <= 0 || !["fixed-step", "fixed-ratio"].includes(scaling)) return outside("continuumDiffusionCoefficient", "m2/s", "continuumLimit", "positive-scale-and-interval", "Use a positive finite scale and interval and declare the limiting procedure.");
  if (scaling === "fixed-step") return outside("continuumDiffusionCoefficient", "m2/s", "continuumLimit", "hold-variance-over-time-fixed", "Shrinking the interval at fixed step size makes the coefficient grow without bound. A finite diffusion limit instead keeps step variance divided by twice the interval fixed.");
  return value("continuumDiffusionCoefficient", "m2/s", "continuumLimit", stepScale*stepScale/(2*tau), true);
}
export function randomWalkMoments(stepRms: number, tau: number, n: number): Computation<{ mean: number; meanSquare: number; rms: number; elapsedTime: number; diffusion: number }> {
  if (!isCount(n) || !Number.isFinite(stepRms) || stepRms <= 0 || !Number.isFinite(tau) || tau <= 0) return invalid("Use positive finite step RMS and interval, and 0–10000 steps.");
  const meanSquare = n*stepRms*stepRms, diffusion = stepRms*stepRms/(2*tau), elapsedTime = n*tau;
  if (![meanSquare,diffusion,elapsedTime].every(Number.isFinite) || diffusion <= 0 || (n>0 && (meanSquare===0 || elapsedTime===0))) return numerical("The moment calculation exceeded binary64 range.");
  return { kind:"accepted", data: { mean:0, meanSquare, rms:Math.sqrt(meanSquare), elapsedTime, diffusion } };
}
/** Tail-safe normal CDF, used for Kolmogorov distances, not to draw a density curve. */
export function standardNormalCdf(z: number): number {
  if (!Number.isFinite(z)) throw new RangeError("A standardized coordinate must be finite.");
  if (z < -38) return 0;
  if (z > 38) return 1;
  return 0.5*erfc(-z/Math.SQRT2);
}
export function dkwBound(W: number, alpha: number): Computation<number> {
  if (!isCount(W) || W<1 || !Number.isFinite(alpha) || alpha<=0 || alpha>=1) return invalid("Use 1–10000 walkers and a probability strictly between zero and one.");
  return { kind:"accepted", data:Math.sqrt((Math.log(2)-Math.log(alpha))/(2*W)) };
}
export function kolmogorovDistanceToGaussian(samples: Float64Array, variance: number): Computation<number> {
  if (!(samples instanceof Float64Array) || !(samples.buffer instanceof ArrayBuffer) || samples.length<1 || samples.length>10000 || !samples.every(Number.isFinite) || !Number.isFinite(variance) || variance<=0) return invalid("Use finite samples and positive variance.");
  const sorted = samples.slice().sort(), sigma = Math.sqrt(variance); let distance=0;
  for (let i=0;i<sorted.length;i++) {
    const z=sorted[i]!/sigma;
    if(!Number.isFinite(z))return numerical("A standardized sample is not representable.");
    const cdf=standardNormalCdf(z);
    distance=Math.max(distance, Math.abs(cdf-i/sorted.length),Math.abs((i+1)/sorted.length-cdf));
  }
  return {kind:"accepted",data:distance};
}
export type CoinDistribution = Readonly<{ positions: Float64Array; probabilities: Float64Array; coefficients?: readonly string[]; denominator?: string }>;
/** Exact integer coefficients through n=64; positive center-out recurrence otherwise.
 * Central normalization avoids cancellation and factorial overflow. Extreme tails
 * beyond binary64 at large n round to zero; no such tails occur in the n<=400 fixtures.
 */
export function coinWalkDistribution(n: number, ell: number): Computation<CoinDistribution> {
  if (!isCount(n) || !Number.isFinite(ell) || ell<=0 || !Number.isFinite(n*ell)) return invalid("Use 0–10000 steps and a positive finite step scale.");
  const positions=Float64Array.from({length:n+1},(_,k)=>(2*k-n)*ell), probabilities=new Float64Array(n+1);
  if (n<=64) {
    const coefficients:string[]=[]; const denominator=1n<<BigInt(n); let coefficient=1n;
    for(let k=0;k<=n;k++) { coefficients.push(coefficient.toString()); probabilities[k]=Number(coefficient)/Number(denominator);if(k<n)coefficient=coefficient*BigInt(n-k)/BigInt(k+1); }
    return {kind:"accepted",data:{positions,probabilities,coefficients,denominator:denominator.toString()}};
  }
  const mid=Math.floor(n/2); probabilities[mid]=1;
  for(let k=mid;k<n;k++)probabilities[k+1]=probabilities[k]!*(n-k)/(k+1);
  for(let k=mid;k>0;k--)probabilities[k-1]=probabilities[k]!*k/(n-k+1);
  let total=0,correction=0;
  for(const p of probabilities) { const y=p-correction, t=total+y;correction=(t-total)-y;total=t; }
  for(let k=0;k<=n;k++)probabilities[k]=probabilities[k]!/total;
  return {kind:"accepted",data:{positions,probabilities}};
}
/** Irwin-Hall CDF/PDF via positive cardinal-spline recurrence. The CDF recurrence
 * follows by integrating the density recurrence and collecting the two terms:
 * F_n(x)=[x F_(n-1)(x)+(n-x) F_(n-1)(x-1)]/n.
 * https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.irwinhall.html
 * https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.BSpline.html
 * O(n²) bounded arithmetic; no alternating sum of enormous powers.
 */
export function uniformSumDistribution(n: number, x: number): { cdf: number; pdf: number } {
  if (!isCount(n,400) || n<1 || !Number.isFinite(x)) throw new RangeError("Uniform sums admit 1–400 steps and finite coordinates.");
  if(x<=0)return {cdf:0,pdf:n===1 && x===0?1:0};
  if(x>=n)return {cdf:1,pdf:0};
  const c=new Float64Array(n), d=new Float64Array(n);
  for(let k=0;k<n;k++) { const y=x-k;c[k]=y<=0?0:y>=1?1:y;d[k]=y>=0 && y<1?1:0; }
  for(let order=2;order<=n;order++)for(let k=0;k<=n-order;k++) {
    const y=x-k;
    if(y<=0) {c[k]=0;d[k]=0;}
    else if(y>=order) {c[k]=1;d[k]=0;}
    else {c[k]=(y*c[k]!+(order-y)*c[k+1]!)/order;d[k]=(y*d[k]!+(order-y)*d[k+1]!)/(order-1);}
  }
  return {cdf:c[0]!,pdf:d[0]!};
}
export type ShapeTerm=Readonly<{ distance:number; location:number; method:string; resolution:number }>;
/** The mathematical distribution is exact; its evaluated distance is numerical,
 * not an interval-arithmetic enclosure. Both one-sided limits are checked at atoms.
 */
export function kolmogorovShapeTerm(kernel: WalkKernel, n: number): Computation<ShapeTerm> {
  if(!Object.hasOwn(WALK_KERNELS,kernel) || !isCount(n) || n<1)return invalid("Choose a supported symmetric kernel and 1–10000 steps.");
  if(kernel==="gaussian")return {kind:"accepted",data:{distance:0,location:0,method:"Gaussian sums are Gaussian.",resolution:0}};
  if(kernel==="coin") {
    const distribution=coinWalkDistribution(n,1);if(distribution.kind!=="accepted")return distribution;
    let cdf=0,distance=0,location=0;
    for(let k=0;k<=n;k++) {
      const z=(2*k-n)/Math.sqrt(n),normal=standardNormalCdf(z),p=distribution.data.probabilities[k]!;
      const candidate=Math.max(Math.abs(cdf-normal),Math.abs(cdf+p-normal));
      if(candidate>distance) {distance=candidate;location=z;} cdf+=p;
    }
    return {kind:"accepted",data:{distance,location,method:"Binomial enumeration, both limits at every atom.",resolution:0}};
  }
  if(n>400)return {kind:"outcome",outcome:{outcome:"budget-exhausted",...executionOutcomeRegistry["budget-exhausted"],requested:{workUnits:n*n,allocationBytes:n*16},allowed:{workUnits:400*400,allocationBytes:400*16},details:{reason:"The exact uniform-sum shape comparison is bounded to 400 steps. Choose at most 400 steps, or a different step law."}}};
  const scale=Math.sqrt(n/12), support=Math.sqrt(3*n), end=Math.min(9,support);
  const evaluate=(z:number)=>{const {cdf,pdf}=uniformSumDistribution(n,n/2-z*scale);return {error:standardNormalCdf(-z)-cdf, derivative:pdf*scale-Math.exp(-z*z/2)/Math.sqrt(2*Math.PI)};};
  let distance=0,location=0;
  const consider=(z:number)=>{const e=Math.abs(evaluate(z).error);if(e>distance){distance=e;location=z;}};
  let a=0,fa=evaluate(a).derivative;
  // Bracket density crossings and refine their standardized coordinates. Include
  // all support boundaries and knots (important for the single uniform step).
  const segments=Math.ceil(end/.05);
  for(let j=1;j<=segments;j++) {
    const b=end*j/segments,fb=evaluate(b).derivative;
    consider(b);
    if(fa*fb<0) {
      let lo=a,hi=b,flo=fa;
      for(let i=0;i<32 && hi-lo>1e-10;i++) {const mid=(lo+hi)/2,f=evaluate(mid).derivative;if(flo*f<=0)hi=mid;else {lo=mid;flo=f;}}
      consider((lo+hi)/2);
    }
    a=b;fa=fb;
  }
  for(let k=Math.ceil(n/2);k<=n;k++){const z=(k-n/2)/scale;if(z<=end)consider(z);}
  return {kind:"accepted",data:{distance,location,method:"Irwin–Hall cardinal-spline recurrence with bracketed density crossings.",resolution:1e-10}};
}
