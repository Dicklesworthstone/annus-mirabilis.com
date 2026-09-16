export type EquationSelection=Readonly<{nodeId:string;quantityId:string|null;kind:"term"|"operation"}>;
/** Per-mounted-scope selection. It has no numerical commands, seed, singleton or worker. */
export function createSelectionStore(){
 let current:EquationSelection|null=null;const listeners=new Set<()=>void>();
 return {getSnapshot:()=>current,getServerSnapshot:()=>null,subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},select:(next:EquationSelection|null)=>{if(current?.nodeId===next?.nodeId && current?.quantityId===next?.quantityId && current?.kind===next?.kind)return;current=next?Object.freeze({...next}):null;for(const listener of listeners)listener();}};
}
