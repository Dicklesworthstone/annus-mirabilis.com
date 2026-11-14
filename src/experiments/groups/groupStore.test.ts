import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { convertValue } from "../../units/adapters.ts";
import { makeRefusal } from "../results/refusals.ts";
import { SR09_CLASSES } from "../sr09/definition.ts";
import { createSr09Session } from "../sr09/session.ts";
import {
  SR10_CLASSES,
  SR10_DEFAULTS,
  SR10_OUTPUTS,
  type Sr10Parameters,
} from "../sr10/definition.ts";
import { validateSr10Parameters } from "../sr10/parameters.ts";
import { snapshotOutputs } from "../sr10/session.ts";
import { createInstanceStore, type Parameters, type RequestToken } from "../store/instanceStore.ts";
import { createExperimentGroup } from "./groupStore.ts";
import { loadRelativityObserverGroup } from "./load.ts";
import { createGroupMemberPort } from "./memberPort.ts";
import { ExperimentGroupDefinitionError } from "./schema.ts";

const definition = loadRelativityObserverGroup();
const speed = (beta: number) => convertValue(beta, "c", "m/s");

/** Real owner, publication validation and wave evaluator. Only publication timing is controlled. */
function delayedLightComplex(instanceId: string) {
  const store = createInstanceStore({
    instanceId,
    experimentId: "sr-10",
    initialParameters: SR10_DEFAULTS,
    parameterClasses: SR10_CLASSES,
    outputs: SR10_OUTPUTS,
    allowPartial: true,
  });
  const initial = store.issue("setup-change");
  assert(
    store.publish({
      ...initial,
      stepIndex: 0,
      simulationTime: 0,
      final: true,
      outputs: snapshotOutputs(SR10_DEFAULTS),
    }).accepted,
  );
  const requests: { token: RequestToken; parameters: Sr10Parameters }[] = [];
  const session = {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    acceptedParameters: () => store.getSnapshot().accepted?.parameters as Parameters,
    apply(input: unknown) {
      const checked = validateSr10Parameters(input);
      if (checked.kind !== "accepted") return checked;
      const token = store.issue("observer-change", { beta: checked.data.beta });
      requests.push({ token, parameters: checked.data });
      return { kind: "accepted" as const, data: token };
    },
  };
  return {
    session,
    requests,
    publish(index: number, final = true, stepIndex = 0) {
      const request = requests[index];
      assert(request);
      return store.publish({
        ...request.token,
        stepIndex,
        simulationTime: 0,
        final,
        outputs: snapshotOutputs(request.parameters),
      });
    },
    refuse(index: number) {
      const request = requests[index];
      assert(request);
      return store.refuse(
        request.token,
        makeRefusal(
          "invalid-parameter",
          { parameterIds: ["beta"] },
          {
            details: { requirements: "Choose an admitted observer speed." },
          },
        ),
      );
    },
  };
}

function comparison(id: string) {
  const doppler = createSr09Session(`${id}-doppler`);
  const light = delayedLightComplex(`${id}-light`);
  const ports = [
    createGroupMemberPort(definition, "sr-09", doppler, SR09_CLASSES),
    createGroupMemberPort(definition, "sr-10", light.session, SR10_CLASSES),
  ];
  const group = createExperimentGroup(definition, ports);
  group.connect();
  return { doppler, light, ports, group };
}

describe("coherent generations with real independently owned snapshots", () => {
  test("one pending or partial member cannot publish a coherent comparison", () => {
    const { group, light } = comparison("pending");
    const separate = group.getSnapshot().independentSnapshots;
    group.link(speed(-0.6));
    expect(group.getSnapshot().phase).toBe("pending");
    expect(group.getSnapshot().members.map((member) => member.status)).toEqual([
      "accepted",
      "pending",
    ]);
    expect(group.getSnapshot().coherent).toBe(null);
    expect(group.getSnapshot().independentSnapshots).toBe(separate);
    expect(
      group
        .getSnapshot()
        .independentSnapshots.every((snapshot) => snapshot.parameters.beta === 0.6),
    ).toBe(true);
    expect(light.publish(0, false).accepted).toBe(true);
    expect(group.getSnapshot().phase).toBe("pending");
    expect(group.getSnapshot().coherent).toBe(null);
    expect(group.getSnapshot().independentSnapshots).toBe(separate);
    expect(light.publish(0, true, 1).accepted).toBe(true);
    expect(group.getSnapshot().phase).toBe("accepted");
    expect(
      group
        .getSnapshot()
        .coherent?.members.every((member) => member.snapshot.parameters.beta === -0.6),
    ).toBe(true);
    group.disconnect();
  });

  test("an older publication cannot borrow a later generation; last coherent results survive pending and refusal", () => {
    const { group, light } = comparison("superseded");
    group.link(speed(-0.6));
    light.publish(0);
    const first = group.getSnapshot().coherent;
    group.change(speed(0.2));
    expect(group.getSnapshot().coherent).toBe(first);
    group.change(speed(0.4));
    expect(light.publish(1).accepted).toBe(false);
    expect(group.getSnapshot().phase).toBe("pending");
    expect(group.getSnapshot().coherent).toBe(first);
    expect(light.publish(2).accepted).toBe(true);
    const latest = group.getSnapshot().coherent;
    expect(latest?.generationId).toBe(3);
    expect(latest?.members.every((member) => member.snapshot.parameters.beta === 0.4)).toBe(true);
    group.change(speed(0.3));
    expect(light.refuse(3).accepted).toBe(true);
    expect(group.getSnapshot().phase).toBe("refused");
    expect(group.getSnapshot().coherent).toBe(latest);
    expect(group.getSnapshot().refusal?.code).toBe("invalid-parameter");
    group.disconnect();
  });

  test("unlinked late replies never relink, issue another request, or publish a new group generation", () => {
    const { group, light, doppler } = comparison("unlink-pending");
    group.link(speed(-0.6));
    const before = doppler.getSnapshot();
    const generation = group.getSnapshot().generationId;
    group.unlink();
    expect(doppler.getSnapshot()).toBe(before);
    expect(light.requests).toHaveLength(1);
    light.publish(0);
    expect(group.getSnapshot().enabled).toBe(false);
    expect(group.getSnapshot().phase).toBe("independent");
    expect(group.getSnapshot().coherent).toBe(null);
    expect(group.getSnapshot().generationId).toBe(generation);
    expect(light.requests).toHaveLength(1);
    group.disconnect();
  });

  test("late mounting is explicit and detaching removes its subscription", () => {
    const { group, light } = comparison("membership");
    group.link(speed(0.2));
    light.publish(0);
    const additional = createSr09Session("explicit-extra");
    const port = createGroupMemberPort(definition, "sr-09", additional, SR09_CLASSES);
    expect(group.attach(port).kind).toBe("accepted");
    expect(group.getSnapshot().phase).toBe("pending");
    expect(additional.acceptedParameters().beta).toBe(0.2);
    light.publish(1);
    expect(group.getSnapshot().coherent?.members).toHaveLength(3);
    group.detach(port.instanceId);
    const detached = group.getSnapshot();
    additional.apply({ ...additional.acceptedParameters(), beta: -0.2 });
    expect(group.getSnapshot()).toBe(detached);
    group.detach("membership-light");
    expect(group.getSnapshot().enabled).toBe(false);
    expect(group.getSnapshot().members).toHaveLength(1);
    group.disconnect();
  });

  test("invalid-experiment-group refuses duplicate instances or a forged member domain (groupStore.ts:92)", () => {
    const { group, ports } = comparison("identity");
    assert(ports[0] && ports[1]);
    expect(() => createExperimentGroup(definition, [ports[0], ports[0]])).toThrow(
      ExperimentGroupDefinitionError,
    );
    const forged = {
      ...ports[1],
      definition: {
        ...ports[1].definition,
        domain: { ...ports[1].definition.domain, max: Number.MAX_VALUE },
      },
    };
    expect(() => createExperimentGroup(definition, [ports[0], forged])).toThrow(
      ExperimentGroupDefinitionError,
    );
    expect(group.attach(forged).kind).toBe("refused");
    group.disconnect();
  });
});
