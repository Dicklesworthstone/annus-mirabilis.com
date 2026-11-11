import type { ExplanationExercisePart } from "../exercises/explanation.ts";
import { CONNECTION_EXERCISE_LINKS } from "./links.ts";
import type { ConnectionExercise } from "./types.ts";

const id = CONNECTION_EXERCISE_LINKS[3].id;

/** The fourth transfer task is deliberately a comparison in words, never a keyword-graded quiz. */
export const STATISTICAL_EXPLANATION: ExplanationExercisePart = {
  id: `${id}-explanation`,
  prompt:
    "Both papers connect a macroscopic quantity with an unseen microscopic description. What does each argument start from, what does it infer, and how strong is that conclusion? Explain why sharing an entropy-counting pattern does not make them the same argument.",
  criteria: [
    "For dilute monochromatic radiation in the Wien regime, the volume dependence of entropy suggests a heuristic analogy with independent energy quanta.",
    "The Brownian paper starts from molecular-kinetic premises and predicts an observable displacement law.",
    "Inferring a molecular number from that displacement law also needs independent information such as the particle radius and viscosity.",
    "The same mathematical pattern can connect two arguments without proving that their microscopic mechanisms are identical.",
    "Synthetic trajectories test a stated model and its inference machinery; an independent measurement is needed to test the account of the world.",
  ],
  workedExplanation:
    "In the light-quanta paper, the measured Wien-law form and thermodynamic relations give an entropy change with volume. Comparing its logarithmic dependence with independent configurations suggests that radiation in this restricted regime behaves as if its energy were carried in independent quanta. That is a heuristic inference from a thermodynamic pattern, not a microscopic mechanism established for all radiation. In the Brownian paper, the direction is different: molecular-kinetic assumptions, osmotic pressure and viscous drag predict diffusion and its displacement scale. Observing the scale can then constrain a molecular number, provided the radius, viscosity and other admitted inputs are known. Both connect the visible and invisible, but neither a shared logarithm nor a successful synthetic simulation supplies the missing empirical test.",
};

export const STATISTICAL_EXERCISE: ConnectionExercise = {
  id,
  title: CONNECTION_EXERCISE_LINKS[3].title,
  introduction: [
    "The light and Brownian papers both use statistical reasoning. The useful connection is what transfers between the arguments; the important boundary is what does not.",
    "This task has no numerical verdict. You can open the comparison criteria before writing, and your explanation is never scored or sent anywhere.",
  ],
  sections: [
    {
      id: `${id}-comparison`,
      title: "Name the premises before comparing the conclusions",
      paragraphs: [],
      parts: [{ kind: "explanation", part: STATISTICAL_EXPLANATION }],
    },
  ],
  links: [
    { href: "/discover/light-quanta/#step-06", label: "Journey I: the entropy comparison" },
    {
      href: "/discover/light-quanta/#step-08",
      label: "Journey I: what the prediction can be checked against",
    },
    { href: "/discover/brownian-motion/#step-07", label: "Journey II: invert a measured spread" },
    { href: "/papers/brownian-motion/#s2", label: "Brownian motion §2: the statistical argument" },
    { href: "/lab/lq-05/", label: "Try independent and locked configurations" },
  ],
};
