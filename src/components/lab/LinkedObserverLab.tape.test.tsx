import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import assert from "node:assert/strict";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as linkedOwners from "../../experiments/groups/linkedObserver.ts";
import { tapeForLinkedObserver } from "../../experiments/groups/linkedObserverTape.ts";
import { loadRelativityObserverGroup } from "../../experiments/groups/load.ts";
import * as browserCodec from "../../experiments/permalink/browserCodec.ts";
import { decodeTapeDocument, encodeTapePermalink } from "../../experiments/permalink/codec.ts";
import type { TapeDocument, TapeGroupV3 } from "../../experiments/permalink/types.ts";
import { DEFAULT_PREPARED_EXAMPLE as doppler } from "../../experiments/sr09/session.ts";
import { DEFAULT_PREPARED_EXAMPLE as lightComplex } from "../../experiments/sr10/session.ts";
import { createContainer, installDom, removeContainer, uninstallDom } from "../../testing/reactDom.ts";
import { convertValue } from "../../units/adapters.ts";
import { LinkedObserverLab } from "./LinkedObserverLab.tsx";

const definition = loadRelativityObserverGroup();
const examples = { doppler, lightComplex };
let container: HTMLElement;
let root: Root | null = null;
let jobs: { release(): void }[] = [];
let restoreSpies: (() => void) | null = null;
let ownerCreations = 0;

function record(beta: number, enabled = true): TapeGroupV3 {
  const source = linkedOwners.createLinkedObserverSession("navigation-recording", definition, examples);
  source.connect();
  try {
    if (enabled) source.link(convertValue(beta, "c", "m/s"));
    else {
      source.changeIndependentSpeed("sr-09", convertValue(beta, "c", "m/s"));
      source.changeIndependentSpeed("sr-10", convertValue(0.2, "c", "m/s"));
    }
    const tape = tapeForLinkedObserver(source);
    assert(tape);
    return tape;
  } finally {
    source.disconnect();
  }
}

beforeEach(async () => {
  await installDom();
  history.replaceState({}, "", "/lab/linked-observer/");
  container = createContainer();
  jobs = [];
  ownerCreations = 0;
  const createOwner = linkedOwners.createLinkedObserverSession;
  const owners = spyOn(linkedOwners, "createLinkedObserverSession").mockImplementation((...args) => {
    ownerCreations += 1;
    return createOwner(...args);
  });
  // Hold the actual decode result to exercise late completion and cancellation at the async boundary.
  const decode = spyOn(browserCodec, "decodeTapeDocumentInBrowser").mockImplementation((input) => {
    const result = decodeTapeDocument(input);
    return new Promise((resolve) => jobs.push({ release: () => resolve(result) }));
  });
  const encode = spyOn(browserCodec, "encodeTapePermalinkInBrowser").mockImplementation(
    async (tape, options) => encodeTapePermalink(tape, options),
  );
  restoreSpies = () => {
    owners.mockRestore();
    decode.mockRestore();
    encode.mockRestore();
  };
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
    for (const job of jobs) job.release();
  });
  root = null;
  restoreSpies?.();
  restoreSpies = null;
  removeContainer(container);
  await uninstallDom();
});

async function mount(tape?: TapeDocument) {
  if (tape) history.replaceState({}, "", `/lab/linked-observer/?tape=${encodeTapePermalink(tape)}`);
  root = createRoot(container);
  await act(async () => root?.render(<LinkedObserverLab definition={definition} examples={examples} />));
}

async function until(check: () => boolean) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    assert(Date.now() < deadline, "The comparison must settle its controlled async boundary.");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)));
  }
}

function current() {
  const region = container.querySelector("[data-linked-observer]");
  assert(region);
  return {
    enabled: region.getAttribute("data-group-enabled"),
    phase: region.getAttribute("data-group-phase"),
    betas: [...region.querySelectorAll("[data-observer-beta]")].map((entry) => entry.textContent),
    runs: [...region.querySelectorAll("[data-member]")].map((entry) => entry.getAttribute("data-run-id")),
  };
}

function shareUrl() {
  return container.querySelector<HTMLInputElement>('[data-testid="selectable-url"]')?.value ?? "";
}

async function navigate(tape: TapeGroupV3) {
  await act(async () => {
    history.pushState({}, "", `/lab/linked-observer/?tape=${encodeTapePermalink(tape)}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

test("mount restores both owners together and shares their linked state through the normal control", async () => {
  const tape = record(-0.6);
  await mount(tape);
  await until(() => jobs.length === 1);
  expect(current().enabled).toBe("false");
  expect(current().betas).toEqual(["0.6", "0.6"]);
  expect(container.querySelector<HTMLFormElement>(".linked-observer-link")?.hidden).toBe(true);
  await act(async () => jobs[0]?.release());
  await until(() => current().enabled === "true" && shareUrl() !== "");
  expect(current().phase).toBe("accepted");
  expect(current().betas).toEqual(["−0.6", "−0.6"]);
  expect(container.querySelector("[data-group-restore]")?.textContent).toContain("observers linked");
  const decoded = decodeTapeDocument(new URL(shareUrl()));
  assert(decoded.kind === "success" && decoded.tape.tapeVersion === 3);
  expect(decoded.tape.group.enabled).toBe(true);
  expect(decoded.tape.members.map((member) => member.tape.initialConditions.beta)).toEqual([-0.6, -0.6]);
});

test("unlinked incoming links preserve both distinct speeds and the independent controls", async () => {
  await mount(record(-0.6, false));
  await until(() => jobs.length === 1);
  await act(async () => jobs[0]?.release());
  await until(() => shareUrl() !== "");
  expect(current().enabled).toBe("false");
  expect(current().betas).toEqual(["−0.6", "0.2"]);
  expect(container.querySelector(".linked-observer-independent")).not.toBeNull();
  expect(container.querySelector(".linked-observer-conclusion")).toBeNull();
  expect(container.querySelector("[data-group-restore]")?.textContent).toContain("independent observers");
});

test("popstate supersedes an older decode and repeated pageshow never replays the same link", async () => {
  const older = record(-0.6);
  const newer = record(0.3);
  await mount(older);
  await until(() => jobs.length === 1);
  await navigate(newer);
  await until(() => jobs.length === 2);
  await act(async () => jobs[1]?.release());
  await until(() => current().betas.every((value) => value === "0.3"));
  const accepted = current();
  await act(async () => jobs[0]?.release());
  expect(current()).toEqual(accepted);
  await act(async () => window.dispatchEvent(new Event("pageshow")));
  expect(jobs).toHaveLength(2);
  expect(current()).toEqual(accepted);
  await navigate(record(0.5));
  await until(() => jobs.length === 3);
  await act(async () => jobs[2]?.release());
  await until(() => current().betas.every((value) => value === "0.5"));
  expect(current().runs).not.toEqual(accepted.runs);
});

test("a bad second checkpoint and an attempted unlink during decode keep the accepted pair", async () => {
  const good = record(-0.6);
  await mount(good);
  await until(() => jobs.length === 1);
  await act(async () => jobs[0]?.release());
  await until(() => current().enabled === "true");
  const before = current();
  const broken = {
    ...good,
    members: good.members.map((member) => member.memberId === "sr-10"
      ? { ...member, tape: { ...member.tape, acceptedCheckpoint: { ...member.tape.acceptedCheckpoint, digest: "host:0000000000000000" } } }
      : member),
  };
  await navigate(broken);
  await until(() => jobs.length === 2);
  const unlink = [...container.querySelectorAll("button")].find((button) => button.textContent === "Unlink observers");
  assert(unlink);
  await act(async () => unlink.click());
  expect(current()).toEqual(before);
  await act(async () => jobs[1]?.release());
  await until(() => container.querySelector("[data-group-restore]")?.textContent?.includes("unchanged") === true);
  expect(current()).toEqual(before);
});

test("a canceled decode cannot create candidate owners after the component leaves", async () => {
  const tape = record(-0.6);
  await mount(tape);
  await until(() => jobs.length === 1);
  const createdBeforeDeparture = ownerCreations;
  await act(async () => root?.unmount());
  root = null;
  await act(async () => jobs[0]?.release());
  expect(ownerCreations).toBe(createdBeforeDeparture);
  expect(container.querySelector("[data-linked-observer]")).toBeNull();
});
