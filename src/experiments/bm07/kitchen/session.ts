import { createInstanceStore, type AcceptedSnapshot, type ExperimentView } from "../../store/instanceStore.ts";
import { makeRefusal } from "../../results/refusals.ts";
import { executionOutcomeRegistry } from "../../results/outcomes.ts";
import type { WorkerChannel } from "../../../workers/scheduler/hostScheduler.ts";
import { KITCHEN_OPTIONS, KITCHEN_OUTPUTS, type KitchenOptions, type KitchenAnalysis } from "./definition.ts";
import { checkCsvSize, textDigest, validateKitchenOptions, decodeKitchenResponse, KITCHEN_PROTOCOL, type KitchenRequest } from "./protocol.ts";
import { exportKitchenCsv } from "./csv.ts";
import type { KitchenDocument } from "./schema.ts";
export type KitchenReport=Omit<KitchenAnalysis,"outputs">;
export type KitchenAccepted=Readonly<{document:KitchenDocument;report:KitchenReport;snapshot:AcceptedSnapshot;sourceId:string;documentDigest:string;csv:string}>;
export type KitchenView=Readonly<{view:ExperimentView;accepted:KitchenAccepted|null;message:string;preparing:boolean}>;
function frozen<T>(value:T):T{if(value&&typeof value==="object"){Object.values(value).forEach(frozen);Object.freeze(value);}return value;}
export function createKitchenSession(instanceId:string, factory:()=>WorkerChannel,sourceDigest:string){
  const makeStore=(suffix:string)=>createInstanceStore({experimentId:"bm-07-kitchen",instanceId:instanceId+suffix,initialParameters:{sourceId:"",documentDigest:"",...KITCHEN_OPTIONS},parameterClasses:{sourceId:"input",documentDigest:"measurement",track:"measurement",axis:"measurement",coverage:"estimator",constantSet:"estimator"},outputs:KITCHEN_OUTPUTS,allowPartial:true});
  let store=makeStore(""),accepted:KitchenAccepted|null=null,generation=0,clears=0;
  let channel:WorkerChannel|null=null,unlisten:(()=>void)|null=null,active:KitchenRequest|null=null,queued:KitchenRequest|null=null;
  let deadline:ReturnType<typeof setTimeout>|null=null;
  const listeners=new Set<()=>void>();
  let state:KitchenView=Object.freeze({view:store.getSnapshot(),accepted:null,message:"",preparing:false});const initial=state;
  const emit=(message="",preparing=false)=>{state=Object.freeze({view:store.getSnapshot(),accepted,message,preparing});for(const fn of listeners)try{fn();}catch{/* A subscriber cannot corrupt the accepted bundle. */}};
  const release=()=>{if(deadline)clearTimeout(deadline);deadline=null;unlisten?.();unlisten=null;channel?.dispose();channel=null;active=null;queued=null;};
  const fail=(message:string)=>{const token=store.getSnapshot().requested;if(token&&store.getSnapshot().pending)store.fail(token,{outcome:"invariant-violation",...executionOutcomeRegistry["invariant-violation"]});release();emit(message);};
  function send(request:KitchenRequest){
    active=request;
    deadline=setTimeout(()=>fail("The local analysis timed out. Accepted data remain unchanged; retry or use a smaller file."),30000);
    try{
      if(!channel){channel=factory();unlisten=channel.listen(receive,()=>fail("The local analysis worker stopped. The last accepted analysis is unchanged."));}
      channel.send(request);
    }catch{fail("The local analysis worker is unavailable. The accepted observations remain available for export.");}
  }
  function receive(input:unknown){
    const job=active;if(!job)return;active=null;if(deadline)clearTimeout(deadline);deadline=null;
    // Superseded work is never decoded into the current accepted state.
    if(!state.preparing&&store.getSnapshot().pending&&job.token.actionIndex===store.getSnapshot().requested?.actionIndex){
      try{
        const {message,document}=decodeKitchenResponse(input,job);
        if(message.result.kind==="refused"){
          store.refuse(job.token,makeRefusal("invalid-parameter",{capabilityId:"diffusion.inference"},{details:{requirements:message.result.message}}));emit(message.result.message);
        }else{
          const {outputs,...report}=message.result.analysis;
          const decision=store.publish({...job.token,outputs,stepIndex:0,simulationTime:0,final:true});
          if(!decision.accepted)throw new TypeError("The observation publication was rejected.");
          accepted=frozen({document:document!,report,snapshot:store.getSnapshot().accepted!,sourceId:String(job.token.parameters.sourceId),documentDigest:String(job.token.parameters.documentDigest),csv:job.csv});emit();
        }
      }catch{fail("A malformed or mismatched analysis was rejected. The accepted observations are unchanged.");return;}
    }
    if(queued){const next=queued;queued=null;send(next);}
  }
  async function submit(csv:string,options:KitchenOptions=KITCHEN_OPTIONS,newSource=true){
    const ticket=++generation;queued=null;
    try{checkCsvSize(csv);options=validateKitchenOptions(options);}catch(e){store.pause();emit(e instanceof Error?e.message:"Invalid import.");return false;}
    // Invalidates any in-flight publication before awaiting the content digest.
    store.pause();queued=null;emit("Checking the local file identity. Existing results remain unchanged.",true);
    try{
      const documentDigest=await textDigest(csv);if(ticket!==generation)return false;
      const sourceId=newSource||!accepted?documentDigest:accepted.sourceId;
      let token=newSource||!store.getSnapshot().requested||store.getSnapshot().requested?.parameters.sourceId!==sourceId?store.issue("setup-change",{sourceId}):null;
      const prev=store.getSnapshot().requested?.parameters??{};
      const measurement={documentDigest,track:options.track,axis:options.axis};
      if(Object.entries(measurement).some(([k,v])=>prev[k]!==v))token=store.issue("measurement-change",measurement);
      const estimator={coverage:options.coverage,constantSet:options.constantSet};
      if(Object.entries(estimator).some(([k,v])=>prev[k]!==v))token=store.issue("estimator-change",estimator);
      token??=store.issue("continue");
      const request:KitchenRequest={version:KITCHEN_PROTOCOL,sourceDigest,token,csv};emit();
      if(active)queued=request;else send(request);
      return true;
    }catch(e){emit(e instanceof Error?e.message:"The local file could not be prepared.");return false;}
  }
  return Object.freeze({getSnapshot:()=>state,getServerSnapshot:()=>initial,subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},submit,
    reanalyze(options:KitchenOptions){if(!accepted)throw new Error("Import observations first.");return submit(accepted.csv,options,false);},
    revise(document:KitchenDocument,options?:KitchenOptions){if(!accepted)throw new Error("Import observations first.");return submit(exportKitchenCsv(document),options??accepted.report.options,false);},
    stop(){generation++;release();store.pause();emit("Stopped. Accepted observations remain readable and exportable.");},
    clear(){generation++;release();accepted=null;store=makeStore(`/clear/${++clears}`);emit("Local observations cleared from this laboratory. Downloaded files are not deleted.");},
    disconnect(){generation++;release();store.pause();emit();},
  });
}
