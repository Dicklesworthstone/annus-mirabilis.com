import { KITCHEN_OUTPUTS, type KitchenOptions, type KitchenAnalysis } from "./definition.ts";
import { KITCHEN_LIMITS, type KitchenDocument } from "./schema.ts";
import { parseKitchenCsv } from "./csv.ts";
import { decodeResultBatch } from "../../results/codec.ts";
import type { RequestToken } from "../../store/instanceStore.ts";
export const KITCHEN_PROTOCOL = "kitchen-import-host-v1";
export type KitchenRequest = Readonly<{ version: typeof KITCHEN_PROTOCOL; sourceDigest: string; token: RequestToken; csv: string }>;
export type KitchenResponse = Readonly<{ version: typeof KITCHEN_PROTOCOL; sourceDigest: string; token: RequestToken; result: { kind: "accepted"; analysis: KitchenAnalysis } | { kind: "refused"; message: string } }>;
export function closed(input: unknown, keys: readonly string[]): asserts input is Record<string, unknown> {
  if (!input || typeof input !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Reflect.ownKeys(input).length !== keys.length || Reflect.ownKeys(input).some(k => typeof k !== "string" || !keys.includes(k) || !Object.hasOwn(Object.getOwnPropertyDescriptor(input,k)!,"value"))) throw new TypeError("Unrecognized data contract.");
}
export function checkCsvSize(csv: unknown): asserts csv is string {
  if (typeof csv !== "string" || csv.length > KITCHEN_LIMITS.bytes || new TextEncoder().encode(csv).byteLength > KITCHEN_LIMITS.bytes) throw new TypeError("The observation CSV must be at most 2 MiB.");
}
export async function textDigest(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return `sha256:${Array.from(bytes, b => b.toString(16).padStart(2,"0")).join("")}`;
}
export function validateKitchenOptions(raw: unknown): KitchenOptions {
  closed(raw, ["track","axis","coverage","constantSet"]);
  if (typeof raw.track !== "string" || raw.track.length > 256 || !["x","y"].includes(String(raw.axis)) || typeof raw.coverage !== "number" || !Number.isFinite(raw.coverage) || raw.coverage < .5 || raw.coverage > .999 || !["metadata","modern-si-2019","scenario-gas-constant-measured"].includes(String(raw.constantSet))) throw new TypeError("Choose a track, x or y, a registered constant set and 50–99.9% coverage.");
  return Object.freeze({ ...raw }) as KitchenOptions;
}
export function optionsFromToken(token: RequestToken): KitchenOptions {
  const {track,axis,coverage,constantSet} = token.parameters;
  return validateKitchenOptions({track,axis,coverage,constantSet});
}
function source(digest: string) { if (!/^source:sha256:[a-f0-9]{64}$/.test(digest)) throw new TypeError("Missing evaluator source identity."); }
function tokenContract(input: unknown): asserts input is RequestToken {
  closed(input,["instanceId","experimentId","runId","actionIndex","revisions","parameters"]);
  if (input.experimentId !== "bm-07-kitchen" || typeof input.instanceId !== "string" || input.instanceId.length > 256 || typeof input.runId !== "string" || input.runId.length > 512 || !Number.isSafeInteger(input.actionIndex) || Number(input.actionIndex)<1) throw new TypeError("Wrong observation request identity.");
  closed(input.revisions,["input","observer","measurement","estimator"]);
  if (Object.values(input.revisions).some(v=>!Number.isSafeInteger(v)||Number(v)<0)) throw new TypeError("Invalid observation revision.");
  closed(input.parameters,["sourceId","documentDigest","track","axis","coverage","constantSet"]);
  for (const key of ["sourceId","documentDigest"]) if (typeof input.parameters[key] !== "string" || !/^sha256:[a-f0-9]{64}$/.test(input.parameters[key])) throw new TypeError("Missing observation digest.");
  optionsFromToken(input as RequestToken);
}
export async function decodeKitchenRequest(input: unknown, expectedSource: string): Promise<KitchenRequest> {
  closed(input,["version","sourceDigest","token","csv"]);source(expectedSource);
  if (input.version !== KITCHEN_PROTOCOL || input.sourceDigest !== expectedSource) throw new TypeError("The page and observation worker have different source versions.");
  tokenContract(input.token);checkCsvSize(input.csv);
  if (await textDigest(input.csv) !== input.token.parameters.documentDigest) throw new TypeError("The observation content does not match this request.");
  return input as KitchenRequest;
}
export function decodeKitchenResponse(input: unknown, request: KitchenRequest): { message: KitchenResponse; document: KitchenDocument | null } {
  closed(input,["version","sourceDigest","token","result"]);source(request.sourceDigest);tokenContract(input.token);
  if (input.version !== KITCHEN_PROTOCOL || input.sourceDigest !== request.sourceDigest || JSON.stringify(input.token)!==JSON.stringify(request.token)) throw new TypeError("The observation response belongs to a different request.");
  const r=input.result as KitchenResponse["result"];
  if(r?.kind==="refused") {closed(r,["kind","message"]);if(typeof r.message!=="string"||r.message.length>4096)throw new TypeError("Invalid refusal.");return {message:input as KitchenResponse,document:null};}
  closed(r,["kind","analysis"]);if(r.kind!=="accepted")throw new TypeError("Unknown observation response.");
  const a=r.analysis;closed(a,["options","tracks","selectedTrack","outputs","warnings","intervalReasons","counts","lostPairs","scale","scaleSource","constantSetId","gasConstantProvenance","numberMeaning","combinedIntervalReason"]);
  if(JSON.stringify(validateKitchenOptions(a.options))!==JSON.stringify(optionsFromToken(request.token)))throw new TypeError("Wrong analysis options.");
  const document=parseKitchenCsv(request.csv);
  if(!Array.isArray(a.tracks)||a.tracks.length>document.points.length||!a.tracks.some(t=>t.key===a.selectedTrack))throw new TypeError("Wrong selected track.");
  for(const t of a.tracks){closed(t,["key","label","indices"]);if(typeof t.key!=="string"||t.key.length>256||typeof t.label!=="string"||t.label.length>256||!Array.isArray(t.indices)||t.indices.length>document.points.length||t.indices.some(i=>!Number.isInteger(i)||i<0||i>=document.points.length))throw new TypeError("Invalid track layout.");}
  for(const key of ["warnings","intervalReasons"] as const)if(!Array.isArray(a[key])||a[key].length>64||a[key].some(s=>typeof s!=="string"||s.length>4096))throw new TypeError("Invalid interval explanation.");
  closed(a.counts,["measured","interpolated","excluded","lost","attemptedPairs","retainedPairs","stationary"]);
  if(Object.values(a.counts).some(n=>!Number.isSafeInteger(n)||n<0||n>20000)||a.counts.retainedPairs>a.counts.attemptedPairs)throw new TypeError("Invalid observation counts.");
  if(!["measured","derived","unknown"].includes(a.scaleSource)||a.scale!==null&&(!(a.scale>0)||!Number.isFinite(a.scale))||!["synthetic-recovery","independent-estimate","consistency-check","unavailable"].includes(a.numberMeaning))throw new TypeError("Invalid calibration or interpretation.");
  for(const key of ["constantSetId","gasConstantProvenance","combinedIntervalReason"] as const)if(typeof a[key]!=="string"||a[key].length>4096)throw new TypeError("Invalid provenance.");
  if(!a.lostPairs||typeof a.lostPairs!=="object"||Object.keys(a.lostPairs).length>16||Object.entries(a.lostPairs).some(([k,v])=>k.length>80||!Number.isInteger(v)||v<0||v>20000))throw new TypeError("Invalid lost-pair report.");
  const outputs=decodeResultBatch({revisions:request.token.revisions,outputs:a.outputs},{expectedRevisions:request.token.revisions,allowPartial:true,statuses:Object.fromEntries(Object.entries(KITCHEN_OUTPUTS).map(([k,c])=>[k,c.statuses]))}).outputs;
  for(const output of outputs){const c=KITCHEN_OUTPUTS[output.quantityId as keyof typeof KITCHEN_OUTPUTS];if(output.ownerId!==c.ownerId||output.unit!==c.unit||output.semanticKind!==c.semanticKind)throw new TypeError("Mismatched observation quantity.");if(output.status!=="value")continue;
    const length=["pairs","pairTimes"].includes(output.quantityId)?2*a.counts.retainedPairs:["diffusionInterval","molecularInterval"].includes(output.quantityId)?2:null;
    if(length===null?typeof output.value!=="number":!(output.value instanceof Float64Array)||output.value.length!==length)throw new TypeError("Malformed observation buffer.");
    if(output.quantityId==="pairCount"&&output.value!==a.counts.retainedPairs||output.quantityId==="pairDegrees"&&output.value!==Math.max(0,a.counts.retainedPairs-1))throw new TypeError("Wrong pair degrees of freedom.");
    if(["diffusionInterval","molecularInterval"].includes(output.quantityId)){const b=output.value as Float64Array;if(a.intervalReasons.length||b[0]!<0||b[0]!>b[1]!)throw new TypeError("Inadmissible confidence set.");}
    if(["molecularNumber","molecularInterval"].includes(output.quantityId)&&document.metadata.radius_provenance!=="independent")throw new TypeError("Circular or undeclared radius.");
  }
  return {message:{...input,result:{kind:"accepted",analysis:{...a,outputs}}} as KitchenResponse,document};
}
