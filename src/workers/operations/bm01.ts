import { BM01_OUTPUTS, TRACE_COUNT, TRACE_POINTS, HISTOGRAM_BINS, comparisonIndices, type Bm01Parameters } from "../../experiments/bm01/definition.ts";
import { validateBm01Parameters } from "../../experiments/bm01/parameters.ts";
import { getConstantSet } from "../../physics/reference/constants.ts";
import { stokesEinsteinD, rmsDisplacement, moments, apparentSpeed, intervalProbability } from "../../physics/reference/diffusion.ts";
import { recordTracers, tracerDisplacements, ensembleMoments, displacementHistogram, observationGridCheck, type TracerRecording } from "../../physics/reference/diffusion/tracers.ts";
import { ensembleMomentBands } from "../../physics/reference/diffusion/statistics.ts";
import type { ScientificResult } from "../../experiments/results/types.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
import { makeRefusal } from "../../experiments/results/refusals.ts";
export type Bm01Evaluation = Readonly<{ outputs: readonly ScientificResult[]; stepIndex: number; simulationTime: number }>;
function value(result: ScientificResult): number { if(result.status!=="value" || typeof result.value!=="number") throw new RangeError("A model value was not numerically representable.");return result.value; }
function unwrap<T>(r: Computation<T>): T { if(r.kind!=="accepted") throw new RangeError("A reduction was not numerically representable.");return r.data; }
function number(id: string, v: number | Float64Array): ScientificResult {
 const contract=BM01_OUTPUTS[id]!;
 if(typeof v==="number" ? !Number.isFinite(v) : !v.every(Number.isFinite))throw new RangeError("Nonfinite result.");
 return {quantityId:id,unit:contract.unit,semanticKind:contract.semanticKind,ownerId:contract.ownerId,status:"value",value:v};
}
function notApplicable(id: string, reason: string): ScientificResult { const c=BM01_OUTPUTS[id]!;return {quantityId:id,unit:c.unit,semanticKind:c.semanticKind,ownerId:c.ownerId,status:"not-applicable",reason}; }
function failed(): Computation<never> { return {kind:"outcome",outcome:{outcome:"invariant-violation",...executionOutcomeRegistry["invariant-violation"]}}; }
export async function createBm01Recording(input: unknown, options: Parameters<typeof recordTracers>[1] = {}): Promise<Computation<TracerRecording>> {
 const p=validateBm01Parameters(input);if(p.kind!=="accepted")return p;
 const D=stokesEinsteinD(p.data,getConstantSet("modern-si-2019")).result;
 if(D.status!=="value" || typeof D.value!=="number")return {kind:"refused",refusal:makeRefusal("invalid-parameter",{parameterIds:["T","eta","a"]},{details:{requirements:"These physical inputs do not produce a representable diffusion coefficient."}})};
 const grid=observationGridCheck(p.data.interval,p.data.h,Math.round(p.data.H/p.data.h));if(grid.kind!=="accepted")return grid;
 return recordTracers({M:p.data.M,steps:Math.round(p.data.H/p.data.h),h:p.data.h,D:D.value,seed:p.data.seed},options);
}
/** Every displayed statistic and model curve is assembled here, never inside a view. */
export function measureBm01(recording: TracerRecording, p: Bm01Parameters, reused: boolean): Computation<Bm01Evaluation> {
 const checked=validateBm01Parameters(p);if(checked.kind!=="accepted")return checked;
 const selected=observationGridCheck(p.interval,p.h,recording.setup.steps);if(selected.kind!=="accepted")return selected;
 try {
  const D=recording.setup.D;
  if(p.M!==recording.setup.M || p.seed!==recording.setup.seed || p.h!==recording.setup.h || Math.round(p.H/p.h)!==recording.setup.steps || value(stokesEinsteinD(p,getConstantSet("modern-si-2019")).result)!==D) return failed();
  const step=selected.data, positions=tracerDisplacements(recording,step,3);
  const all=unwrap(ensembleMoments({displacements:positions,d:3})), measured=unwrap(ensembleMoments({displacements:tracerDisplacements(recording,step,p.d),d:p.d}));
  const axis=all.axes[p.axis]!, sigma=value(rmsDisplacement(D,p.interval).result), model=moments(p.d,D,p.interval);
  const outputs:ScientificResult[]=[number("diffusionCoefficient",D),number("rmsDisplacement1d",sigma),number("modelSecondMoment",value(model.total.result)),number("modelMeanNorm",value(model.meanRadius.result)),number("modelRmsNorm",value(model.rmsRadius.result)),number("tracerPositions",positions)];
  for (const [id, v] of [["sampleMean",axis.mean],["sampleMeanAbsolute",axis.meanAbsolute],["sampleMeanSquare",axis.meanSquare],["sampleRms",axis.rms],["sampleMeanNorm",measured.meanNorm],["sampleMeanSquareNorm",measured.meanSquareNorm],["sampleRmsNorm",measured.rmsNorm]] as const) outputs.push(number(id,v));
  for(const [id, speed] of [["modelApparentSpeed",p.interval>0?value(apparentSpeed(D,p.interval).result):null],["sampledApparentSpeed",p.interval>0?axis.rms/p.interval:null]] as const)outputs.push(speed===null?notApplicable(id,"An apparent speed requires a positive observation interval."):number(id,speed));
  const traceTimes=new Float64Array(TRACE_POINTS), traces=new Float64Array(Math.min(TRACE_COUNT,p.M)*TRACE_POINTS*2);
  for(let k=0;k<TRACE_POINTS;k++) {const index=Math.floor(step*k/(TRACE_POINTS-1));traceTimes[k]=index*p.h;for(let i=0;i<Math.min(TRACE_COUNT,p.M);i++)for(let a=0;a<2;a++)traces[(i*TRACE_POINTS+k)*2+a]=recording.values[(i*3+a)*(recording.setup.steps+1)+index]!;}
  outputs.push(number("traceCoordinates",traces),number("traceTimes",traceTimes));
  const span=sigma>0?5*sigma:1e-6, edges=Float64Array.from({length:HISTOGRAM_BINS+1},(_,i)=>span*(2*i/HISTOGRAM_BINS-1));
  const samples=Float64Array.from({length:p.M},(_,i)=>positions[i*3+p.axis]!);
  const histogram=unwrap(displacementHistogram(samples,edges));
  const modelBins=Float64Array.from({length:HISTOGRAM_BINS},(_,i)=>p.interval===0 ? (edges[i]!<=0 && (0<edges[i+1]! || i===HISTOGRAM_BINS-1)?1:0) : value(intervalProbability(edges[i]!,edges[i+1]!,p.interval,D).result));
  outputs.push(number("histogramEdges",edges),number("histogramCounts",histogram.counts),number("histogramFrequencies",histogram.counts.map(n=>n/p.M)),number("histogramModel",modelBins),number("underflow",histogram.underflow),number("overflow",histogram.overflow));
  const indices=comparisonIndices(recording.setup.steps), times=Float64Array.from(indices,i=>i*p.h), plots=Object.fromEntries(["SampleMean","SampleMsd","SampleRms","SampleApparent","ModelMean","ModelMsd","ModelRms","ModelApparent"].map(id=>[id,new Float64Array(indices.length)]));
  for(let i=0;i<indices.length;i++) {
   const time=times[i]!, xyz=tracerDisplacements(recording,indices[i]!,3), stats=unwrap(ensembleMoments({displacements:tracerDisplacements(recording,indices[i]!,p.d),d:p.d})), coordinate=unwrap(ensembleMoments({displacements:xyz,d:3})).axes[p.axis]!;
   const prediction=moments(p.d,D,time);
   plots.SampleMean![i]=coordinate.mean; plots.SampleMsd![i]=stats.meanSquareNorm; plots.SampleRms![i]=stats.rmsNorm; plots.SampleApparent![i]=coordinate.rms/time;
   plots.ModelMean![i]=0; plots.ModelMsd![i]=value(prediction.total.result); plots.ModelRms![i]=value(prediction.rmsRadius.result); plots.ModelApparent![i]=value(apparentSpeed(D,time).result);
  }
  outputs.push(number("plotTimes",times)); for (const [id, data] of Object.entries(plots)) outputs.push(number(`plot${id}`,data));
  if(p.M<2 || p.interval===0) {
   for(const id of ["meanBand","secondMomentBand"]) {const c=BM01_OUTPUTS[id]!;const common={quantityId:id,unit:c.unit,semanticKind:c.semanticKind,ownerId:c.ownerId};outputs.push(p.M<2?{...common,status:"underdetermined",compatibleFamily:"One realization is not an ensemble sampling comparison.",neededInformation:["Use at least two tracers."]}:{...common,status:"analytic-limit",description:"At the starting point all displacements and their sampling spread are zero.",representation:{kind:"coefficient",value:0}});}
  } else {
   const band=unwrap(ensembleMomentBands({M:p.M,d:p.d,modelVariance:sigma*sigma,alphas:[.001]}))[0]!;
   outputs.push(number("meanBand",Float64Array.from([-band.meanHalfWidth,band.meanHalfWidth])),number("secondMomentBand",Float64Array.from(band.totalMeanSquare)));
  }
  outputs.push(number("recordingDraws",recording.draws),number("reusedRecording",reused?1:0));
  return {kind:"accepted",data:{outputs,stepIndex:recording.setup.steps,simulationTime:p.H}};
 } catch {return failed();}
}
