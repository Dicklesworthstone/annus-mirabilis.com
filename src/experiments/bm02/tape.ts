import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { BM02_DRAFT_TAPE } from "./draftTape.ts";
import { createBm02Session } from "./owner.ts";

/** The reader can verify an archived calculation; ordinary shared links still populate a draft. */
export const BM02_TAPE = Object.freeze({
  ...BM02_DRAFT_TAPE,
  createSession: (instanceId: string) => createBm02Session(instanceId),
} satisfies LabTapeBinding);
