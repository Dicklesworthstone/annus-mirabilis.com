/**
 * Static alias anchors so a retired id lands without JavaScript.
 * Placed at the successor's location; `id` is the retired spelling.
 */

export type AliasAnchorProps = Readonly<{
  id: string;
  "data-alias": "";
  hidden: true;
}>;

export function aliasAnchorProps(retiredId: string): AliasAnchorProps {
  if (!retiredId) throw new TypeError("An alias anchor needs the retired content id.");
  return Object.freeze({ id: retiredId, "data-alias": "" as const, hidden: true as const });
}
