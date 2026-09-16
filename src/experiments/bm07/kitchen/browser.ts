import type { WorkerChannel } from "../../../workers/scheduler/hostScheduler.ts";
export function createKitchenBrowserChannel(): WorkerChannel {
  const worker=new Worker(new URL("./worker.ts",import.meta.url),{type:"module",name:"Local observation analysis"});
  return {send:m=>worker.postMessage(m),listen(onMessage,onError){const message=(e:MessageEvent<unknown>)=>onMessage(e.data);worker.addEventListener("message",message);worker.addEventListener("error",onError);worker.addEventListener("messageerror",onError);return()=>{worker.removeEventListener("message",message);worker.removeEventListener("error",onError);worker.removeEventListener("messageerror",onError);};},dispose:()=>worker.terminate()};
}
