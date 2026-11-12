"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { AcceptedSnapshot, ExperimentView } from "../store/instanceStore.ts";
import type { TapeV2 } from "./types.ts";
import type {
  WorkerTapeBinding,
  WorkerTapeCapture,
  WorkerTapeSession,
} from "./workerSessionTape.ts";

type Capture = Readonly<{
  binding: WorkerTapeBinding;
  session: WorkerTapeSession;
  accepted: AcceptedSnapshot;
  result: WorkerTapeCapture;
}>;
const serverSnapshot = () => null;

/** A late digest can never become the shareable record of a newer accepted calculation. */
export function useWorkerTapeCapture(
  binding: WorkerTapeBinding,
  session: WorkerTapeSession,
  enabled: boolean,
): Readonly<{ tape: TapeV2 | null; notice: string }> {
  const view = useSyncExternalStore<ExperimentView | null>(
    session.subscribe,
    session.getSnapshot,
    serverSnapshot,
  );
  const [capture, setCapture] = useState<Capture | null>(null);
  const accepted = view?.accepted;
  const ready = enabled && view?.status === "accepted" && !view.pending && accepted?.final;

  useEffect(() => {
    setCapture(null);
    if (!ready || !accepted || !binding.capture) return;
    let live = true;
    const stillCurrent = () => {
      const current = session.getSnapshot();
      return (
        live && current.accepted === accepted && current.status === "accepted" && !current.pending
      );
    };
    void binding.capture(session, accepted).then(
      (result) => {
        if (stillCurrent()) setCapture({ binding, session, accepted, result });
      },
      () => {
        if (stillCurrent())
          setCapture({
            binding,
            session,
            accepted,
            result: {
              kind: "unavailable",
              notice:
                "This calculation's checkpoint could not be prepared. The accepted result and saved stops remain available.",
            },
          });
      },
    );
    return () => {
      live = false;
    };
  }, [binding, session, accepted, ready]);

  if (!enabled || !binding.capture) return { tape: null, notice: "" };
  if (!ready)
    return {
      tape: null,
      notice: "Finish a single trial in the laboratory before saving its scientific checkpoint.",
    };
  const current =
    capture?.binding === binding && capture.session === session && capture.accepted === accepted
      ? capture.result
      : null;
  if (!current) return { tape: null, notice: "Preparing this trial's scientific checkpoint…" };
  return current.kind === "captured"
    ? { tape: current.tape, notice: "The completed trial is ready to save or share." }
    : { tape: null, notice: current.notice };
}
