import { BM01_DEFAULTS, type Bm01Parameters } from "./definition.ts";
import { validateBm01Parameters } from "./parameters.ts";
import { parseScaledDecimal } from "../../units/decimalScale.ts";
export function encodeBm01Settings(p: Bm01Parameters): string {
 if(validateBm01Parameters(p).kind!=="accepted")throw new TypeError("Cannot share invalid tracer settings.");
 const q=new URLSearchParams({tracers:"1"});for(const k of Object.keys(BM01_DEFAULTS) as (keyof Bm01Parameters)[])q.set(k,String(p[k]));return `?${q}`;
}
export function decodeBm01Settings(search: string): {kind:"absent"}|{kind:"settings";parameters:Bm01Parameters}|{kind:"invalid";message:string} {
 if(!search || search==="?")return {kind:"absent"};
 const invalid=()=>({kind:"invalid" as const,message:"This tracer link is incomplete or unsupported. The worked example is unchanged."});
 if(search.length>4096)return invalid();const q=new URLSearchParams(search),keys=Object.keys(BM01_DEFAULTS);
 if(q.get("tracers")!=="1" || q.size!==keys.length+1 || [...q.keys()].some(k=>k!=="tracers" && !keys.includes(k)))return invalid();
 const p:Record<string,string|number>={};
 try {for(const k of keys) {if(q.getAll(k).length!==1)return invalid();const v=q.get(k)!;p[k]=k==="seed" || k==="statistic"?v:parseScaledDecimal(v,0);}}catch{return invalid();}
 const result=validateBm01Parameters(p);return result.kind==="accepted"?{kind:"settings",parameters:result.data}:invalid();
}
