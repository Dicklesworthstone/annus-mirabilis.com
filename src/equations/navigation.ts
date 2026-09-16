import { children, nodeId, type Expression } from "./ast.ts";
export type NavigationNode = Readonly<{id:string;parent:string|null;children:readonly string[];kind:"term"|"operation";quantityId:string|null}>;
export function navigationTree(tree:Expression):readonly NavigationNode[] {
  const nodes:{id:string;parent:string|null;children:string[];kind:"term"|"operation";quantityId:string|null}[]=[];
  function visit(n:Expression,parent:string|null){const id=nodeId(n);if(id){nodes.push({id,parent,children:[],kind:n.kind==="symbol"?"term":"operation",quantityId:n.kind==="symbol"?n.quantityId:null});if(parent)nodes.find(x=>x.id===parent)!.children.push(id);}children(n).forEach(c=>visit(c,id??parent));}
  visit(tree,null);return nodes;
}
/** Transparent nonselectable nodes never become phantom keyboard stops. */
export function navigate(nodes:readonly NavigationNode[],selected:string|null,key:string):string|null {
  const n=nodes.find(n=>n.id===selected);if(!n)return key==="Escape"?null:nodes[0]?.id??null;
  const siblings=nodes.filter(x=>x.parent===n.parent),i=siblings.findIndex(x=>x.id===n.id);
  switch(key){case "ArrowLeft":return siblings[Math.max(0,i-1)]!.id;case "ArrowRight":return siblings[Math.min(siblings.length-1,i+1)]!.id;case "ArrowDown":return n.children[0]??n.id;case "ArrowUp":return n.parent??n.id;case "Home":return siblings[0]!.id;case "End":return siblings.at(-1)!.id;case "Escape":return null;default:return n.id;}
}
