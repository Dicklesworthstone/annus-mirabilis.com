import { parentPort, workerData } from "node:worker_threads";
import { createKitchenHost } from "../../experiments/bm07/kitchen/host.ts";

let count = 0;
const host = createKitchenHost((message) => {
  if (
    workerData.breakAfter &&
    ++count >= workerData.breakAfter &&
    message.result.kind === "accepted"
  )
    message.result.analysis.outputs.find((o) => o.quantityId === "pairs").value = new Float64Array(
      3,
    );
  const post = () => parentPort.postMessage(message);
  workerData.delay ? setTimeout(post, workerData.delay) : post();
}, workerData.sourceDigest);
parentPort.on("message", (m) => {
  void host.receive(m).catch((e) => {
    setTimeout(() => {
      throw e;
    }, 0);
  });
});
