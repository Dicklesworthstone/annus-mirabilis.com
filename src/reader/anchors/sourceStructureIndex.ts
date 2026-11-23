import { parseAnchor, sectionAnchorOf } from "../../content/anchors.ts";
import type { ManifestUnit } from "../../content/manifest/types.ts";
import type { StructureIndex, StructureUnit } from "./mapToFace.ts";

/** Only source containment crosses the server/client boundary, never locators or PDF page maps. */
type SourceUnit = Pick<ManifestUnit, "id" | "containedIn" | "section">;

export class SourceStructureError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SourceStructureError";
    this.code = code;
  }
}

function isSection(id: string): boolean {
  const parsed = parseAnchor(id);
  return parsed.ok && parsed.value.kind === "section";
}

/**
 * Project the frozen manifest's containment for face navigation. The caller supplies printed
 * units through the existing server loader; this module and its output need no filesystem.
 *
 * A manifest's section fields declare roots, including introductions without printed headings.
 * Explanation sections supply the root for an unsectioned paper such as mass-energy. An id's
 * grammar can connect a block to one of those declared roots, but cannot create a new root.
 * Split English sentences use contentIdVariants in mapToFace, not extra invented source units.
 */
export function sourceStructureIndex(
  sourceUnits: readonly SourceUnit[],
  paperSections: readonly string[],
): StructureIndex {
  const sources = new Map<string, SourceUnit>();
  const sections = new Set(paperSections.filter(isSection));
  for (const unit of sourceUnits) {
    if (sources.has(unit.id)) {
      throw new SourceStructureError(
        "source-structure-duplicate",
        `Source unit '${unit.id}' appears twice.`,
      );
    }
    sources.set(unit.id, unit);
    if (unit.section && isSection(unit.section)) sections.add(unit.section);
    if (isSection(unit.id)) sections.add(unit.id);
  }

  const units: StructureUnit[] = [];
  for (const section of sections) {
    if (!sources.has(section)) units.push({ id: section });
  }
  for (const unit of sourceUnits) {
    const section = unit.section ?? sectionAnchorOf(unit.id);
    const parentId =
      unit.containedIn ??
      (section && section !== unit.id && sections.has(section) ? section : undefined);
    if (parentId !== undefined && !sources.has(parentId) && !sections.has(parentId)) {
      throw new SourceStructureError(
        "source-structure-parent-missing",
        `Source unit '${unit.id}' names absent parent '${parentId}'.`,
      );
    }
    units.push(parentId === undefined ? { id: unit.id } : { id: unit.id, parentId });
  }

  const parents = new Map(units.map((unit) => [unit.id, unit.parentId]));
  for (const unit of units) {
    const visited = new Set<string>();
    let current: string | undefined = unit.id;
    while (current !== undefined) {
      if (visited.has(current)) {
        throw new SourceStructureError(
          "source-structure-cycle",
          `Source unit '${unit.id}' has cyclic containment through '${current}'.`,
        );
      }
      visited.add(current);
      current = parents.get(current);
    }
  }
  return Object.freeze({ units: Object.freeze(units.map((unit) => Object.freeze(unit))) });
}
