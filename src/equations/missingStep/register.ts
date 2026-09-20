import { createElement } from "react";
import generated from "../../generated/missing-steps.json";
import { getClarificationKind, registerClarificationKind } from "../../reader/stack/kinds.ts";
import type { CompiledMissingStepLesson } from "./compiled.ts";
import { MissingStepPanel } from "./MissingStepPanel.tsx";

const lessons: readonly CompiledMissingStepLesson[] = generated.lessons;
function resolve(raw: string) {
  for (const lesson of lessons) {
    const step = lesson.steps.find((step) => step.id === raw);
    if (step) return { lesson, step };
  }
  return null;
}
if (!getClarificationKind("derivation-step"))
  registerClarificationKind("derivation-step", {
    parseId: resolve,
    staticHref: ({ lesson, step }) =>
      `/papers/brownian-motion/s4/?open=derivation-step:${step.id}#${lesson.argument}`,
    title: ({ step }) => step.title,
    descends: true,
    render: ({ parsed }) => createElement(MissingStepPanel, parsed),
  });
