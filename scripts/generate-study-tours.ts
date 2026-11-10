/** The guide's client projection, generated from the same checked records as its static outline. */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadStudyTours } from "../src/discovery/tours/studyTours.ts";
import { studyGuide } from "../src/discovery/tours/studyTypes.ts";

const root = process.cwd();
const tours = await loadStudyTours(root);
const directory = join(root, "src/generated");
await mkdir(directory, { recursive: true });
await writeFile(join(directory, "study-tours.json"), `${JSON.stringify(tours.map(studyGuide))}\n`);
console.log(`Prepared ${tours.length} study guides from their checked course records.`);
