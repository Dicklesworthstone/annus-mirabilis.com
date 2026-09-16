import type { ExperimentView, OutputContract } from "../store/instanceStore.ts";
export type ExecutionState=Readonly<{label:"static"|"host"|"unavailable";text:string;sourceDigest:string;owners:readonly string[]}>;
/** A label is earned by accepted owner contracts, never by worker/WASM loader state. */
export function deriveHostExecution(view:ExperimentView,contracts:Readonly<Record<string,OutputContract>>,sourceDigest:string,isStatic:boolean):ExecutionState {
  const outputs=view.accepted?.outputs;
  if(!outputs?.length || !/^source:sha256:[a-f0-9]{64}$/.test(sourceDigest) || outputs.some(o=>!Object.hasOwn(contracts,o.quantityId) || o.ownerId!==contracts[o.quantityId]!.ownerId || o.unit!==contracts[o.quantityId]!.unit || o.semanticKind!==contracts[o.quantityId]!.semanticKind))return {label:"unavailable",text:"Calculation provenance is unavailable",sourceDigest:"",owners:[]};
  return {label:isStatic?"static":"host",text:isStatic?"Static worked example":"Ideal model, host calculation",sourceDigest,owners:[...new Set(outputs.map(o=>o.ownerId))]};
}
