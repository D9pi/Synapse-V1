"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { MCQ, Subject } from "@/lib/types";
import { useStore } from "@/lib/store";
import { buildQuiz, followUpFor, shuffleChoices, statFor, weakestConcepts } from "@/lib/adaptive";
import { api } from "@/lib/client-api";
import { kitDigest } from "@/lib/context";
import { shuffle } from "@/lib/utils";
import { SessionFrame, SessionSummary, useSessionTracker } from "./SessionFrame";
import { QuestionCard, type QuizItem } from "./QuestionCard";
import { EmptyState } from "../ui/Card";
import { LinkButton, Spinner } from "../ui/Button";
import { useAI } from "../shell/Providers";

type Mode = "quiz" | "review" | "challenge";
const LENGTH = 10;
const MAX_LENGTH = 15;

function initialItems(subject: Subject, mode: Mode, focus: string[]): QuizItem[] {
  const kit = subject.kit!;
  if (mode === "review") {
    const open = subject.mistakes.filter((m) => !m.resolved);
    const items: QuizItem[] = [];
    for (const m of open) {
      const mcq = kit.mcqs.find((q) => q.id === m.itemId);
      const sa = kit.shortAnswers.find((q) => q.id === m.itemId);
      if (mcq) items.push({ kind: "mcq", q: shuffleChoices(mcq) });
      else if (sa) items.push({ kind: "short", q: sa });
      if (items.length >= MAX_LENGTH) break;
    }
    // Pad short reviews with fresh questions on the same weak concepts.
    if (items.length && items.length < 5) {
      const concepts = Array.from(new Set(open.map((m) => m.conceptId)));
      const extra = buildQuiz(subject, { count: 5 - items.length, focusConcepts: concepts }).filter((q) => !items.some((i) => i.q.id === q.id));
      items.push(...extra.map((q) => ({ kind: "mcq" as const, q: shuffleChoices(q) })));
    }
    return items;
  }
  if (mode === "challenge") {
    return buildQuiz(subject, { count: LENGTH, minDifficulty: "hard", focusConcepts: focus }).map((q) => ({ kind: "mcq", q: shuffleChoices(q) }));
  }
  const mcqs = buildQuiz(subject, { count: LENGTH - 2, focusConcepts: focus });
  const items: QuizItem[] = mcqs.map((q) => ({ kind: "mcq", q: shuffleChoices(q) }));
  // Mix in short-answer questions on weak concepts.
  const weakIds = focus.length ? focus : weakestConcepts(subject, 3).map((w) => w.concept.id);
  const shorts = shuffle(kit.shortAnswers.filter((s) => weakIds.includes(s.conceptId))).slice(0, 2);
  const fill = shorts.length < 2 ? shuffle(kit.shortAnswers).slice(0, 2 - shorts.length) : [];
  for (const s of [...shorts, ...fill]) {
    const at = Math.min(items.length, 3 + Math.floor(Math.random() * Math.max(1, items.length - 3)));
    items.splice(at, 0, { kind: "short", q: s });
  }
  if (items.length < LENGTH) {
    const more = buildQuiz(subject, { count: LENGTH - items.length, pool: kit.mcqs.filter((q) => !items.some((i) => i.q.id === q.id)) });
    items.push(...more.map((q) => ({ kind: "mcq" as const, q: shuffleChoices(q) })));
  }
  return items;
}

export function QuizSession({ subject, mode, focus }: { subject: Subject; mode: Mode; focus: string[] }) {
  const router = useRouter();
  const { ai, checked } = useAI();
  const editKit = useStore((s) => s.editKit);
  const playerXp = useStore((s) => s.player.xp);
  const { finish, summary, startMastery, progressRef, startXp } = useSessionTracker(subject.id, mode);

  const [items, setItems] = useState<QuizItem[]>(() => initialItems(subject, mode, focus));
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const loadingAI = mode === "challenge" && (!checked || (ai && !fetched));
  const [aiError, setAiError] = useState<string | null>(null);
  const requested = useRef(false);

  // Challenge mode: ask the AI for fresh, harder questions targeted at weak concepts.
  useEffect(() => {
    if (mode !== "challenge" || !checked || !ai || requested.current) return;
    requested.current = true;
    const weak = focus.length
      ? subject.kit!.concepts.filter((c) => focus.includes(c.id))
      : weakestConcepts(subject, 4).map((w) => w.concept);
    api
      .questions({
        subjectName: subject.name,
        context: kitDigest(subject),
        concepts: weak.map((c) => ({ id: c.id, name: c.name, mastery: statFor(subject, c.id).mastery })),
        difficulty: "hard",
        count: 6,
        avoid: subject.kit!.mcqs.map((q) => q.question),
      })
      .then(({ mcqs }) => {
        if (!mcqs.length) return;
        // Persist so they can be reviewed later.
        editKit(subject.id, (k) => ({ ...k, mcqs: [...k.mcqs, ...mcqs] }));
        setItems((cur) => {
          const fresh: QuizItem[] = mcqs.map((q: MCQ) => ({ kind: "mcq", q: shuffleChoices(q) }));
          return [...fresh, ...cur].slice(0, LENGTH);
        });
      })
      .catch((err: Error) => setAiError(err.message))
      .finally(() => setFetched(true));
  }, [mode, ai, checked, focus, subject, editKit]);

  const touched = useMemo(() => Array.from(new Set(items.map((i) => i.q.conceptId))), [items]);
  const correct = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  const onAnswered = (r: { isCorrect: boolean }, item: QuizItem) => {
    const key = `${idx}:${item.q.id}`;
    setResults((prev) => ({ ...prev, [key]: r.isCorrect }));
    progressRef.current = {
      any: true,
      correct: Object.values({ ...results, [key]: r.isCorrect }).filter(Boolean).length,
      total: Object.keys({ ...results, [key]: r.isCorrect }).length,
    };
    setNote(null);
    // Adaptive: a missed concept earns a follow-up question later in the session.
    if (!r.isCorrect && item.kind === "mcq" && items.length < MAX_LENGTH && mode !== "review") {
      const fresh = useStore.getState().subjects.find((s) => s.id === subject.id) ?? subject;
      const queued = items.map((i) => i.q).filter((q): q is MCQ => "choices" in q);
      const follow = followUpFor(fresh, item.q, queued);
      if (follow) {
        const at = Math.min(items.length, idx + 3);
        setItems((cur) => [...cur.slice(0, at), { kind: "mcq", q: shuffleChoices(follow) }, ...cur.slice(at)]);
        const name = subject.kit?.concepts.find((c) => c.id === item.q.conceptId)?.name;
        setNote(`Added another question on ${name ?? "this concept"} to reinforce it.`);
      }
    }
  };

  const next = () => {
    setNote(null);
    if (idx + 1 >= items.length) {
      finish(correct, total, { quiz: true });
    } else {
      setIdx(idx + 1);
    }
  };

  if (loadingAI) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <Spinner size={22} />
        <p className="text-sm">Generating harder questions on your weak spots…</p>
        <p className="text-xs text-muted">Challenge answers are worth double XP.</p>
      </div>
    );
  }

  if (!items.length) {
    return mode === "review" ? (
      <EmptyState
        title="Nothing to review"
        body="You have no open mistakes in this subject. Take a quiz — anything you miss will show up here."
        action={<LinkButton href={`/study/${subject.id}/quiz`} icon="bolt">Take a quiz</LinkButton>}
      />
    ) : (
      <EmptyState title="No questions available" body="Generate a study kit first, or add questions in the Questions tab." action={<LinkButton href={`/subjects/${subject.id}?tab=questions`} variant="outline">Open questions</LinkButton>} />
    );
  }

  if (summary) {
    return <SessionSummary subject={subject} mode={mode} summary={summary} startMastery={startMastery} touched={touched} />;
  }

  const item = items[idx];

  return (
    <SessionFrame
      subject={subject}
      mode={mode}
      progress={idx / items.length}
      counter={`${idx + 1} / ${items.length}`}
      xp={playerXp - startXp}
      onEnd={() => (total > 0 ? finish(correct, total, { quiz: total >= 5 }) : router.back())}
    >
      {aiError && idx === 0 && <p className="mb-4 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">Couldn&apos;t generate new AI questions ({aiError}). Using your hardest existing questions.</p>}
      <AnimatePresence mode="wait">
        <motion.div key={`${idx}-${item.q.id}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>
          <QuestionCard
            item={item}
            subject={subject}
            challenge={mode === "challenge"}
            onAnswered={onAnswered}
            onNext={next}
            nextLabel={idx + 1 >= items.length ? "Finish" : "Next"}
            note={note}
          />
        </motion.div>
      </AnimatePresence>
    </SessionFrame>
  );
}
