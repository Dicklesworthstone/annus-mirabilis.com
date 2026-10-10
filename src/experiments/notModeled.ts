/**
 * What a laboratory's model leaves out, read from its manifest (am-rc1001-bridge-plan-pcjk.26).
 *
 * `src/generated/not-modeled.ts` holds the data, emitted from content/experiments/*.yaml by
 * scripts/generate-not-modeled.mjs. The lookup and its refusal live HERE rather than in that module
 * for a reason the bare-throw ratchet gave: a generated file cannot carry a tested refusal. Its
 * first version threw a bare RangeError and the ratchet reported
 * "src/generated/not-modeled.ts: 1 bare throw site(s), NOT IN THE BASELINE" -- undeclared debt, and
 * a generated file is the wrong place both to baseline a debt and to write the test that pays it.
 */
import { NOT_MODELED } from "../generated/not-modeled.ts";

/**
 * Refuses an id that is not a laboratory.
 *
 * The code is the FIRST constructor argument, which is what `refusalRatchet` credits; with the code
 * inside the message this reads as an untyped throw.
 */
export class UnknownLaboratoryError extends Error {
  readonly code: string;
  readonly labId: string;
  constructor(code: string, labId: string) {
    super(
      `"${labId}" has no notModeled list. content/experiments/${labId}.yaml declares none, so there ` +
        "is nothing to tell a reader this model leaves out.",
    );
    this.name = "UnknownLaboratoryError";
    this.code = code;
    this.labId = labId;
  }
}

/**
 * A laboratory's declared notModeled list.
 *
 * Refuses an unknown id rather than returning an empty list: a component given one would render a
 * laboratory that leaves nothing out, which is the opposite of what the manifest says when it has
 * no entry.
 */
export function notModeledFor(labId: string): readonly string[] {
  const list = NOT_MODELED[labId];
  if (list === undefined) throw new UnknownLaboratoryError("unknown-laboratory-id", labId);
  return list;
}
