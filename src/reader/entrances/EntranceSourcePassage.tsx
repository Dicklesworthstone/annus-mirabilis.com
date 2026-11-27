import type { PaperSlug } from "../../content/schemas/source.pure.ts";

// Each address is a printed display with its own aligned translation unit.
// Use the static faces so a reader following a lesson or tour can go there without JavaScript.
const PASSAGES = {
  "brownian-motion": {
    id: "eq-s5-d2",
    description:
      "In §5 Einstein uses the diffusion coefficient and elapsed time to give the root-mean-square displacement along one axis.",
  },
  "special-relativity": {
    id: "eq-s1-d1",
    description:
      "In §1 Einstein defines synchronized clocks by assigning equal travel times to the outward and returning light signals.",
  },
  "light-quanta": {
    id: "eq-s5-d7",
    description:
      "In §5 Einstein calculates the chance that independent moving points all occupy the smaller volume. This is the gas calculation behind the counting exercise.",
  },
  "mass-energy": {
    id: "eq-s0-d2",
    description:
      "Einstein writes two energy accounts in succession. The first balances the body's energy and the two light emissions in its rest frame. The next does the same in the moving frame.",
  },
} as const satisfies Partial<Record<PaperSlug, { id: string; description: string }>>;

export function EntranceSourcePassage({ paper }: { paper: keyof typeof PASSAGES }) {
  const { id, description } = PASSAGES[paper];
  const base = `/papers/${paper}/view/`;
  return (
    <section aria-label="The passage in Einstein’s paper">
      <h3>The passage in Einstein’s paper</h3>
      <p>{description}</p>
      <p>
        <a href={`${base}german/#${id}`}>Read the German original</a>
        {" · "}
        <a href={`${base}english/#${id}`}>Read the English translation</a>
      </p>
    </section>
  );
}
