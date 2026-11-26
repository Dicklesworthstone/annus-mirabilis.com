import type { Sr06Parameters } from "./definition.ts";

export interface VelocityPaperCase {
  title: string;
  question: string;
  link: { href: string; label: string };
  parameters: Partial<Sr06Parameters>;
  sources: readonly { display: string; label: string }[];
}

export const SR06_PAPER_CASES = {
  transverse: {
    title: "A point moving across the frame",
    question: "In k the point travels straight upward at 0.6c. Which part of that motion does an observer in K measure along each axis?",
    link: { href: "/lab/sr-06/cases/transverse/", label: "Measure a transverse trajectory in both frames" },
    parameters: { mode: "angled", frameBeta: 0.6, movingSpeed: 0.6, alphaDeg: 90 },
    sources: [
      { display: "eq-s5-d1", label: "The trajectory in the moving frame" },
      { display: "eq-s5-d2", label: "The same trajectory in the stationary frame" },
      { display: "eq-s5-d3", label: "The speed from the component velocities" },
    ],
  },
  oblique: {
    title: "A point moving at 45 degrees",
    question: "In k the point travels at 0.6c with equal x and y velocity components. What components and total speed does the stationary frame measure?",
    link: { href: "/lab/sr-06/cases/oblique/", label: "Run the velocity calculation for a 45-degree trajectory" },
    parameters: { mode: "angled", frameBeta: 0.6, movingSpeed: 0.6, alphaDeg: 45 },
    sources: [
      { display: "eq-s5-d4", label: "How the component ratio gives the angle in k" },
      { display: "eq-s5-d5", label: "The speed at an arbitrary angle" },
    ],
  },
  "light-ray": {
    title: "A light ray seen from a moving frame",
    question: "A frame moves at 0.6c and a forward light ray travels at c in that frame. What speed does an observer in K measure for the ray?",
    link: { href: "/lab/sr-06/cases/light-ray/", label: "Run the light-speed case with a sublight observer" },
    parameters: { mode: "collinear", frameBeta: 0.6, movingSpeed: 1, alphaDeg: 0 },
    sources: [{ display: "eq-s5-d8", label: "The light-speed substitution in §5" }],
  },
} as const satisfies Record<string, VelocityPaperCase>;

export function velocityCaseAt(slug: string): VelocityPaperCase | undefined {
  if (!Object.hasOwn(SR06_PAPER_CASES, slug)) return undefined;
  return SR06_PAPER_CASES[slug as keyof typeof SR06_PAPER_CASES];
}
