import type { WorkerChannel } from "../../workers/scheduler/sr03Scheduler.ts";

/** Called only by the lazy scheduler after an explicit reader action. */
export function createSr03BrowserChannel(): WorkerChannel {
  const worker = new Worker(new URL("../../workers/host/sr03Worker.ts", import.meta.url), {
    type: "module",
    name: "Annus Mirabilis rod simultaneity lab",
  });
  return {
    send: (message) => worker.postMessage(message),
    listen(onMessage, onError) {
      const message = (event: MessageEvent<unknown>) => onMessage(event.data);
      worker.addEventListener("message", message);
      worker.addEventListener("error", onError);
      worker.addEventListener("messageerror", onError);
      return () => {
        worker.removeEventListener("message", message);
        worker.removeEventListener("error", onError);
        worker.removeEventListener("messageerror", onError);
      };
    },
    dispose: () => worker.terminate(),
  };
}
