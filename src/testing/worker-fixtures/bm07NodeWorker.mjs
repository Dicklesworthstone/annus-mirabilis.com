import { parentPort, workerData } from "node:worker_threads";
import { createBm07Host } from "../../workers/host/bm07Host.ts";

const host = createBm07Host((message) => {
  if (workerData.breakDigest && message.messageKind === "hello")
    message.sourceDigest = `source:sha256:${"f".repeat(64)}`;
  if (
    workerData.breakArray &&
    message.messageKind === "result" &&
    message.result.kind === "accepted"
  )
    message.result.data.outputs.find((o) => o.quantityId === "observationIncrements").value =
      new Float64Array(2);
  parentPort.postMessage(message);
}, workerData.digest);
parentPort.on("message", (message) => {
  void host.receive(message).catch((error) => {
    setTimeout(() => {
      throw error;
    }, 0);
  });
});
host.hello();
