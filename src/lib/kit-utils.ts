import type { Material, StudyKit, Subject } from "./types";
import { parseFlashcards } from "./offline";
import { normalize, uid } from "./utils";

const KIND_LABEL: Record<Material["kind"], string> = {
  notes: "Class notes",
  flashcards: "Existing flashcards (term → definition)",
  topics: "Topics the student needs to study",
  document: "Document / textbook text",
};

export function combineMaterials(materials: Material[]): string {
  return materials.map((m) => `## ${KIND_LABEL[m.kind]}: ${m.title}\n${m.text.trim()}`).join("\n\n");
}

/** Text for the offline generator: flashcard lists become "term: definition" lines it understands. */
export function combineForOffline(materials: Material[]): string {
  return materials
    .map((m) => {
      if (m.kind === "flashcards") {
        return `# ${m.title}\n` + parseFlashcards(m.text).map((c) => `- ${c.front}: ${c.back}`).join("\n");
      }
      if (m.kind === "topics") return `# ${m.title}\n${m.text}`;
      return m.text.trim().match(/^#|^[A-Z][^\n]{0,60}\n/) ? m.text : `# ${m.title}\n${m.text}`;
    })
    .join("\n\n");
}

/**
 * Makes a regenerated kit continuous with the previous one: concepts with the same name keep
 * their ids (so mastery carries over) and imported flashcards are always present.
 */
export function reconcileKit(subject: Subject, kit: StudyKit): StudyKit {
  const idMap = new Map<string, string>();
  const old = subject.kit?.concepts ?? [];
  for (const c of kit.concepts) {
    const match = old.find((o) => normalize(o.name) === normalize(c.name));
    if (match) idMap.set(c.id, match.id);
  }
  const fix = (id: string) => idMap.get(id) ?? id;
  const next: StudyKit = {
    ...kit,
    concepts: kit.concepts.map((c) => ({ ...c, id: fix(c.id) })),
    guide: kit.guide.map((x) => ({ ...x, conceptId: fix(x.conceptId) })),
    definitions: kit.definitions.map((x) => ({ ...x, conceptId: fix(x.conceptId) })),
    formulas: kit.formulas.map((x) => ({ ...x, conceptId: fix(x.conceptId) })),
    flashcards: kit.flashcards.map((x) => ({ ...x, conceptId: fix(x.conceptId) })),
    mcqs: kit.mcqs.map((x) => ({ ...x, conceptId: fix(x.conceptId) })),
    shortAnswers: kit.shortAnswers.map((x) => ({ ...x, conceptId: fix(x.conceptId) })),
    problems: kit.problems.map((x) => ({ ...x, conceptId: fix(x.conceptId) })),
  };

  // Guarantee every imported flashcard exists in the deck.
  const imported = subject.materials.filter((m) => m.kind === "flashcards").flatMap((m) => parseFlashcards(m.text));
  if (imported.length) {
    const have = new Set(next.flashcards.map((c) => normalize(c.front)));
    const fallbackConcept = next.concepts[0]?.id;
    for (const c of imported) {
      if (have.has(normalize(c.front)) || !fallbackConcept) continue;
      const def = next.definitions.find((d) => normalize(d.term) === normalize(c.front));
      next.flashcards.push({ id: uid("card"), front: c.front, back: c.back, conceptId: def?.conceptId ?? fallbackConcept });
      have.add(normalize(c.front));
    }
  }
  return next;
}
