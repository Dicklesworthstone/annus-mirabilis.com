import { BM05_DEFAULTS, type Bm05Parameters } from "./definition.ts";
import { parseU64 } from "../../physics/reference/philox.ts";
import { makeRefusal } from "../results/refusals.ts";
import type { Computation } from "../../physics/reference/diffusion/ftcs.ts";
export function validateBm05Parameters(input:unknown):Computation<Bm05Parameters> {
 const bad=(requirements:string):Computation<never>=>({kind:"refused",refusal:makeRefusal("invalid-parameter",{capabilityId:"bm05.parameters"},{details:{requirements}})});
 if(!input || typeof input!=="object" || ![Object.prototype,null].includes(Object.getPrototypeOf(input)))return bad("Use a complete parameter record.");
 const keys=Object.keys(BM05_DEFAULTS);
 if(Reflect.ownKeys(input).length!==keys.length || Reflect.ownKeys(input).some(k=>typeof k!=="string" || !keys.includes(k)) || keys.some(k=>{const d=Object.getOwnPropertyDescriptor(input,k);return !d?.enumerable || !Object.hasOwn(d,"value");}))return bad("Use complete, known parameter data fields.");
 const p=input as Bm05Parameters;
 try{if(typeof p.seed!=="string")throw new Error();parseU64(p.seed);}catch{return {kind:"refused",refusal:makeRefusal("invalid-seed",{parameterIds:["seed"]})};}
 if(!["coin","uniform","gaussian"].includes(p.kernel))return {kind:"refused",refusal:makeRefusal("unsupported-kernel",{parameterIds:["kernel"]})};
 if([p.stepRms,p.tau,p.walkers,p.runSteps,p.n,p.bias].some(v=>typeof v!=="number" || !Number.isFinite(v)))return bad("Use finite numbers in the stated units.");
 if(p.stepRms<=0 || p.tau<=0 || !Number.isSafeInteger(p.walkers) || p.walkers<1 || p.walkers>10000 || !Number.isSafeInteger(p.runSteps) || p.runSteps<1 || p.runSteps>10000 || !Number.isSafeInteger(p.n) || p.n<0 || p.n>p.runSteps || p.bias<0 || p.bias>1)return bad("Use positive step RMS and interval, 1–10000 walkers and recorded steps, an integer observation within the recording, and a probability in [0,1].");
 return {kind:"accepted",data:Object.freeze({...p})};
}
