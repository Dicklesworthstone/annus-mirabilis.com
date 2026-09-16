import { ContentError } from "../content/compiler/json.ts";
import { rational } from "../content/dimensions/rational.ts";
import type { QuantityRegistry } from "./quantities.ts";
export type ExactScale = Readonly<{ num: number; den: number }>;
type Op = Readonly<{ opId?: string }>;
export type Expression =
  | Readonly<{ kind: "symbol"; termId: string; quantityId: string; scale?: ExactScale }>
  | Readonly<{ kind: "number"; value: string }>
  | (Op & Readonly<{ kind: "sum" | "product"; args: readonly Expression[] }>)
  | (Op & Readonly<{ kind: "quotient"; numerator: Expression; denominator: Expression }>)
  | (Op & Readonly<{ kind: "power"; base: Expression; exponent: ExactScale }>)
  | (Op & Readonly<{ kind: "root"; radicand: Expression; degree: number }>)
  | (Op & Readonly<{ kind: "negate" | "average" | "group"; argument: Expression }>)
  | (Op & Readonly<{ kind: "function"; name: "exp" | "ln" | "sin" | "cos"; argument: Expression }>)
  | (Op & Readonly<{ kind: "relation"; operator: "=" | "approx" | "define"; left: Expression; right: Expression }>)
  | (Op & Readonly<{ kind: "derivative"; expression: Expression; variable: Expression; order: number; partial: boolean }>)
  | (Op & Readonly<{ kind: "integral"; expression: Expression; variable: Expression }>);
export function children(n: Expression): readonly Expression[] {
  switch (n.kind) {
    case "symbol": case "number": return [];
    case "sum": case "product": return n.args;
    case "quotient": return [n.numerator,n.denominator];
    case "power": return [n.base]; case "root": return [n.radicand];
    case "negate": case "average": case "group": case "function": return [n.argument];
    case "relation": return [n.left,n.right];
    case "derivative": case "integral": return [n.expression,n.variable];
  }
}
export const nodeId = (n: Expression): string | null => n.kind === "symbol" ? n.termId : "opId" in n ? n.opId ?? null : null;
export function walk(root: Expression): readonly Expression[] { return [root, ...children(root).flatMap(walk)]; }
function fail(path: string, message: string): never { throw new ContentError("equation-invalid",path,message); }
export function record(x: unknown, path: string, required: readonly string[], optional: readonly string[] = []): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x) || ![null,Object.prototype].includes(Object.getPrototypeOf(x))) return fail(path,"Expected a plain record.");
  const descriptors = Object.getOwnPropertyDescriptors(x);
  for (const key of Reflect.ownKeys(x)) if (typeof key !== "string" || ![...required,...optional].includes(key) || !descriptors[key]?.enumerable || !Object.hasOwn(descriptors[key]!,"value")) fail(path,"Unexpected field or accessor.");
  for (const key of required) if (!Object.hasOwn(descriptors,key)) fail(path,`Missing field ${key}.`);
  return x as Record<string,unknown>;
}
export function exactScale(input: unknown, path: string, nonzero = false): ExactScale {
  const o=record(input,path,["num","den"]);
  if (!Number.isSafeInteger(o.num) || !Number.isSafeInteger(o.den) || Number(o.den)<=0 || (nonzero && o.num===0)) return fail(path,"Expected an exact rational with positive denominator.");
  const reduced=rational(BigInt(o.num as number),BigInt(o.den as number));
  if (reduced.num!==BigInt(o.num as number) || reduced.den!==BigInt(o.den as number)) return fail(path,"Write the scale in lowest terms.");
  return {num:o.num as number,den:o.den as number};
}
export function parseExpression(input: unknown, equationId: string, registry: QuantityRegistry): Expression {
  if (!/^(?:eq-(?:s\d+-)?(?:d)?\d+|eq-model-[a-z0-9-]+)$/.test(equationId)) fail(equationId,"Invalid equation identity.");
  const ids=new Set<string>(); let count=0;
  function identity(value: unknown, kind: "t"|"op",path: string) {
    if(typeof value!=="string" || !value.startsWith(`${equationId}.${kind}.`) || !/^[a-z][A-Za-z0-9]{0,47}$/.test(value.slice(equationId.length+kind.length+2))) fail(path,"Selectable identities must be authored and equation-qualified.");
    if(ids.has(value))fail(path,`Duplicate selectable identity: ${value}.`);ids.add(value);
  }
  function parse(x: unknown,path: string,depth: number): Expression {
    if(++count>256 || depth>24)fail(path,"Expression budget exceeded.");
    const kind=x && typeof x==="object" ? Object.getOwnPropertyDescriptor(x,"kind")?.value : null;
    const fields:Record<string,readonly string[]>={symbol:["termId","quantityId"],number:["value"],sum:["args"],product:["args"],quotient:["numerator","denominator"],power:["base","exponent"],root:["radicand","degree"],negate:["argument"],average:["argument"],group:["argument"],function:["name","argument"],relation:["operator","left","right"],derivative:["expression","variable","order","partial"],integral:["expression","variable"]};
    if(typeof kind!=="string" || !Object.hasOwn(fields,kind))fail(path,"Unsupported expression kind.");
    const o=record(x,path,["kind",...fields[kind]!],kind==="symbol"?["scale"]:kind==="number"?[]:["opId"]);
    if(kind==="symbol") {
      identity(o.termId,"t",path);
      if(typeof o.quantityId!=="string" || !Object.hasOwn(registry,o.quantityId))fail(path,"Bind to an exact registered quantity id, not a glyph or label.");
      if(Object.hasOwn(o,"scale"))exactScale(o.scale,path,true);
    } else if(kind==="number") {
      if(typeof o.value!=="string" || o.value.length>80 || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[+-]?\d+)?$/.test(o.value) || !Number.isFinite(Number(o.value)))fail(path,"Expected an exact decimal literal, not executable TeX.");
    } else {
      if(Object.hasOwn(o,"opId"))identity(o.opId,"op",path);
      if(kind==="sum" || kind==="product") {
        if(!Array.isArray(o.args) || o.args.length<2 || o.args.length>32)fail(path,"Expected 2–32 operands.");
        o.args.forEach((v,i)=>parse(v,`${path}.args[${i}]`,depth+1));
      } else {
        for(const key of fields[kind]!)if(!["degree","exponent","name","operator","order","partial"].includes(key))parse(o[key],`${path}.${key}`,depth+1);
      }
      if(kind==="power")exactScale(o.exponent,path);
      if(kind==="root" && (!Number.isSafeInteger(o.degree) || Number(o.degree)<2 || Number(o.degree)>32))fail(path,"Root degree must be 2–32.");
      if(kind==="function" && !["exp","ln","sin","cos"].includes(String(o.name)))fail(path,"Unsupported function.");
      if(kind==="relation" && !["=","approx","define"].includes(String(o.operator)))fail(path,"Unsupported relation.");
      if(kind==="derivative" && (!Number.isSafeInteger(o.order) || Number(o.order)<1 || Number(o.order)>4 || typeof o.partial!=="boolean"))fail(path,"Unsupported derivative order.");
      if((kind==="derivative" || kind==="integral") && (o.variable as Expression).kind!=="symbol")fail(path,"The variable must be a bound symbol.");
    }
    return x as Expression;
  }
  parse(input,equationId,0);
  function freeze<T>(x:T):T {if(x && typeof x==="object"){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
  return freeze(structuredClone(input) as Expression);
}
export const findNode = (root: Expression,id: string): Expression | undefined => walk(root).find(n=>nodeId(n)===id);
export const quantityBindings = (root: Expression) => walk(root).filter((n):n is Extract<Expression,{kind:"symbol"}>=>n.kind==="symbol").map(n=>({termId:n.termId,quantityId:n.quantityId,scale:n.scale??{num:1,den:1}}));
/** Canonical serialization carries authored identities and exact scales; object key order is irrelevant. */
export function canonical(value: unknown): string {
  if(value===null || typeof value!=="object")return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(",")}]`;
  const o=value as Record<string,unknown>;return `{${Object.keys(o).sort().map(k=>`${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
}
export function substitute(root:Expression,id:string,replacement:Expression,equationId:string,registry:QuantityRegistry):Expression {
  if(!findNode(root,id))throw new RangeError("The substitution target is not in this expression.");
  function visit(n:unknown):unknown {
    if(!n || typeof n!=="object")return n;
    if(Array.isArray(n))return n.map(visit);
    if(nodeId(n as Expression)===id)return replacement;
    return Object.fromEntries(Object.entries(n).map(([k,v])=>[k,visit(v)]));
  }
  return parseExpression(visit(root),equationId,registry);
}
