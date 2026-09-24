/**
 * LQ-08's ?tape= binding (am-inst-permalink-tape-s677). LQ-08 was the first laboratory to read a
 * tape (ee4de75c); its runner and restore are now the general ones in permalink/sessionTape.ts.
 */
import {
  createSessionReplayRunner,
  type LabTapeBinding,
  restoreTape,
  restoreTapeFromUrl,
  type TapeSession,
  tapeForSettings,
} from "../permalink/sessionTape.ts";
import type { ExperimentEnvironment, TapeV2 } from "../permalink/types.ts";
import { LQ08_DEFAULTS, LQ08_MODEL, type Lq08Parameters } from "./definition.ts";
import { validateLq08Parameters } from "./parameters.ts";
import { createLq08Session } from "./session.ts";

/**
 * content/experiments/lq-08.yaml's tapeModel (lq-08, version 1) and the constant set LQ08_MODEL
 * computes with. LQ-08 draws no random numbers, so its seed is 0 and it has no stream or allocation.
 */
export const LQ08_TAPE_ENVIRONMENT: ExperimentEnvironment = Object.freeze({
  experimentId: "lq-08",
  mode: "lq-08:default",
  modelId: "lq-08",
  modelVersion: 1,
  constantSetId: LQ08_MODEL.constantSetId,
  streamVersion: "deterministic",
  allocationId: "deterministic",
});

export const LQ08_TAPE: LabTapeBinding = Object.freeze({
  environment: LQ08_TAPE_ENVIRONMENT,
  defaults: LQ08_DEFAULTS,
  validate: validateLq08Parameters,
  createSession: (instanceId: string) => createLq08Session(instanceId),
});

export const createLq08ReplayRunner = (session: TapeSession) =>
  createSessionReplayRunner(LQ08_TAPE, session);
export const lq08TapeFor = (p: Lq08Parameters): TapeV2 | null => tapeForSettings(LQ08_TAPE, p);
export const restoreLq08Tape = (session: TapeSession, tape: TapeV2) =>
  restoreTape(LQ08_TAPE, session, tape);
export const restoreLq08FromUrl = (session: TapeSession, href: string) =>
  restoreTapeFromUrl(LQ08_TAPE, session, href);
