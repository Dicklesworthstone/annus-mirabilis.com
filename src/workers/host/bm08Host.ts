import { decodeLabRequest, labHello, BM08_PROTOCOL, type LabRequest, type LabResponse, type LabHello } from "../protocol/bm08.ts";
import { createBm08Recording, measureBm08 } from "../operations/bm08.ts";
import { observeCameraPath, type CameraRecording, type CameraFrames } from "../../physics/reference/inference/camera.ts";
import { BM08_CLASSES, type Bm08Parameters } from "../../experiments/bm08/definition.ts";
import { executionOutcomeRegistry } from "../../experiments/results/outcomes.ts";
export function createBm08Host(send: (message: LabResponse | LabHello) => void, sourceDigest: string) {
  let active: LabRequest | null = null, stopped = false, cancelled = false, instanceId: string | null = null;
  let cache: { runId: string; parameters: Bm08Parameters; recording: CameraRecording; frames: CameraFrames } | null = null;
  async function receive(input: unknown): Promise<void> {
    const message = decodeLabRequest(input, sourceDigest); if (stopped) return;
    if (message.messageKind === "cancel") { if (active?.token.instanceId === message.instanceId && active.token.actionIndex === message.actionIndex) cancelled = true; return; }
    if (active) throw new TypeError("Concurrent requests to a single camera owner.");
    if (instanceId !== null && instanceId !== message.token.instanceId) throw new TypeError("A camera owner cannot serve another instance.");
    instanceId = message.token.instanceId; active = message; cancelled = false;
    const p = message.token.parameters as Bm08Parameters; let result;
    try {
      const same = (group: string) => cache !== null && (Object.keys(BM08_CLASSES) as (keyof Bm08Parameters)[]).every(k => BM08_CLASSES[k] !== group || Object.is(p[k], cache!.parameters[k]));
      const reused = cache !== null && cache.runId === message.token.runId && same("input"), reobserved = reused && same("measurement");
      const options = { cancelled: () => cancelled || stopped };
      const recording = reused ? { kind: "accepted" as const, data: cache!.recording } : await createBm08Recording(p, options);
      if (recording.kind !== "accepted") result = recording;
      else {
        const frames = reobserved ? { kind: "accepted" as const, data: cache!.frames } : observeCameraPath(recording.data, p);
        if (frames.kind !== "accepted") result = frames;
        else {
          result = await measureBm08(recording.data, p, reused, options, frames.data);
          // Frames were just evaluated for a measurement change. The operation
          // receives the same buffers, but the accounting must include that work.
          if (result.kind === "accepted") {
            const outputs = result.data.outputs.map(o => o.status === "value" && o.quantityId === "measurementDraws" ? { ...o, value: reobserved ? 0 : frames.data.measurementDraws } : o.status === "value" && o.quantityId === "reusedObservation" ? { ...o, value: Number(reobserved) } : o);
            result = { kind: "accepted" as const, data: { ...result.data, outputs } };
            if (!cancelled && !stopped) cache = { runId: message.token.runId, parameters: p, recording: recording.data, frames: frames.data };
          }
        }
      }
      if (cancelled) result = { kind: "outcome" as const, outcome: { outcome: "cancelled" as const, ...executionOutcomeRegistry.cancelled } };
    } catch { result = { kind: "outcome" as const, outcome: { outcome: "invariant-violation" as const, ...executionOutcomeRegistry["invariant-violation"] } }; }
    active = null;
    if (!stopped) send({ messageKind: "result", protocolVersion: BM08_PROTOCOL, sourceDigest, token: message.token, result });
  }
  return Object.freeze({ hello: () => send(labHello(sourceDigest)), receive, dispose() { stopped = true; cancelled = true; cache = null; } });
}
