import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type AliasRecord, validateAliasRecord } from "../../content/aliases.ts";
import { parseAnchor } from "../../content/anchors.ts";
import { parseYaml } from "../../content/provenance/yaml.ts";
import { resolveNavigationAlias } from "./aliases.ts";

export type SourceAliasMap = Readonly<Record<string, string>>;

export class SourceAliasError extends Error {
  readonly rule: string;

  constructor(rule: string, message: string) {
    super(message);
    this.name = "SourceAliasError";
    this.rule = rule;
  }
}

/** Resolve on the server; the browser needs destinations, not the editorial provenance. */
export function resolvedSourceAliases(
  raw: unknown,
  published: ReadonlySet<string>,
): SourceAliasMap {
  if (!Array.isArray(raw))
    throw new SourceAliasError(
      "source-alias-collection-invalid",
      "Source aliases must be an array.",
    );
  const records: AliasRecord[] = raw.map((item) => {
    const parsed = validateAliasRecord(item);
    if (!parsed.ok) throw new SourceAliasError("source-alias-record-invalid", parsed.error);
    return parsed.value;
  });
  const aliases: Record<string, string> = {};
  for (const record of records) {
    const result = resolveNavigationAlias(record.retiredId, records);
    if (result.kind === "error")
      throw new SourceAliasError("source-alias-resolution-failed", result.error);
    if (result.kind !== "redirect") continue;
    const target = result.redirect.resolvedId;
    // Revision/reference ids are not reader addresses. A scoped face also cannot publish an
    // alias whose successor is on another section's page, or shadow a current source id.
    if (
      parseAnchor(record.retiredId).ok &&
      parseAnchor(target).ok &&
      published.has(target) &&
      !published.has(record.retiredId)
    )
      aliases[record.retiredId] = target;
  }
  return Object.freeze(aliases);
}

export function loadSourceAliases(
  root: string,
  paper: string,
  published: ReadonlySet<string>,
): SourceAliasMap {
  const file = join(root, "content", "aliases", `${paper}.yaml`);
  if (!existsSync(file)) return Object.freeze({});
  const document = parseYaml(readFileSync(file, "utf8")) as { aliases?: unknown } | null;
  return resolvedSourceAliases(document?.aliases, published);
}
