import { nodeId, type Expression } from "./ast.ts";
import type { QuantityRegistry } from "./quantities.ts";
/** Generated TeX only. No authored HTML, macros, arbitrary symbols or string replacement. */
export function expressionLatex(tree:Expression,registry:QuantityRegistry,marked=false):string {
  const render=(n:Expression):string=>{
    let s:string;
    switch(n.kind){
      case "number": {const [m,e]=n.value.split("e");s=e===undefined?n.value:`${m}\\times10^{${e}}`;break;}
      case "constant":s="\\pi";break;
      case "symbol":{const q=registry[n.quantityId];if(!q)throw new Error("Unknown notation binding.");s=q.glyph;if(n.scale && (n.scale.num!==1 || n.scale.den!==1))s=`\\frac{${n.scale.num}}{${n.scale.den}}\\left(${s}\\right)`;break;}
      case "sum":s=n.args.map(render).join(" + ");break;
      case "product":s=n.args.map(x=>["sum","relation","negate"].includes(x.kind)?`\\left(${render(x)}\\right)`:render(x)).join("\\,");break;
      case "quotient":s=`\\frac{${render(n.numerator)}}{${render(n.denominator)}}`;break;
      case "power":s=`\\left(${render(n.base)}\\right)^{${n.exponent.den===1?n.exponent.num:`\\frac{${n.exponent.num}}{${n.exponent.den}}`}}`;break;
      case "root":s=`\\sqrt${n.degree===2?"":`[${n.degree}]`}{${render(n.radicand)}}`;break;
      case "negate":s=`-\\left(${render(n.argument)}\\right)`;break;
      case "group":s=`\\left(${render(n.argument)}\\right)`;break;
      case "average":s=`\\left\\langle ${render(n.argument)}\\right\\rangle`;break;
      case "function":s=`\\${n.name}\\left(${render(n.argument)}\\right)`;break;
      case "relation":s=`${render(n.left)} ${n.operator==="approx"?"\\approx":n.operator==="define"?":=":"="} ${render(n.right)}`;break;
      case "derivative":{const d=n.partial?"\\partial":"\\mathrm{d}",p=n.order===1?"":`^{${n.order}}`;s=`\\frac{${d}${p}\\left(${render(n.expression)}\\right)}{${d}${render(n.variable)}${p}}`;break;}
      case "integral":s=`\\int ${render(n.expression)}\\,\\mathrm{d}${render(n.variable)}`;break;
    }
    const id=nodeId(n);
    if(marked && id){if(n.kind==="symbol")s=`\\htmlClass{am-role-${registry[n.quantityId]!.role}}{${s}}`;s=`\\htmlData{${n.kind==="symbol"?"term":"op"}=${id}}{${s}}`;}
    return s;
  };
  return render(tree);
}
