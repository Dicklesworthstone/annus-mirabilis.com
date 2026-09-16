import { readFileSync } from "node:fs";
import type { IdentityRoute } from "../../content/schemas/experiment.ts";

export const IDENTITY_NOT_INDEPENDENT = "identity-not-independent";

export type IdentityIndependence =
  | { ok: true }
  | { ok: false; code: string; message: string; missing?: boolean };

export function checkIdentityIndependence(
  routes: readonly IdentityRoute[],
  ownerSources: Readonly<Record<string, string>>,
): IdentityIndependence {
  if (routes.length !== 2) {
    return {
      ok: false,
      code: IDENTITY_NOT_INDEPENDENT,
      message: "An identity scenario needs exactly two routes.",
    };
  }
  const [a, b] = routes;
  if (!a || !b) {
    return {
      ok: false,
      missing: true,
      code: IDENTITY_NOT_INDEPENDENT,
      message: "An identity scenario is missing a route.",
    };
  }
  if (!ownerSources[a.owner] || !ownerSources[b.owner]) {
    return {
      ok: false,
      missing: true,
      code: IDENTITY_NOT_INDEPENDENT,
      message: `Identity second route does not yet exist (${!ownerSources[a.owner] ? a.owner : b.owner}).`,
    };
  }
  if (a.owner === b.owner) {
    return {
      ok: false,
      code: IDENTITY_NOT_INDEPENDENT,
      message: `${IDENTITY_NOT_INDEPENDENT}: both routes resolve to ${a.owner}.`,
    };
  }
  const sourceA = ownerSources[a.owner] ?? "";
  const sourceB = ownerSources[b.owner] ?? "";
  if (isThinWrapper(sourceA, b.owner) || isThinWrapper(sourceB, a.owner)) {
    return {
      ok: false,
      code: IDENTITY_NOT_INDEPENDENT,
      message: `${IDENTITY_NOT_INDEPENDENT}: one route is a thin wrapper of the other.`,
    };
  }
  return { ok: true };
}

function isThinWrapper(source: string, otherOwner: string): boolean {
  const other = otherOwner.split(".").pop() ?? otherOwner;
  const calls = source.split(other).length - 1;
  const computing = source.match(/\breturn\b/g)?.length ?? 0;
  return calls >= 1 && computing <= 2 && source.includes(other);
}

export function readOwnerSource(path: string): string {
  return readFileSync(path, "utf8");
}
