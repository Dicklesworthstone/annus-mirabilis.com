/**
 * V3 envelopes use the existing V2 owner validator and the same bounded ?tape= transport.
 * A group never inherits one member's model, constants, checkpoint, or random-stream identity.
 */
import {
  MAX_PERMALINK_TAPE_EVENTS,
  MAX_SCIENTIFIC_STREAM_POSITIONS,
  TapeValidationError,
  validateTapeV2,
} from "./schema.ts";
import type { TapeDocument, TapeGroupV3 } from "./types.ts";

export const MAX_TAPE_GROUP_MEMBERS = 8;

function invalid(message: string, path: string): never {
  throw new TapeValidationError("tape-group-invalid", message, path);
}

function record(value: unknown, keys: readonly string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid("A group record must be an object.", path);
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !keys.includes(key)))
    return invalid("The group contains an undeclared field.", path);
  return data;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() !== value || value.length < 1 || value.length > 128)
    return invalid("Group identities must be nonempty text of at most 128 characters.", path);
  return value;
}

function memberId(value: unknown, path: string): string {
  const id = text(value, path);
  if (!/^[a-z][a-z0-9-]*$/.test(id))
    return invalid("Member slots must use stable lowercase identifiers.", path);
  return id;
}

export function validateTapeGroupV3(raw: unknown, path = "tape"): TapeGroupV3 {
  const input = record(raw, ["tapeVersion", "group", "members"], path);
  if (input.tapeVersion !== 3)
    return invalid("A group envelope requires tapeVersion 3.", `${path}.tapeVersion`);
  const relation = record(
    input.group,
    [
      "definitionVersion",
      "groupId",
      "quantityId",
      "canonicalUnit",
      "commandClass",
      "direction",
      "conversion",
      "commitPolicy",
      "enabled",
      "valueSI",
    ],
    `${path}.group`,
  );
  if (
    relation.definitionVersion !== 1 ||
    relation.direction !== "propagates" ||
    relation.commitPolicy !== "coherent" ||
    (relation.commandClass !== "setup-change" && relation.commandClass !== "observer-change") ||
    (relation.conversion !== "none" && relation.conversion !== "unit-display")
  )
    return invalid(
      "The group relation uses an unsupported definition or commit policy.",
      `${path}.group`,
    );
  if (
    typeof relation.enabled !== "boolean" ||
    (relation.enabled
      ? typeof relation.valueSI !== "number" || !Number.isFinite(relation.valueSI)
      : relation.valueSI !== null)
  )
    return invalid(
      "Linked groups need one finite accepted value; unlinked groups use null.",
      `${path}.group.valueSI`,
    );
  if (
    !Array.isArray(input.members) ||
    input.members.length < 2 ||
    input.members.length > MAX_TAPE_GROUP_MEMBERS
  )
    return invalid(
      "A shared group needs between two and eight independently identified members.",
      `${path}.members`,
    );
  const seen = new Set<string>();
  let eventCount = 0;
  let streamCount = 0;
  const members = input.members.map((rawMember, index) => {
    const at = `${path}.members[${index}]`;
    const member = record(rawMember, ["memberId", "parameterId", "displayUnit", "tape"], at);
    const id = memberId(member.memberId, `${at}.memberId`);
    if (seen.has(id)) return invalid("Each group member needs a distinct local slot.", at);
    seen.add(id);
    const tape = validateTapeV2(member.tape, `${at}.tape`);
    eventCount += tape.events.length;
    streamCount += tape.acceptedCheckpoint.scientificState?.streamPositions.length ?? 0;
    if (eventCount > MAX_PERMALINK_TAPE_EVENTS || streamCount > MAX_SCIENTIFIC_STREAM_POSITIONS)
      return invalid(
        "The group exceeds the existing aggregate event or stream-position budget.",
        at,
      );
    return Object.freeze({
      memberId: id,
      parameterId: text(member.parameterId, `${at}.parameterId`),
      displayUnit: text(member.displayUnit, `${at}.displayUnit`),
      tape,
    });
  });
  return Object.freeze({
    tapeVersion: 3,
    group: Object.freeze({
      definitionVersion: 1,
      groupId: memberId(relation.groupId, `${path}.group.groupId`),
      quantityId: text(relation.quantityId, `${path}.group.quantityId`),
      canonicalUnit: text(relation.canonicalUnit, `${path}.group.canonicalUnit`),
      commandClass: relation.commandClass,
      direction: relation.direction,
      conversion: relation.conversion,
      commitPolicy: relation.commitPolicy,
      enabled: relation.enabled,
      valueSI: relation.valueSI as number | null,
    }),
    members: Object.freeze(members),
  });
}

/** V2 stays byte-compatible; every unknown version retains the established V2 refusal. */
export function validateTapeDocument(raw: unknown, path = "tape"): TapeDocument {
  return raw && typeof raw === "object" && "tapeVersion" in raw && raw.tapeVersion === 3
    ? validateTapeGroupV3(raw, path)
    : validateTapeV2(raw, path);
}
