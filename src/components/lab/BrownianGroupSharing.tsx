"use client";

import { useEffect, useRef, useState } from "react";
import type { BrownianRadiusView } from "../../experiments/groups/brownianRadius.ts";
import {
  type BrownianGroupBundle,
  type BrownianGroupInputs,
  brownianGroupStateKey,
  captureBrownianGroup,
} from "../../experiments/groups/brownianTape.ts";
import { ShareControl } from "../../experiments/permalink/ShareControl.tsx";
import type { TapeGroupV3 } from "../../experiments/permalink/types.ts";

export type SavedBrownianRecording = Readonly<{
  bundle: BrownianGroupBundle;
  key: string;
  tape: TapeGroupV3;
}>;

/** Capture the complete displayed scientific pair without starting or repeating either owner. */
export function BrownianGroupSharing({
  inputs,
  bundle,
  view,
  ready,
  recorded,
  settingsAvailable,
}: {
  inputs: BrownianGroupInputs;
  bundle: BrownianGroupBundle;
  view: BrownianRadiusView;
  ready: boolean;
  recorded: SavedBrownianRecording | null;
  settingsAvailable: boolean;
}) {
  const [saved, setSaved] = useState<SavedBrownianRecording | null>(null);
  const savedRef = useRef<SavedBrownianRecording | null>(null);
  const [notice, setNotice] = useState("");
  const key = brownianGroupStateKey(view);

  useEffect(() => {
    let live = true;
    const existing = recorded?.bundle === bundle ? recorded : savedRef.current;
    if (key && existing?.bundle === bundle && existing.key === key) {
      savedRef.current = existing;
      setSaved(existing);
      setNotice("");
      return;
    }
    setNotice("Preparing the displayed scientific checkpoints…");
    void captureBrownianGroup(inputs, bundle, view).then(
      (captured) => {
        if (!live) return;
        if (captured.kind === "captured" && key) {
          const next = { bundle, key, tape: captured.tape };
          savedRef.current = next;
          setSaved(next);
          setNotice("");
        } else setNotice(captured.kind === "unavailable" ? captured.notice : "");
      },
      () => {
        if (live)
          setNotice("This scientific checkpoint could not be saved. The accepted results remain available.");
      },
    );
    return () => {
      live = false;
    };
  }, [inputs, bundle, view, key, recorded]);

  const tape = saved?.bundle === bundle && saved.key === key ? saved.tape : null;
  return (
    <section hidden={!ready} data-brownian-scientific-share>
      <h3>Share the verified scientific comparison</h3>
      <p className="fine">
        This record binds the tracer's complete trajectory checksum, exact seed and stream
        positions, and all accepted results from both instruments. Restoring verifies both
        independent owners before displaying the pair. It records the current accepted state;
        it does not invent a history of your controls.
      </p>
      {notice && <p className="fine" data-scientific-capture-notice>{notice}</p>}
      {tape && ready && <ShareControl tape={tape} />}
      {!tape && (
        <p className="fine">
          {settingsAvailable && "The settings link remains available above. "}
          A scientific recording needs a complete result from the pinned Brownian engine.
        </p>
      )}
    </section>
  );
}
