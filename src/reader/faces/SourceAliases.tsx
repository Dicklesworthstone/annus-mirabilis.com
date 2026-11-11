import type { SourceAliasMap } from "../anchors/sourceAliases.ts";

/** Empty laid-out spans preserve old links without JavaScript, beside their current content. */
export function SourceAliasAnchors({
  aliases,
  targets,
  prefix = "",
}: {
  readonly aliases: SourceAliasMap;
  readonly targets: readonly string[];
  readonly prefix?: string;
}) {
  const published = new Set(targets);
  return Object.entries(aliases)
    .filter(([, target]) => published.has(target))
    .map(([retired, target]) => (
      <span key={retired} id={`${prefix}${retired}`} data-alias-of={`${prefix}${target}`} />
    ));
}
