import { BM05_DEFAULTS, type Bm05Parameters } from "./definition.ts";
import { validateBm05Parameters } from "./parameters.ts";
import { parseScaledDecimal } from "../../units/decimalScale.ts";
export function encodeBm05Settings(p:Bm05Parameters):string {
 if(validateBm05Parameters(p).kind!=="accepted")throw new TypeError("Cannot share invalid walk settings.");
 const q=new URLSearchParams({walk:"1"});for(const key of Object.keys(BM05_DEFAULTS) as (keyof Bm05Parameters)[])q.set(key,String(p[key]));return `?${q}`;
}
export function decodeBm05Settings(search:string):{kind:"absent"}|{kind:"settings";parameters:Bm05Parameters}|{kind:"invalid";message:string} {
 if(!search||search==="?")return {kind:"absent"};
 const invalid=()=>({kind:"invalid" as const,message:"This walk link is incomplete or unsupported. The worked example is unchanged."});
 if(search.length>4096)return invalid();const q=new URLSearchParams(search),keys=Object.keys(BM05_DEFAULTS);
 if(q.get("walk")!=="1"||q.size!==keys.length+1||[...q.keys()].some(key=>key!=="walk"&&!keys.includes(key)))return invalid();
 const p:Record<string,string|number>={};
 try{for(const key of keys){if(q.getAll(key).length!==1)return invalid();const v=q.get(key)!;p[key]=key==="kernel"||key==="seed"?v:parseScaledDecimal(v,0);}}catch{return invalid();}
 const r=validateBm05Parameters(p);return r.kind==="accepted"?{kind:"settings",parameters:r.data}:invalid();
}
