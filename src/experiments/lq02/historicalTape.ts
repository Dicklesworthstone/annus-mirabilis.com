import { decodeTapePermalinkInBrowser } from "../permalink/browserCodec.ts";
import {
  type DraftTapeBinding,
  type DraftTapeLoad,
  draftTapeForSettings,
  loadDraftTape,
} from "../permalink/draftTape.ts";
import type { TapeV2 } from "../permalink/types.ts";
import {
  DEFAULT_HISTORICAL_LQ02_INPUTS,
  HISTORICAL_LQ02_CONSTANT_SET,
  HISTORICAL_LQ02_MODE,
  type HistoricalLq02Inputs,
  validateHistoricalLq02Parameters,
} from "./historical.ts";

const BINDING: DraftTapeBinding = {
  environment: {
    experimentId: "lq-02",
    mode: HISTORICAL_LQ02_MODE,
    modelId: "lq-02",
    modelVersion: 1,
    constantSetId: HISTORICAL_LQ02_CONSTANT_SET,
    streamVersion: "deterministic",
    allocationId: "deterministic",
  },
  defaults: DEFAULT_HISTORICAL_LQ02_INPUTS,
  validate: validateHistoricalLq02Parameters,
};

export function historicalLq02Tape(inputs: HistoricalLq02Inputs): TapeV2 | null {
  return draftTapeForSettings(BINDING, inputs);
}

/** Generic identity checks do not compare modes; the historical boundary must do so explicitly. */
export function loadHistoricalLq02Tape(tape: TapeV2): DraftTapeLoad {
  if (tape.mode !== HISTORICAL_LQ02_MODE)
    return {
      kind: "not-restored",
      notice: "This shared state belongs to another mode. Open a link for the 1904 reconstruction.",
    };
  // Require the complete historical settings record before the generic loader can fill defaults.
  if (validateHistoricalLq02Parameters(tape.initialConditions).kind !== "accepted")
    return {
      kind: "not-restored",
      notice:
        "This shared state does not contain a complete set of settings for the 1904 reconstruction.",
    };
  return loadDraftTape(BINDING, tape);
}

export async function loadHistoricalLq02TapeFromUrl(href: string): Promise<DraftTapeLoad> {
  let address: URL;
  try {
    address = new URL(href);
  } catch {
    return { kind: "absent" };
  }
  const decoded = await decodeTapePermalinkInBrowser(address);
  if (decoded.kind === "absent") return decoded;
  if (decoded.kind === "invalid") return { kind: "not-restored", notice: decoded.notice };
  return loadHistoricalLq02Tape(decoded.tape);
}
