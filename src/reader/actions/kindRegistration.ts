/**
 * Registers the `example` and `obstacle` clarification kinds this bead owns
 * (am-read-passage-actions-vbe) with the closed return-stack registry.
 */
import { createElement } from "react";
import { getClarificationKind, registerClarificationKind } from "../stack/kinds.ts";
import { OBSTACLE_KIND_IDS, type ObstacleKindId } from "./passageActions.schema.ts";

export type ExampleTarget = Readonly<{ id: string }>;
export type ObstacleTarget = Readonly<{ passageId: string; kind: ObstacleKindId }>;

function isObstacleKindId(value: string): value is ObstacleKindId {
  return (OBSTACLE_KIND_IDS as readonly string[]).includes(value);
}

function parseExampleId(raw: string): ExampleTarget | null {
  const id = raw.trim();
  return id.length > 0 ? Object.freeze({ id }) : null;
}

function parseObstacleId(raw: string): ObstacleTarget | null {
  const sep = raw.indexOf("/");
  if (sep <= 0 || sep === raw.length - 1) return null;
  const passageId = raw.slice(0, sep);
  const kind = raw.slice(sep + 1);
  if (!passageId.trim() || !isObstacleKindId(kind)) return null;
  return Object.freeze({ passageId, kind });
}

export function registerPassageActionKinds(): void {
  if (!getClarificationKind("example")) {
    registerClarificationKind<ExampleTarget>("example", {
      parseId: parseExampleId,
      render: ({ parsed }) =>
        createElement(
          "p",
          null,
          createElement("a", { href: `/foundations/${parsed.id}/` }, "Open the worked example"),
        ),
      staticHref: (parsed) => `/foundations/${parsed.id}/`,
      title: (parsed) => parsed.id,
      descends: true,
    });
  }
  if (!getClarificationKind("obstacle")) {
    registerClarificationKind<ObstacleTarget>("obstacle", {
      parseId: parseObstacleId,
      staticHref: (parsed) => `#${parsed.passageId}-obstacle-${parsed.kind}`,
      title: () => "What is getting in the way?",
      descends: true,
    });
  }
}

registerPassageActionKinds();
