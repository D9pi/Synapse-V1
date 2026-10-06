import type { Player, SessionRecord, Subject } from "./types";
import { statFor, subjectMastery, weakestConcepts } from "./adaptive";
import { playerLevel, subjectLevel } from "./levels";
import { regionById } from "./regions";
import { formatDuration, timeAgo } from "./utils";

const MAX = 60_000;

/** Serializes everything the tutor needs to personalize answers. */
export function buildAssistantContext(opts: {
  subject: Subject | null;
  subjects: Subject[];
  player: Player;
  sessions: SessionRecord[];
  focus: string | null;
}): string {
  const { subject, subjects, player, sessions, focus } = opts;
  const lines: string[] = [];
  const pl = playerLevel(player.xp);
  lines.push(
    `Student: level ${pl.level}, ${player.xp} XP, ${player.streak}-day streak, ${formatDuration(player.totalStudyMs)} total study time.`,
  );

  if (focus) {
    lines.push("", "## What the student is looking at right now", focus);
  }

  if (!subject) {
    lines.push("", "## All subjects");
    if (!subjects.length) lines.push("(none yet — the student hasn't added any material)");
    for (const s of subjects) {
      const weak = weakestConcepts(s, 3)
        .map((w) => `${w.concept.name} ${Math.round(w.stat.mastery)}%`)
        .join(", ");
      lines.push(
        `- ${s.name} (level ${subjectLevel(s.xp).level}, mastery ${subjectMastery(s)}%, last studied ${timeAgo(s.lastStudied)}, ${s.mistakes.filter((m) => !m.resolved).length} open mistakes)${weak ? ` — weakest: ${weak}` : ""}${s.kit ? "" : " — no study kit yet"}`,
      );
    }
    return lines.join("\n").slice(0, MAX);
  }

  const s = subject;
  lines.push(
    "",
    `## Current course: ${s.name}`,
    `Brain region (game mechanic): ${regionById(s.region).name}. Subject level ${subjectLevel(s.xp).level}, overall mastery ${subjectMastery(s)}%.`,
  );
  const kit = s.kit;
  if (!kit) {
    lines.push("No study kit generated yet. Materials:");
    for (const m of s.materials) lines.push(`### ${m.title}\n${m.text.slice(0, 8000)}`);
    return lines.join("\n").slice(0, MAX);
  }
  lines.push(kit.summary);

  lines.push("", "## Concept mastery (weakest first)");
  for (const w of weakestConcepts(s, kit.concepts.length)) {
    const st = statFor(s, w.concept.id);
    lines.push(
      `- ${w.concept.name}: ${Math.round(st.mastery)}% mastery, ${st.correct}/${st.attempts} correct${st.attempts === 0 ? " (not practiced yet)" : ""}`,
    );
  }

  const mistakes = s.mistakes.filter((m) => !m.resolved).slice(0, 12);
  if (mistakes.length) {
    lines.push("", "## Recent incorrect answers");
    for (const m of mistakes) {
      const concept = kit.concepts.find((c) => c.id === m.conceptId)?.name ?? "";
      lines.push(`- [${concept}] Q: ${m.question.replace(/\n/g, " ")} | Student answered: ${m.given || "(blank)"} | Correct: ${m.correct}`);
    }
  }

  const recent = sessions.filter((x) => x.subjectId === s.id).slice(0, 8);
  if (recent.length) {
    lines.push("", "## Recent sessions");
    for (const r of recent) {
      lines.push(`- ${r.mode}, ${timeAgo(r.startedAt)}, ${r.total ? `${r.correct}/${r.total} correct, ` : ""}${formatDuration(r.durationMs)}`);
    }
  }

  lines.push("", "## Study guide");
  for (const g of kit.guide) {
    lines.push(`### ${g.title}`, g.overview);
    if (g.keyPoints.length) lines.push(...g.keyPoints.map((p) => `- ${p}`));
    if (g.formulas.length) lines.push(...g.formulas.map((f) => `- Formula: ${f.expression} (${f.meaning})`));
    if (g.steps.length) lines.push(...g.steps.map((p, i) => `${i + 1}. ${p}`));
    if (g.example) lines.push(`Example: ${g.example.problem} → ${g.example.solution}`);
    if (g.commonMistakes.length) lines.push(`Common mistakes: ${g.commonMistakes.join("; ")}`);
  }

  if (kit.definitions.length) {
    lines.push("", "## Definitions");
    for (const d of kit.definitions.slice(0, 60)) lines.push(`- ${d.term}: ${d.definition}`);
  }
  lines.push("", "## Flashcards (sample)");
  for (const c of kit.flashcards.slice(0, 40)) {
    lines.push(`- ${c.front} → ${c.back}${s.cardStatus[c.id] === "learning" ? " [still learning]" : ""}`);
  }
  return lines.join("\n").slice(0, MAX);
}

/** Compact material context for generating extra questions. */
export function kitDigest(s: Subject): string {
  const kit = s.kit;
  if (!kit) return s.materials.map((m) => m.text).join("\n\n").slice(0, 40_000);
  return kit.guide
    .map((g) => [`## ${g.title}`, g.overview, ...g.keyPoints, ...g.formulas.map((f) => f.expression), ...g.steps].join("\n"))
    .join("\n\n")
    .slice(0, 40_000);
}
