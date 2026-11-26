import type { ArgumentStep } from "./massEnergyArgument.ts";

const sourceLabels = {
  source: "In the paper",
  reconstruction: "Source for this reconstruction",
  modern: "Modern comparison with the paper",
} as const;

export function MassEnergyStepSource({ card }: { card: ArgumentStep }) {
  return (
    <p className="fine">
      {sourceLabels[card.source.kind]}{" · "}
      <a href={`/papers/mass-energy/view/english/#${card.source.anchor}`}>{card.source.label}</a>
      {card.id === "light-transform" && (
        <>
          {" · "}
          <a href="/papers/special-relativity/view/english/#eq-s8-d4">
            The original calculation in relativity §8
          </a>
        </>
      )}
    </p>
  );
}
