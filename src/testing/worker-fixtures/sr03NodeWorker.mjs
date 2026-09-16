import { parentPort, workerData } from "node:worker_threads";
import { createSr03Host } from "../../workers/host/sr03Host.ts";

const host = createSr03Host((message) => {
  if (workerData.breakDigest && message.messageKind === "hello")
    message.sourceDigest = `source:sha256:${"f".repeat(64)}`;
  if (
    workerData.breakOutput &&
    message.messageKind === "result" &&
    message.result.kind === "accepted"
  ) {
    message.result.data.outputs = [];
  }
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
