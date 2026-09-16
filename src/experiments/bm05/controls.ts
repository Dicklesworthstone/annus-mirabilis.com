import { BM05_DEFAULTS, type Bm05Parameters } from "./definition.ts";
import { validateBm05Parameters } from "./parameters.ts";
import { formatScaledDecimal, parseScaledDecimal } from "../../units/decimalScale.ts";
export type WalkDraft=Record<keyof Bm05Parameters,string>;
export const BM05_FIELDS=[
 ["stepRms","Step RMS size","μm",6],["tau","Time between steps","s",0],
 ["walkers","Number of walkers","count",0],["runSteps","Recorded steps per walker","count",0],
] as const;
export function toWalkDraft(p:Bm05Parameters):WalkDraft {
 return {kernel:p.kernel,stepRms:formatScaledDecimal(p.stepRms,6),tau:String(p.tau),walkers:String(p.walkers),runSteps:String(p.runSteps),n:String(p.n),seed:p.seed,bias:String(p.bias)};
}
export function fromWalkDraft(d:WalkDraft):Bm05Parameters {
 const values:Record<string,string|number>={};
 for(const key of Object.keys(BM05_DEFAULTS) as (keyof Bm05Parameters)[])values[key]=key==="seed"||key==="kernel"?d[key]:parseScaledDecimal(d[key],key==="stepRms"?6:0);
 const r=validateBm05Parameters(values);
 if(r.kind!=="accepted")throw new TypeError(r.kind==="refused"?(typeof r.refusal.details?.requirements==="string"?r.refusal.details.requirements:r.refusal.message):r.outcome.message);
 return r.data;
}
