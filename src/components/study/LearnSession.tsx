"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Concept, Subject } from "@/lib/types";
import { useStore } from "@/lib/store";
import { buildQuiz, shuffleChoices, statFor } from "@/lib/adaptive";
import { XP } from "@/lib/xp";
import { SessionFrame, SessionSummary, useSessionTracker } from "./SessionFrame";
import { QuestionCard, type QuizItem } from "./QuestionCard";
import { GuideSectionView } from "../subjects/GuideTab";
import { Button } from "../ui/Button";
import { Chip, EmptyState } from "../ui/Card";
import { Icon } from "../ui/Icon";

const QUESTIONS_PER_CONCEPT = 3;

function pickConcepts(subject: Subject, focus: string[]): Concept[] {
  const kit = subject.kit!;
  if (focus.length) return kit.concepts.filter((c) => focus.includes(c.id));
  // Unpracticed first (in guide order), then weakest.
  const unseen = kit.concepts.filter((c) => !statFor(subject, c.id).attempts);
  const rest = [...kit.concepts].filter((c) => !unseen.includes(c)).sort((a, b) => statFor(subject, a.id).mastery - statFor(subject, b.id).mastery);
  return [...unseen, ...rest].slice(0, 2);
}

export function LearnSession({ subject, focus }: { subject: Subject; focus: string[] }) {
  const router = useRouter();
  const readGuide = useStore((s) => s.readGuideSection);
  const completeLearn = useStore((s) => s.completeLearn);
  const setCtx = useStore((s) => s.setAssistantContext);
  const openAssistant = useStore((s) => s.openAssistant);
  const playerXp = useStore((s) => s.player.xp);
  const { finish, summary, startMastery, progressRef, startXp } = useSessionTracker(subject.id, "learn");

  const [concepts] = useState(() => pickConcepts(subject, focus));
  const [ci, setCi] = useState(0);
  const [phase, setPhase] = useState<"teach" | "test">("teach");
  const [questions, setQuestions] = useState<QuizItem[]>([]);
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const concept = concepts[ci];
  const kit = subject.kit!;
  const sections = concept ? kit.guide.filter((g) => g.conceptId === concept.id) : [];
  const defs = concept ? kit.definitions.filter((d) => d.conceptId === concept.id) : [];

  useEffect(() => {
    if (concept && phase === "teach") {
      setCtx(subject.id, `Learning concept: ${concept.name}. ${concept.summary}`);
    }
  }, [concept, phase, subject.id, setCtx]);

  if (!concepts.length) return <EmptyState title="Nothing to learn yet" body="Generate a study kit first." />;
  if (summary) return <SessionSummary subject={subject} mode="learn" summary={summary} startMastery={startMastery} touched={concepts.map((c) => c.id)} />;

  const nextConcept = () => {
    completeLearn(subject.id, concept.id);
    progressRef.current = { ...progressRef.current, any: true };
    if (ci + 1 >= concepts.length) {
      finish(score.correct, score.total);
    } else {
      setCi(ci + 1);
      setPhase("teach");
      setQi(0);
    }
  };

  const startTest = () => {
    sections.forEach((s) => readGuide(subject.id, s.id));
    const fresh = useStore.getState().subjects.find((s) => s.id === subject.id) ?? subject;
    const qs = buildQuiz(fresh, { count: QUESTIONS_PER_CONCEPT, focusConcepts: [concept.id] }).filter((q) => q.conceptId === concept.id);
    const items: QuizItem[] = qs.map((q) => ({ kind: "mcq", q: shuffleChoices(q) }));
    if (items.length < QUESTIONS_PER_CONCEPT) {
      const sa = kit.shortAnswers.find((s) => s.conceptId === concept.id);
      if (sa) items.push({ kind: "short", q: sa });
    }
    if (!items.length) {
      nextConcept();
      return;
    }
    setQuestions(items);
    setQi(0);
    setPhase("test");
  };

  const steps = concepts.length * (1 + QUESTIONS_PER_CONCEPT);
  const done = ci * (1 + QUESTIONS_PER_CONCEPT) + (phase === "test" ? 1 + qi : 0);

  return (
    <SessionFrame
      subject={subject}
      mode="learn"
      progress={done / steps}
      counter={`Concept ${ci + 1} / ${concepts.length}`}
      xp={playerXp - startXp}
      onEnd={() => (progressRef.current.any || score.total ? finish(score.correct, score.total) : router.back())}
    >
      <AnimatePresence mode="wait">
        {phase === "teach" ? (
          <motion.div key={`teach-${concept.id}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="mb-4 flex items-center gap-2">
              <Chip active>
                <Icon name="book" size={10} /> Learn
              </Chip>
              <Chip>Step 1 of 2</Chip>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight">{concept.name}</h2>
            <p className="mt-2 text-muted">{concept.summary}</p>

            <div className="mt-8 flex flex-col gap-6">
              {sections.length ? (
                sections.map((s) => (
                  <div key={s.id} className="rounded-3xl border border-line bg-surface p-6">
                    {sections.length > 1 && <h3 className="mb-3 text-lg font-semibold">{s.title}</h3>}
                    <GuideSectionView section={s} />
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-line bg-surface p-6 text-sm text-muted">No guide section for this concept yet — try asking the AI to explain it.</div>
              )}
              {defs.length > 0 && (
                <div className="rounded-3xl border border-line bg-surface p-6">
                  <p className="label mb-3">Key terms</p>
                  <dl className="flex flex-col gap-3">
                    {defs.map((d) => (
                      <div key={d.id}>
                        <dt className="text-sm font-medium">{d.term}</dt>
                        <dd className="text-sm text-muted">{d.definition}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </div>

            <div className="sticky bottom-4 mt-8 flex flex-col gap-3 rounded-3xl border border-line-strong bg-surface/95 p-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                icon="spark"
                onClick={() => openAssistant({ subjectId: subject.id, draft: `Explain ${concept.name} like I'm completely new to it.` })}
              >
                Explain it differently
              </Button>
              <Button size="lg" iconRight="arrow" onClick={startTest}>
                I&apos;m ready — test me · +{XP.learnConcept} XP
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key={`test-${concept.id}-${qi}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
            <div className="mb-4 flex items-center gap-2">
              <Chip active>
                <Icon name="target" size={10} /> Test
              </Chip>
              <Chip>
                Question {qi + 1} of {questions.length}
              </Chip>
            </div>
            <QuestionCard
              item={questions[qi]}
              subject={subject}
              onAnswered={(r) => {
                progressRef.current = { any: true, correct: score.correct + (r.isCorrect ? 1 : 0), total: score.total + 1 };
                setScore((s) => ({ correct: s.correct + (r.isCorrect ? 1 : 0), total: s.total + 1 }));
              }}
              onNext={() => (qi + 1 >= questions.length ? nextConcept() : setQi(qi + 1))}
              nextLabel={qi + 1 >= questions.length ? (ci + 1 >= concepts.length ? "Finish" : "Next concept") : "Next"}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </SessionFrame>
  );
}
