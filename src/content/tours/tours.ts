/**
 * TIMED TOURS WITHOUT EQUATIONS (am-tour-15min-mass-energy-nqz1): a tour record in
 * content/tours/<id>.yaml, resolved against the records each step shows.
 *
 * A tour writes none of the reading it shows. A reading step names paragraph anchors, and its text is
 * each paragraph's R0 overview (content/bindings/<paper>.yaml). The first encounter is the paper's
 * entrance record. A journey step is the journey's own move summary, by reference. An instrument step
 * names a laboratory, a predict prompt its manifest registers, and the preset or teaching tape whose
 * settings answer it; the tour supplies only the plain-words rendering of that prompt, bound to the
 * manifest's candidate ids. What the tour does author (purposes, questions, choices, responses, the
 * completion statement) is checked here like everything it resolves.
 *
 * Each problem starts with the rule it breaks, so a test can name it:
 * - `tour-prediction-candidates-mismatch`: a prediction's candidates are not the prompt's, once each;
 * - `tour-instrument-step-missing-prompt`: an instrument step cites no registered prompt;
 * - `tour-tape-does-not-reveal-prompt`: the cited preset or tape never sets the prompt's control;
 * - `tour-move-summary-missing`: no move summary, or an unreviewed one where the profile needs review;
 * - `tour-step-math`: math, a symbol, or a forbidden phrasing in anything a step shows;
 * - `tour-step-under-lower-bound`: a step estimated below its honest reading time;
 * - `tour-over-budget`: the steps add up to more than the budget;
 * - `tour-anchor-unresolved`: an anchor, record, laboratory, preset or tape that does not exist.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MOVE as MASS_ENERGY_MOVE } from "../../discovery/massEnergy/journeyIV.ts";
import { REGISTERED_IDS } from "../../experiments/catalogue.ts";
import { parseYaml } from "../provenance/yaml.ts";

/** Minutes each budget allows. */
export const TOUR_BUDGETS: Readonly<Record<string, number>> = { "fifteen-minutes": 15 };
/** Reading pace for the honest-time lower bound. */
export const WORDS_PER_MINUTE = 200;
/** Fixed lower bounds for the steps a reader works through rather than reads. */
export const LOWER_BOUND_MINUTES = { "first-encounter": 3, instrument: 2 } as const;

/** Journeys whose move summary a tour can cite, by paper. */
const MOVES: Readonly<
  Record<
    string,
    Readonly<{ journeyId: string; href: string; r0Summary: { text: string; reviewState: string } }>
  >
> = {
  "mass-energy": {
    journeyId: "journey-iv",
    href: "/discover/mass-energy/",
    r0Summary: MASS_ENERGY_MOVE.r0Summary,
  },
};

export type TourChoice = Readonly<{ candidateId: string; text: string; response: string }>;

export type TourStep = Readonly<
  { id: string; title: string; minutes: number; purpose: string } & (
    | { kind: "first-encounter"; anchor: string; recordId: string; question: string }
    | {
        kind: "reading";
        paragraphs: readonly Readonly<{
          anchor: string;
          r0: string;
          passages: readonly string[];
        }>[];
      }
    | {
        kind: "instrument";
        instrumentId: string;
        promptId: string;
        controlId: string;
        supportedCandidateId: string | undefined;
        reveal: Readonly<{ kind: "preset" | "tape"; id: string; label: string }>;
        question: string;
        choices: readonly TourChoice[];
      }
    | {
        kind: "journey-stage";
        journeyId: string;
        href: string;
        summary: string;
        reviewState: string;
      }
  )
>;

export type Tour = Readonly<{
  id: string;
  title: string;
  paper: string;
  budget: string;
  budgetMinutes: number;
  introduction: string;
  completion: string;
  targetClaim: string;
  steps: readonly TourStep[];
  totalMinutes: number;
}>;

/** The honest reading time of some visible words, rounded up to the next half minute. */
export function readingMinutes(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(0.5, Math.ceil((words / WORDS_PER_MINUTE) * 2) / 2);
}

/**
 * What a step at detail 0 may never show: math delimiters or TeX, the symbols the bead names, and
 * the phrasings it forbids. Returns each hit, so a failure names what it found.
 */
export function mathAndPhrasingHits(text: string): string[] {
  const hits: string[] = [];
  if (/\\\(|\\\[|\$|\\[a-zA-Z]+/.test(text)) hits.push("math markup");
  for (const symbol of ["c²", "c^2", "L/", "γ", "V²", "β", "φ", "²", "³", "√"])
    if (text.includes(symbol)) hits.push(symbol);
  if (/\b[Mm]c\b/.test(text)) hits.push("mc");
  for (const phrase of [
    /E\s*=\s*mc/i,
    /\bmc²/i,
    /\bconverts?\b/i,
    /turns? into energy/i,
    /\bbombs?\b/i,
    /\breactors?\b/i,
  ])
    if (phrase.test(text)) hits.push(phrase.source);
  return hits;
}

type Preset = { presetId?: unknown; label?: unknown; parameterValues?: Record<string, unknown> };
type Prompt = {
  promptId?: unknown;
  controlId?: unknown;
  supportedCandidateId?: unknown;
  candidates?: { id?: unknown }[];
};
type Manifest = { id?: unknown; presets?: Preset[]; predictMode?: { prompts?: Prompt[] } };

const str = (x: unknown): string => (typeof x === "string" ? x.trim() : "");
const list = (x: unknown): readonly unknown[] => (Array.isArray(x) ? x : []);

function readYaml<T>(path: string): T | null {
  return existsSync(path) ? (parseYaml(readFileSync(path, "utf8")) as T) : null;
}

/** Everything a tour shows, resolved, with every problem; null when the record does not exist. */
export function loadTour(
  root: string,
  id: string,
  profile = "scaffold",
): Readonly<{ tour: Tour; problems: readonly string[] }> | null {
  const raw = readYaml<Record<string, unknown>>(join(root, "content", "tours", `${id}.yaml`));
  if (!raw) return null;
  return checkTour(root, raw, profile);
}

/** Checks a raw tour record against the repository at `root`. */
export function checkTour(
  root: string,
  raw: Record<string, unknown>,
  profile = "scaffold",
): Readonly<{ tour: Tour; problems: readonly string[] }> {
  const problems: string[] = [];
  const id = str(raw.id);
  const paper = str(raw.paper);
  const budget = str(raw.budget);
  const budgetMinutes = TOUR_BUDGETS[budget] ?? 0;
  if (!budgetMinutes) problems.push(`tour-over-budget: ${id} names no known budget (${budget})`);
  if (raw.requiresEquations !== false)
    problems.push(`tour-step-math: ${id} must declare requiresEquations: false`);

  const bindings =
    readYaml<{ paragraphs?: { unit?: unknown; r0?: unknown; passages?: unknown }[] }>(
      join(root, "content", "bindings", `${paper}.yaml`),
    )?.paragraphs ?? [];
  const r0Of = new Map(bindings.map((b) => [str(b.unit), str(b.r0)]));
  const passagesOf = new Map(
    bindings.map((b) => [
      str(b.unit),
      list(b.passages)
        .map((x) => str(x))
        .filter(Boolean),
    ]),
  );

  const shown: { where: string; text: string }[] = [];
  const show = (where: string, text: string) => shown.push({ where, text });
  for (const field of ["title", "introduction", "completion", "targetClaim"] as const) {
    if (!str(raw[field])) problems.push(`tour-anchor-unresolved: ${id} has no ${field}`);
    show(`${id} ${field}`, str(raw[field]));
  }

  const steps: TourStep[] = [];
  const seen = new Set<string>();
  for (const [i, entry] of list(raw.steps).entries()) {
    const s = (entry ?? {}) as Record<string, unknown>;
    const stepId = str(s.id) || `#${i + 1}`;
    const at = `${id} step ${stepId}`;
    if (seen.has(stepId)) problems.push(`tour-anchor-unresolved: ${at} is used twice`);
    seen.add(stepId);
    const minutes = typeof s.minutes === "number" ? s.minutes : 0;
    const title = str(s.title);
    if (!title) problems.push(`tour-anchor-unresolved: ${at} has no title`);
    show(`${at} title`, title);
    const purpose = str(s.purpose);
    show(`${at} purpose`, purpose);
    const kind = str(s.kind);
    let lowerBound = 0;

    if (kind === "first-encounter") {
      const recordId = str(s.record);
      const anchor = str(s.anchor);
      const record = existsSync(join(root, "content", "arguments", paper, `${recordId}.json`))
        ? (JSON.parse(
            readFileSync(join(root, "content", "arguments", paper, `${recordId}.json`), "utf8"),
          ) as { sourceAnchor?: unknown; question?: unknown })
        : null;
      if (!record || str(record.sourceAnchor) !== `#${anchor}`)
        problems.push(
          `tour-anchor-unresolved: ${at} names ${recordId} at #${anchor}, which is not the paper's entrance`,
        );
      lowerBound = LOWER_BOUND_MINUTES["first-encounter"];
      steps.push({
        id: stepId,
        title,
        minutes,
        purpose,
        kind,
        anchor,
        recordId,
        question: str(record?.question),
      });
    } else if (kind === "reading") {
      const paragraphs = list(s.anchors).map((a) => {
        const anchor = str(a);
        const r0 = r0Of.get(anchor) ?? "";
        if (!r0)
          problems.push(`tour-anchor-unresolved: ${at} names ${anchor}, which has no R0 overview`);
        show(`${at} ${anchor} R0`, r0);
        return { anchor, r0, passages: passagesOf.get(anchor) ?? [] };
      });
      if (paragraphs.length === 0)
        problems.push(`tour-anchor-unresolved: ${at} names no paragraph`);
      lowerBound = readingMinutes([purpose, ...paragraphs.map((p) => p.r0)].join(" "));
      steps.push({ id: stepId, title, minutes, purpose, kind, paragraphs });
    } else if (kind === "instrument") {
      const instrumentId = str(s.instrument);
      if (!(REGISTERED_IDS as readonly string[]).includes(instrumentId))
        problems.push(
          `tour-anchor-unresolved: ${at} names ${instrumentId}, which is not a registered laboratory`,
        );
      const manifest =
        readYaml<Manifest>(join(root, "content", "experiments", `${instrumentId}.yaml`)) ?? {};
      const promptId = str(s.promptId);
      const prompt = (manifest.predictMode?.prompts ?? []).find(
        (p) => str(p.promptId) === promptId,
      ) as Prompt | undefined;
      if (!promptId || !prompt)
        problems.push(
          `tour-instrument-step-missing-prompt: ${at} cites ${promptId || "no prompt"}, which ${instrumentId} does not register`,
        );
      const controlId = str(prompt?.controlId);
      const expected = list(prompt?.candidates).map((c) => str((c as { id?: unknown }).id));

      const prediction = (s.tourPrediction ?? {}) as {
        promptId?: unknown;
        question?: unknown;
        choices?: unknown;
      };
      if (str(prediction.promptId) !== promptId)
        problems.push(
          `tour-prediction-candidates-mismatch: ${at}'s prediction names ${str(prediction.promptId) || "no prompt"}, not ${promptId}`,
        );
      const choices = list(prediction.choices).map((c) => {
        const o = (c ?? {}) as { candidateId?: unknown; text?: unknown; response?: unknown };
        return { candidateId: str(o.candidateId), text: str(o.text), response: str(o.response) };
      });
      const given = choices.map((c) => c.candidateId);
      const once = new Set(given).size === given.length;
      if (!once || given.length !== expected.length || given.some((g) => !expected.includes(g)))
        problems.push(
          `tour-prediction-candidates-mismatch: ${at} gives ${given.join(", ") || "none"}; the prompt's candidates are ${expected.join(", ")}`,
        );
      const question = str(prediction.question);
      show(`${at} question`, question);
      for (const c of choices) {
        if (!c.text || !c.response)
          problems.push(
            `tour-prediction-candidates-mismatch: ${at} choice ${c.candidateId} lacks its text or response`,
          );
        show(`${at} choice ${c.candidateId}`, c.text);
        show(`${at} response ${c.candidateId}`, c.response);
      }

      const presetId = str(s.preset);
      const tapeId = str(s.tape);
      let reveal: { kind: "preset" | "tape"; id: string; label: string } = {
        kind: "preset",
        id: "",
        label: "",
      };
      if (presetId) {
        const preset = (manifest.presets ?? []).find((p) => str(p.presetId) === presetId);
        if (!preset)
          problems.push(
            `tour-anchor-unresolved: ${at} names preset ${presetId}, which ${instrumentId} does not register`,
          );
        else if (!controlId || !(controlId in (preset.parameterValues ?? {})))
          problems.push(
            `tour-tape-does-not-reveal-prompt: ${at}'s preset ${presetId} never sets ${controlId || "the prompt's control"}`,
          );
        reveal = { kind: "preset", id: presetId, label: str(preset?.label) };
      } else if (tapeId) {
        const tape = readYaml<{
          experimentId?: unknown;
          title?: unknown;
          events?: { parameterId?: unknown }[];
        }>(join(root, "content", "experiments", "tapes", `${tapeId}.yaml`));
        if (!tape || str(tape.experimentId) !== instrumentId)
          problems.push(
            `tour-anchor-unresolved: ${at} names tape ${tapeId}, which is not a ${instrumentId} tape`,
          );
        else if (
          !list(tape.events).some(
            (e) => str((e as { parameterId?: unknown }).parameterId) === controlId,
          )
        )
          problems.push(
            `tour-tape-does-not-reveal-prompt: ${at}'s tape ${tapeId} never sets ${controlId || "the prompt's control"}`,
          );
        reveal = { kind: "tape", id: tapeId, label: str(tape?.title) };
      } else problems.push(`tour-tape-does-not-reveal-prompt: ${at} cites no preset or tape`);

      lowerBound = LOWER_BOUND_MINUTES.instrument;
      steps.push({
        id: stepId,
        title,
        minutes,
        purpose,
        kind,
        instrumentId,
        promptId,
        controlId,
        supportedCandidateId: str(prompt?.supportedCandidateId) || undefined,
        reveal,
        question,
        choices,
      });
    } else if (kind === "journey-stage") {
      const move = MOVES[str(s.moveSummaryOf)];
      const needsReview = profile === "preview" || profile === "launch";
      if (!move?.r0Summary.text)
        problems.push(
          `tour-move-summary-missing: ${at} names no journey move for ${str(s.moveSummaryOf)}`,
        );
      else if (needsReview && move.r0Summary.reviewState !== "reviewed")
        problems.push(
          `tour-move-summary-missing: ${at}'s move summary is ${move.r0Summary.reviewState}, and the ${profile} profile shows only a reviewed one`,
        );
      const summary = move?.r0Summary.text ?? "";
      show(`${at} move summary`, summary);
      lowerBound = readingMinutes([purpose, summary].join(" "));
      steps.push({
        id: stepId,
        title,
        minutes,
        purpose,
        kind,
        journeyId: move?.journeyId ?? "",
        href: move?.href ?? "",
        summary,
        reviewState: move?.r0Summary.reviewState ?? "",
      });
    } else
      problems.push(
        `tour-anchor-unresolved: ${at} has kind ${kind || "none"}, which a tour cannot show`,
      );

    if (minutes < lowerBound)
      problems.push(
        `tour-step-under-lower-bound: ${at} is estimated at ${minutes} min, below its ${lowerBound} min lower bound`,
      );
  }

  for (const { where, text } of shown) {
    const hits = mathAndPhrasingHits(text);
    if (hits.length > 0) problems.push(`tour-step-math: ${where} shows ${hits.join(", ")}`);
  }
  const totalMinutes = steps.reduce((sum, s) => sum + s.minutes, 0);
  if (budgetMinutes && totalMinutes > budgetMinutes)
    problems.push(
      `tour-over-budget: ${id} adds up to ${totalMinutes} min, over its ${budgetMinutes} min budget`,
    );

  return {
    tour: {
      id,
      title: str(raw.title),
      paper,
      budget,
      budgetMinutes,
      introduction: str(raw.introduction),
      completion: str(raw.completion),
      targetClaim: str(raw.targetClaim),
      steps,
      totalMinutes,
    },
    problems,
  };
}

/** A tour the site will not publish: every problem, by its rule. */
export class TourError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "TourError";
    this.code = code;
  }
}

/** The ids of the tour records in content/tours. */
export function tourIds(root: string): readonly string[] {
  const dir = join(root, "content", "tours");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.endsWith(".yaml"))
    .map((n) => n.replace(/\.yaml$/, ""))
    .sort();
}

/** A tour the page can show, or null when there is no such record; a tour with a problem is refused. */
export function requireTour(root: string, id: string, profile = "scaffold"): Tour | null {
  const loaded = loadTour(root, id, profile);
  if (!loaded) return null;
  if (loaded.problems.length > 0)
    throw new TourError(
      "tour-invalid",
      `Tour ${id} does not resolve:\n${loaded.problems.join("\n")}`,
    );
  return loaded.tour;
}
