import type { ReactNode } from "react";
import type { CheckpointLaunchCatalogue } from "../../../experiments/permalink/checkpointLaunches.ts";
import checkpointLinks from "../../../generated/checkpoint-links.json";

/**
 * Public build-time links only: no session, evaluator or private notebook enters this route.
 * Keep the existing readable walkthrough inline, without a Suspense boundary or client wrapper.
 */
export default async function WalkthroughLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ tape: string }> }>) {
  const { tape: tapeId } = await params;
  const walkthrough = (checkpointLinks as CheckpointLaunchCatalogue).walkthroughs.find(
    (entry) => entry.tapeId === tapeId,
  );
  return (
    <>
      {walkthrough && walkthrough.stops.length > 0 && (
        <p className="reading">
          <a href="#walkthrough-checkpoint-launches">Open a recorded stop in the laboratory</a>
        </p>
      )}
      {children}
      {walkthrough && walkthrough.stops.length > 0 && (
        <nav className="reading" aria-labelledby="walkthrough-checkpoint-launches">
          <h2 id="walkthrough-checkpoint-launches">Try the recorded stops in the laboratory</h2>
          <p>
            Each available link opens {walkthrough.experimentId.toUpperCase()} with that stop's
            settings and selects its instructions. It uses the laboratory's current model; it does
            not reproduce the author's recorded run or verify the expected numbers above. Reading
            the instructions in the player does not change settings again.
          </p>
          <ol>
            {walkthrough.stops.map((stop, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a server-rendered list that never reorders; the index only disambiguates stops sharing an actionIndex
              <li key={`${stop.actionIndex}-${index}`}>
                <p>
                  <strong>{stop.label}</strong>
                </p>
                {stop.launch.status === "ready" ? (
                  <>
                    <a href={stop.launch.href}>
                      Open {walkthrough.experimentId.toUpperCase()} at this stop: {stop.label}
                    </a>
                    <p>
                      {stop.launch.kind === "form"
                        ? "The settings go into the form. Apply them in the laboratory to calculate."
                        : "The laboratory calculates with these settings when the link loads."}
                    </p>
                  </>
                ) : (
                  <p>
                    This stop has no settings link: {stop.launch.reason} Its instructions and
                    recorded values remain above.
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p>
            Loading settings needs JavaScript. Without it, the laboratory shows its static worked
            example.
          </p>
        </nav>
      )}
    </>
  );
}
