import { dimension, DIMENSIONLESS, combine, power, rational, sameDimension, dimensionText, type Dimension } from "../content/dimensions/rational.ts";
import { nodeId, type Expression } from "./ast.ts";
import type { QuantityRegistry } from "./quantities.ts";
export type DimensionCheck = Readonly<{ status:"consistent"; dimension:Dimension } | {status:"inconsistent"|"semantic-mismatch"|"unsupported-check"; nodeId:string|null; reason:string}>;
/** Dimensions prove unit consistency, not a physical law or an arbitrary semantic equivalence. */
export function checkDimensions(root:Expression,registry:QuantityRegistry):DimensionCheck {
  const stop=(n:Expression,status:Exclude<DimensionCheck["status"],"consistent">,reason:string):never=>{throw {status,nodeId:nodeId(n),reason};};
  const kind=(n:Expression):string|null=>n.kind==="symbol"?registry[n.quantityId]?.semanticKind??null:n.kind==="group"?kind(n.argument):null;
  function equal(n:Expression,a:Expression,b:Expression):Dimension {
    const da=visit(a),db=visit(b);
    if(!sameDimension(da,db))stop(n,"inconsistent",`Different dimensions: [${dimensionText(da)}] and [${dimensionText(db)}].`);
    const ka=kind(a),kb=kind(b);
    if(ka && kb && ka!==kb)stop(n,"semantic-mismatch",`Directly related quantities have different meanings: ${ka} and ${kb}. An explicit, separately justified conversion is required.`);
    return da;
  }
  function visit(n:Expression):Dimension {
    switch(n.kind) {
      case "symbol": {const q=registry[n.quantityId];if(!q) return stop(n,"unsupported-check","Unknown quantity.");return dimension(q.dimension);}
      case "number":case "constant":return DIMENSIONLESS;
      case "sum": {const first=n.args[0]!;for(const arg of n.args.slice(1))equal(n,first,arg);return visit(first);}
      case "product":return n.args.reduce<Dimension>((a,b)=>combine(a,visit(b)),DIMENSIONLESS);
      case "quotient":return combine(visit(n.numerator),visit(n.denominator),-1);
      case "power":return power(visit(n.base),rational(BigInt(n.exponent.num),BigInt(n.exponent.den)));
      case "root":return power(visit(n.radicand),rational(1n,BigInt(n.degree)));
      case "negate":case "average":case "group":return visit(n.argument);
      case "function":if(!sameDimension(visit(n.argument),DIMENSIONLESS))stop(n,"inconsistent",`${n.name} needs a dimensionless argument.`);return DIMENSIONLESS;
      case "relation":return equal(n,n.left,n.right);
      case "derivative":return combine(visit(n.expression),power(visit(n.variable),rational(BigInt(n.order))),-1);
      case "integral":return combine(visit(n.expression),visit(n.variable));
      default:return stop(n,"unsupported-check","This expression kind has no dimensional rule.");
    }
  }
  try{return {status:"consistent",dimension:visit(root)};}catch(e){if(e && typeof e==="object" && "status" in e)return e as DimensionCheck;throw e;}
}
