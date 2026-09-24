import type { enumerateSignedSteps } from "../../experiments/bm05/stepEnumeration.ts";
export type CompiledMissingStep = Readonly<{
  id: string;
  title: string;
  fromHtml: string;
  toHtml: string;
  changed: readonly string[];
  rule: string;
  premiseTexts: readonly string[];
  readings: Readonly<{ r0: string; r1: string; r2: string }>;
  isMove: boolean;
  /** The foundation lesson the step's reason relies on, as a bare slug; null while it has none. */
  tool: string | null;
  /** That lesson's title, so the link can name the lesson it opens; null with no tool. */
  toolTitle: string | null;
}>;
export type CompiledMissingStepLesson = Readonly<{
  id: string;
  argument: string;
  title: string;
  routeLabel: string;
  sourceLink: string;
  sourceLabel: string;
  sourceNotice: string;
  premiseNotice: string;
  generalization: string;
  absoluteNote: string;
  modernNote: string;
  steps: readonly CompiledMissingStep[];
  cases: readonly Readonly<{
    label: string;
    explanation: string;
    result: Omit<ReturnType<typeof enumerateSignedSteps>, "dependence"> & { dependence: string };
  }>[];
}>;
