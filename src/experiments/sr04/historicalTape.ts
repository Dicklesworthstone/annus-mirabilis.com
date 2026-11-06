import { decodeTapePermalinkInBrowser } from "../permalink/browserCodec.ts";
import { type DraftTapeLoad, draftTapeForSettings, loadDraftTape } from "../permalink/draftTape.ts";
import type { TapeV2 } from "../permalink/types.ts";
import {
  type HistoricalSr04Inputs,
  SR04_HISTORICAL_MODE,
  SR04_HISTORICAL_TAPE,
  validateHistoricalSr04,
} from "./historical.ts";

export function historicalSr04Tape(inputs: HistoricalSr04Inputs): TapeV2 | null {
  if (validateHistoricalSr04(inputs).kind !== "accepted") return null;
  return draftTapeForSettings(SR04_HISTORICAL_TAPE, inputs);
}

/** Keep full-mode commands and incomplete records outside this historical workspace. */
export function loadHistoricalSr04Tape(tape: TapeV2): DraftTapeLoad {
  // The generic identity check does not compare modes, so this boundary must do so first.
  if (tape.mode !== SR04_HISTORICAL_MODE)
    return {
      kind: "not-restored",
      notice:
        "This shared state belongs to another mode. Open a link for the 1904 Galilean comparison.",
    };
  if (validateHistoricalSr04(tape.initialConditions).kind !== "accepted")
    return {
      kind: "not-restored",
      notice:
        "This shared state does not contain the complete three settings for the 1904 Galilean comparison. The existing settings are kept.",
    };
  if (tape.predictions?.length || tape.teachingTapeRef)
    return {
      kind: "not-restored",
      notice:
        "This comparison restores settings only. Its link cannot contain prediction or teaching commands from another exercise.",
    };
  return loadDraftTape(SR04_HISTORICAL_TAPE, tape);
}

export async function loadHistoricalSr04TapeFromUrl(href: string): Promise<DraftTapeLoad> {
  let address: URL;
  try {
    address = new URL(href);
  } catch {
    return { kind: "absent" };
  }
  const decoded = await decodeTapePermalinkInBrowser(address);
  if (decoded.kind === "absent") return decoded;
  if (decoded.kind === "invalid") return { kind: "not-restored", notice: decoded.notice };
  return loadHistoricalSr04Tape(decoded.tape);
}
