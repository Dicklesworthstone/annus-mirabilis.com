import type { LabTapeBinding } from "../permalink/sessionTape.ts";
import { LQ02_DRAFT_TAPE } from "./draftTape.ts";
import { createLq02Session } from "./owner.ts";

/** Archive verification uses the real owner; opening an ordinary shared link remains draft-only. */
export const LQ02_TAPE = Object.freeze({
  ...LQ02_DRAFT_TAPE,
  createSession: (instanceId: string) => createLq02Session(instanceId),
} satisfies LabTapeBinding);
