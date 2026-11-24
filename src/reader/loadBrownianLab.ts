/** Loaded only after the reader asks for either set of tracer controls. */
import { createBm01BrowserChannel } from "../experiments/bm01/browser.ts";
import { createBm01Session, type PreparedBm01Example } from "../experiments/bm01/session.ts";
import tracerExample from "../generated/bm01-example.json";
import { createBrownianLabSession } from "./brownianLabSession.ts";

export function loadBrownianLab(instanceId: string) {
  const example = tracerExample as PreparedBm01Example;
  return createBrownianLabSession(
    createBm01Session(instanceId, example, createBm01BrowserChannel),
    example,
  );
}
