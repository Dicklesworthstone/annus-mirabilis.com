import { makeRefusal } from "../results/refusals.ts";
import { SR09_CLASSES } from "../sr09/definition.ts";
import { validateSr09Parameters } from "../sr09/parameters.ts";
import { createSr09Session, type PreparedSr09Example } from "../sr09/session.ts";
import { SR10_CLASSES } from "../sr10/definition.ts";
import { validateSr10Parameters } from "../sr10/parameters.ts";
import { createSr10Session, type PreparedSr10Example } from "../sr10/session.ts";
import { createExperimentGroup, type GroupAction } from "./groupStore.ts";
import { createGroupMemberPort } from "./memberPort.ts";
import {
  type ExperimentGroupDefinition,
  ExperimentGroupDefinitionError,
  insideGroupDomain,
} from "./schema.ts";

export type LinkedObserverExamples = Readonly<{
  doppler: PreparedSr09Example;
  lightComplex: PreparedSr10Example;
}>;
export type LinkedObserverInstrument = "sr-09" | "sr-10";

/** Generated examples cross the JSON boundary before the two actual owners receive them. */
export function prepareLinkedObserverExamples(
  examples: Readonly<{
    doppler: Omit<PreparedSr09Example, "parameters"> & { parameters: unknown };
    lightComplex: Omit<PreparedSr10Example, "parameters"> & { parameters: unknown };
  }>,
): LinkedObserverExamples {
  const doppler = validateSr09Parameters(examples.doppler.parameters);
  const lightComplex = validateSr10Parameters(examples.lightComplex.parameters);
  if (doppler.kind !== "accepted" || lightComplex.kind !== "accepted")
    throw new ExperimentGroupDefinitionError(
      "invalid-experiment-group",
      "The linked observer's prepared instrument inputs are invalid.",
    );
  return Object.freeze({
    doppler: Object.freeze({ ...examples.doppler, parameters: doppler.data }),
    lightComplex: Object.freeze({ ...examples.lightComplex, parameters: lightComplex.data }),
  });
}

/** Only the observer changes here. Each experiment keeps its own owner and physical inputs. */
export function createLinkedObserverSession(
  instanceId: string,
  definition: ExperimentGroupDefinition,
  examples: LinkedObserverExamples,
) {
  if (
    examples.doppler.parameters.propagationAngleDeg !==
    examples.lightComplex.parameters.propagationAngleDeg
  )
    throw new ExperimentGroupDefinitionError(
      "invalid-experiment-group",
      "The two descriptions must begin with the same light direction in K.",
    );
  const doppler = createSr09Session(`${instanceId}-doppler`, examples.doppler);
  const lightComplex = createSr10Session(`${instanceId}-light-complex`, examples.lightComplex);
  const ports = {
    "sr-09": createGroupMemberPort(definition, "sr-09", doppler, SR09_CLASSES),
    "sr-10": createGroupMemberPort(definition, "sr-10", lightComplex, SR10_CLASSES),
  };
  const group = createExperimentGroup(definition, Object.values(ports));
  return Object.freeze({
    definition,
    getSnapshot: group.getSnapshot,
    getServerSnapshot: group.getServerSnapshot,
    subscribe: group.subscribe,
    connect: group.connect,
    disconnect: group.disconnect,
    link: group.link,
    changeLinkedSpeed: group.change,
    unlink: group.unlink,
    changeIndependentSpeed(instrumentId: LinkedObserverInstrument, speedSI: number): GroupAction {
      const port = ports[instrumentId];
      if (group.getSnapshot().enabled || !insideGroupDomain(port.definition.domain, speedSI))
        return {
          kind: "refused",
          refusal: makeRefusal(
            "invalid-parameter",
            { parameterIds: [port.definition.parameterId] },
            {
              details: {
                requirements: group.getSnapshot().enabled
                  ? "Unlink the observers before changing one instrument independently."
                  : `Use a speed within the admitted range for ${port.definition.label}.`,
              },
            },
          ),
        };
      const result = port.request(speedSI, group.getSnapshot().generationId);
      return result.kind === "accepted"
        ? { kind: "accepted", generationId: group.getSnapshot().generationId }
        : result;
    },
    // These are the actual instrument owners, exposed for identity and lifecycle verification.
    owners: Object.freeze({ doppler, lightComplex }),
  });
}
