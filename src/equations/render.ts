import { renderToString } from "katex";
import { createHash } from "node:crypto";
import { canonical, quantityBindings } from "./ast.ts";
import { parseEquationRecord, type EquationRecord } from "./record.ts";
import { BROWNIAN_QUANTITIES } from "./quantities.ts";
import { expressionLatex } from "./latex.ts";
import { navigationTree } from "./navigation.ts";
import type { CompiledEquation } from "./viewTypes.ts";
export function compileEquation(input:EquationRecord):CompiledEquation {
  const eq=parseEquationRecord(input,input.id),nav=navigationTree(eq.tree),allowed=new Set(nav.map(n=>n.id));
  const plain=expressionLatex(eq.tree,BROWNIAN_QUANTITIES),marked=expressionLatex(eq.tree,BROWNIAN_QUANTITIES,true);
  const html=renderToString(marked,{displayMode:true,output:"html",throwOnError:true,maxExpand:1000,maxSize:20,
    strict:(code:string)=>code==="htmlExtension"?"ignore":"error",
    trust:context=>{
      if(context.command==="\\htmlClass")return ["am-role-input","am-role-result","am-role-constant"].includes(String(context.class));
      if(context.command!=="\\htmlData")return false;
      const attributes=context.attributes as Record<string,string>;
      return Object.keys(attributes).length===1 && Object.entries(attributes).every(([key,value])=>["term","op"].includes(key) && allowed.has(value) && nav.some(n=>n.id===value && (n.kind==="term"?"term":"op")===key));
    }});
  const mathml=renderToString(plain,{displayMode:true,output:"mathml",throwOnError:true,strict:"error",trust:false,maxExpand:1000,maxSize:20});
  const bindings=quantityBindings(eq.tree);
  return {...eq,html,mathml,plainLatex:plain,treeDigest:createHash("sha256").update(canonical(eq)).digest("hex"),navigation:nav,terms:bindings.map(t=>({...t,quantity:BROWNIAN_QUANTITIES[t.quantityId]!}))};
}
