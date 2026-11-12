import type { FizeauRecord } from "../../experiments/shelfOptics/fizeau.ts";
import type { ShelfReport } from "../../experiments/shelfOptics/state.ts";
import { Formula } from "../edition/Formula.tsx";
import { ShelfOpticsLab } from "../lab/shelfOptics/ShelfOpticsLab.tsx";
import "../lab/shelfOptics/shelfOptics.css";

/** Pre-1905 evidence has its own date label: it must not inherit “measured later” chrome. */
export function FizeauWorldCheck({
  record,
  example,
}: {
  record: FizeauRecord;
  example: ShelfReport;
}) {
  return (
    <section
      id="sr-world-check-fizeau"
      data-world-check-id="sr-world-check-fizeau"
      data-comparison-kind={record.kind === "plottable" ? "measured-fact" : undefined}
      aria-label="Compare the moving-water prediction with Fizeau's observations"
    >
      <p className="eyebrow">Check it against the world · evidence available before 1905</p>
      <h3>A measured fringe shift, before the new kinematics</h3>
      <p>
        Put no drag, complete drag and Fresnel’s partial drag beside the displacements Fizeau
        actually printed. The observations stay fixed while you change the model settings. His
        experiment was presented in 1851; the full table used here was published in 1859. The later
        explanation by velocity addition is available as a separate comparison in the settings.
      </p>
      <ShelfOpticsLab
        example={example}
        fizeau={record}
        laterEquation={<Formula latex={String.raw`u_{\mathrm{rel}}=\frac{c/n+v}{1+v/(nc)}`} />}
      />
      <p>
        <a href="/lab/sr-06/">Follow the velocity-addition argument in §5</a>
        {" · "}
        <a href="/lab/shelf-fizeau/">Open this measured comparison on its own</a>
      </p>
    </section>
  );
}
