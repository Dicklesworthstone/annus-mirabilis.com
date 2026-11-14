/** Declared links between independent instrument owners (am-linked-experiment-groups-5t5s). */
import type { CommandClass, Experiment, ModelDomain } from "../../content/schemas/experiment.ts";
import { conversionFactor, convertValue } from "../../units/adapters.ts";

export type GroupDomain = Readonly<{
  min: number;
  max: number;
  minInclusive: boolean;
  maxInclusive: boolean;
}>;

export type GroupMemberDefinition = Readonly<{
  instrumentId: string;
  parameterId: string;
  label: string;
  displayUnit: string;
  domain: GroupDomain;
}>;

/** Serializable: it crosses the server/client boundary without carrying content loaders. */
export type ExperimentGroupDefinition = Readonly<{
  schemaVersion: 1;
  groupId: string;
  label: string;
  quantityId: string;
  canonicalUnit: string;
  commandClass: CommandClass;
  direction: "propagates";
  conversion: "unit-display";
  commitPolicy: "coherent";
  defaultEnabled: false;
  members: readonly GroupMemberDefinition[];
  domain: GroupDomain;
}>;

export class ExperimentGroupDefinitionError extends Error {
  readonly code: "invalid-experiment-group";
  constructor(code: "invalid-experiment-group", message: string) {
    super(message);
    this.code = code;
    this.name = "ExperimentGroupDefinitionError";
  }
}

function invalid(message: string): never {
  throw new ExperimentGroupDefinitionError("invalid-experiment-group", message);
}

function record(value: unknown, fields: readonly string[], where: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid(`${where} must be a record.`);
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some((key) => !fields.includes(key)))
    return invalid(`${where} contains an undeclared field.`);
  return data;
}

function text(value: unknown, where: string): string {
  if (typeof value !== "string" || value.trim().length === 0)
    return invalid(`${where} must be nonempty text.`);
  return value;
}

function domainInSI(
  domain: ModelDomain,
  displayUnit: string,
  canonicalUnit: string,
  where: string,
): GroupDomain {
  if (
    domain.enumerated !== undefined ||
    typeof domain.min !== "number" ||
    typeof domain.max !== "number" ||
    !Number.isFinite(domain.min) ||
    !Number.isFinite(domain.max)
  )
    return invalid(`${where} needs a bounded continuous numeric domain before it can be linked.`);
  try {
    conversionFactor(displayUnit, canonicalUnit);
    return Object.freeze({
      min: convertValue(domain.min, displayUnit, canonicalUnit),
      max: convertValue(domain.max, displayUnit, canonicalUnit),
      minInclusive: domain.minInclusive !== false,
      maxInclusive: domain.maxInclusive !== false,
    });
  } catch {
    return invalid(
      `${where} cannot convert ${displayUnit} to ${canonicalUnit} through the unit registry.`,
    );
  }
}

function intersect(domains: readonly GroupDomain[]): GroupDomain {
  const min = Math.max(...domains.map((domain) => domain.min));
  const max = Math.min(...domains.map((domain) => domain.max));
  const minInclusive = domains.every((domain) => domain.min !== min || domain.minInclusive);
  const maxInclusive = domains.every((domain) => domain.max !== max || domain.maxInclusive);
  if (min > max || (min === max && (!minInclusive || !maxInclusive)))
    return invalid("The member domains have no common admissible value.");
  return Object.freeze({ min, max, minInclusive, maxInclusive });
}

export function insideGroupDomain(domain: GroupDomain, valueSI: number): boolean {
  return (
    Number.isFinite(valueSI) &&
    (domain.minInclusive ? valueSI >= domain.min : valueSI > domain.min) &&
    (domain.maxInclusive ? valueSI <= domain.max : valueSI < domain.max)
  );
}

/** A glyph, a unit or a label match never substitutes for canonical identity or command class. */
export function compileExperimentGroup(
  raw: unknown,
  manifests: ReadonlyMap<string, Experiment>,
  quantityIds: ReadonlySet<string>,
): ExperimentGroupDefinition {
  const input = record(
    raw,
    [
      "schemaVersion",
      "groupId",
      "label",
      "quantityId",
      "canonicalUnit",
      "commandClass",
      "direction",
      "conversion",
      "commitPolicy",
      "defaultEnabled",
      "members",
    ],
    "Experiment group",
  );
  const groupId = text(input.groupId, "groupId");
  const label = text(input.label, "label");
  const quantityId = text(input.quantityId, "quantityId");
  const canonicalUnit = text(input.canonicalUnit, "canonicalUnit");
  if (!/^[a-z][a-z0-9-]*$/.test(groupId) || input.schemaVersion !== 1)
    return invalid("Use a stable group id and schemaVersion 1.");
  if (!quantityIds.has(quantityId)) return invalid(`Unknown canonical quantity ${quantityId}.`);
  if (quantityId !== "frameSpeed" || canonicalUnit !== "m/s")
    return invalid(
      "This observer group requires the canonical frameSpeed quantity in SI metres per second (m/s).",
    );
  // This first vertical slice deliberately admits only a coherent observer relation. Extending
  // command semantics or commit policy must add its lifecycle proof rather than accept unused data.
  if (
    input.commandClass !== "observer-change" ||
    input.direction !== "propagates" ||
    input.conversion !== "unit-display" ||
    input.commitPolicy !== "coherent" ||
    input.defaultEnabled !== false
  )
    return invalid(
      "This group requires opt-in, coherent observer changes and registered unit conversion.",
    );
  if (!Array.isArray(input.members) || input.members.length < 2 || input.members.length > 8)
    return invalid("A group declares between two and eight member instruments.");
  const seen = new Set<string>();
  const members = input.members.map((rawMember, index): GroupMemberDefinition => {
    const member = record(rawMember, ["instrumentId", "parameterId"], `Member ${index + 1}`);
    const instrumentId = text(member.instrumentId, "instrumentId");
    const parameterId = text(member.parameterId, "parameterId");
    if (seen.has(instrumentId)) return invalid(`Duplicate member instrument ${instrumentId}.`);
    seen.add(instrumentId);
    const manifest = manifests.get(instrumentId);
    const parameter = manifest?.parameters.find((candidate) => candidate.id === parameterId);
    const where = `${instrumentId}/${parameterId}`;
    if (!manifest || !parameter) return invalid(`The declared member ${where} does not exist.`);
    if (parameter.quantityId !== quantityId)
      return invalid(
        `${where} binds ${parameter.quantityId}, while the group binds ${quantityId}.`,
      );
    if (parameter.commandClass !== input.commandClass)
      return invalid(
        `${where} declares ${parameter.commandClass}, while the group declares ${input.commandClass}.`,
      );
    if (parameter.role !== "independent")
      return invalid(`${where} is derived and cannot be linked.`);
    const domains = [
      domainInSI(parameter.modelDomain, parameter.displayUnit, canonicalUnit, where),
    ];
    if (parameter.numericalDomain) {
      const numerical = parameter.numericalDomain;
      // Unspecified numerical bounds leave the already bounded model domain unchanged.
      domains.push(
        domainInSI(
          {
            ...parameter.modelDomain,
            ...numerical,
          },
          parameter.displayUnit,
          canonicalUnit,
          where,
        ),
      );
    }
    return Object.freeze({
      instrumentId,
      parameterId,
      label: manifest.title,
      displayUnit: parameter.displayUnit,
      domain: intersect(domains),
    });
  });
  return Object.freeze({
    schemaVersion: 1,
    groupId,
    label,
    quantityId,
    canonicalUnit,
    commandClass: "observer-change",
    direction: "propagates",
    conversion: "unit-display",
    commitPolicy: "coherent",
    defaultEnabled: false,
    members: Object.freeze(members),
    domain: intersect(members.map((member) => member.domain)),
  });
}
