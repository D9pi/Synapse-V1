"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { MCQ, ShortAnswer, Subject } from "@/lib/types";
import { useStore } from "@/lib/store";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Button } from "../ui/Button";
import { Textarea } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { Chip } from "../ui/Card";

export type QuizItem = { kind: "mcq"; q: MCQ } | { kind: "short"; q: ShortAnswer };

export interface AnswerResult {
  isCorrect: boolean;
  xp: number;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuestionCard({
  item,
  subject,
  challenge,
  onAnswered,
  onNext,
  nextLabel = "Next",
  note,
}: {
  item: QuizItem;
  subject: Subject;
  challenge?: boolean;
  onAnswered: (r: AnswerResult, item: QuizItem) => void;
  onNext: () => void;
  nextLabel?: string;
  note?: string | null;
}) {
  const recordAnswer = useStore((s) => s.recordAnswer);
  const openAssistant = useStore((s) => s.openAssistant);
  const setCtx = useStore((s) => s.setAssistantContext);
  const [picked, setPicked] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<{ verdict: "correct" | "partial" | "incorrect"; feedback: string } | null>(null);
  const [overridden, setOverridden] = useState(false);
  const [xp, setXp] = useState<number | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const concept = subject.kit?.concepts.find((c) => c.id === item.q.conceptId);
  const answered = item.kind === "mcq" ? picked !== null : grade !== null;

  // Keep the assistant aware of what's on screen.
  useEffect(() => {
    const q = item.q;
    const focus =
      item.kind === "mcq"
        ? `Question (${concept?.name ?? "concept"}): ${item.q.question}\nChoices: ${item.q.choices.map((c, i) => `${LETTERS[i]}) ${c}`).join("  ")}${
            picked !== null
              ? `\nStudent chose: ${item.q.choices[picked]}. Correct answer: ${item.q.choices[item.q.answerIndex]}. Explanation: ${item.q.explanation}`
              : "\n(The student has not answered yet — don't reveal the answer unless asked.)"
          }`
        : `Short-answer question (${concept?.name ?? "concept"}): ${q.question}${grade ? `\nStudent answered: ${text}\nModel answer: ${(q as ShortAnswer).answer}` : "\n(Not answered yet — don't reveal the answer unless asked.)"}`;
    setCtx(subject.id, focus);
  }, [item, picked, grade, text, concept?.name, subject.id, setCtx]);

  const commit = (isCorrect: boolean, given: string, correctAnswer: string) => {
    const gained = recordAnswer(subject.id, {
      itemId: item.q.id,
      conceptId: item.q.conceptId,
      question: item.q.question,
      given,
      correctAnswer,
      isCorrect,
      challenge,
      difficulty: item.q.difficulty,
    });
    setXp(gained);
    onAnswered({ isCorrect, xp: gained }, item);
    setTimeout(() => nextRef.current?.focus(), 50);
  };

  const pick = (i: number) => {
    if (item.kind !== "mcq" || picked !== null) return;
    setPicked(i);
    commit(i === item.q.answerIndex, item.q.choices[i], item.q.choices[item.q.answerIndex]);
  };

  const submitShort = async () => {
    if (item.kind !== "short" || grading || grade) return;
    setGrading(true);
    try {
      const g = await api.grade(item.q.question, item.q.answer, text);
      setGrade(g);
      commit(g.verdict === "correct", text, item.q.answer);
    } catch {
      const g = { verdict: "incorrect" as const, feedback: "Couldn't grade automatically — compare with the model answer." };
      setGrade(g);
      commit(false, text, item.q.answer);
    } finally {
      setGrading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      if (item.kind === "mcq" && picked === null) {
        const n = Number(e.key);
        if (n >= 1 && n <= item.q.choices.length) pick(n - 1);
      } else if (answered && e.key === "Enter" && document.activeElement?.tagName !== "BUTTON") {
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const wrong = answered && (item.kind === "mcq" ? picked !== item.q.answerIndex : grade?.verdict !== "correct" && !overridden);

  const askWhy = () =>
    openAssistant({
      subjectId: subject.id,
      draft:
        item.kind === "mcq"
          ? `Why is "${item.q.choices[item.q.answerIndex]}" correct and not "${item.q.choices[picked ?? 0]}"? Explain the misconception.`
          : "Why was my answer to this short-answer question wrong or incomplete? What did I miss?",
    });

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {concept && <Chip>{concept.name}</Chip>}
        <Chip>{item.q.difficulty}</Chip>
        {challenge && (
          <Chip active>
            <Icon name="flame" size={10} /> 2× XP
          </Chip>
        )}
        {item.kind === "short" && <Chip>Short answer</Chip>}
      </div>
      <AnimatePresence>
        {note && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-center gap-2 text-xs text-muted">
            <Icon name="loop" size={12} /> {note}
          </motion.p>
        )}
      </AnimatePresence>
      <h2 className="whitespace-pre-line text-xl font-medium leading-snug tracking-tight sm:text-2xl">{item.q.question}</h2>

      {item.kind === "mcq" ? (
        <div className="mt-7 flex flex-col gap-2.5" role="radiogroup" aria-label="Answer choices">
          {item.q.choices.map((c, i) => {
            const isAnswer = i === item.q.answerIndex;
            const isPicked = i === picked;
            const state = picked === null ? "idle" : isAnswer ? "correct" : isPicked ? "wrong" : "dim";
            return (
              <motion.button
                key={i}
                role="radio"
                aria-checked={isPicked}
                disabled={picked !== null}
                onClick={() => pick(i)}
                animate={state === "wrong" ? { x: [0, -6, 6, -4, 4, 0] } : state === "correct" && isPicked ? { scale: [1, 1.015, 1] } : {}}
                transition={{ duration: 0.35 }}
                className={cn(
                  "group flex w-full items-center gap-4 rounded-2xl border px-4 py-3.5 text-left text-[15px] transition",
                  state === "idle" && "border-line bg-surface hover:border-line-strong hover:bg-surface-2",
                  state === "correct" && "border-fg bg-fg text-bg",
                  state === "wrong" && "border-line-strong bg-surface-2 text-muted line-through decoration-muted",
                  state === "dim" && "border-line text-faint",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-xs",
                    state === "correct" ? "border-bg/30" : "border-line-strong",
                  )}
                >
                  {state === "correct" ? <Icon name="check" size={14} /> : state === "wrong" ? <Icon name="x" size={14} /> : LETTERS[i]}
                </span>
                <span className="flex-1">{c}</span>
                {state === "idle" && <span className="hidden font-mono text-[10px] text-faint sm:block">{i + 1}</span>}
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="mt-7">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Type your answer in a sentence or two…"
            disabled={!!grade}
            aria-label="Your answer"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submitShort();
            }}
          />
          {!grade && (
            <div className="mt-3 flex items-center justify-between">
              <span className="font-mono text-[10px] text-faint">⌘/Ctrl + Enter</span>
              <Button onClick={submitShort} loading={grading} disabled={!text.trim()}>
                {grading ? "Grading…" : "Submit"}
              </Button>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {answered && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {wrong ? (
                  <>
                    <Icon name="x" size={16} /> {item.kind === "short" && grade?.verdict === "partial" ? "Partially correct" : "Not quite"}
                  </>
                ) : (
                  <>
                    <Icon name="check" size={16} /> Correct
                  </>
                )}
              </p>
              {xp !== null && <span className="num font-mono text-xs text-muted">+{xp} XP</span>}
            </div>
            {item.kind === "mcq" ? (
              item.q.explanation && <p className="mt-2 text-sm leading-relaxed text-muted">{item.q.explanation}</p>
            ) : (
              <>
                <p className="mt-2 text-sm leading-relaxed text-muted">{grade?.feedback}</p>
                <div className="mt-3 rounded-xl bg-surface-2 p-3">
                  <p className="label mb-1">Model answer</p>
                  <p className="text-sm">{item.q.answer}</p>
                </div>
                {grade?.verdict !== "correct" && !overridden && (
                  <button
                    onClick={() => {
                      setOverridden(true);
                      commit(true, text, item.q.answer);
                    }}
                    className="mt-3 text-xs text-muted underline underline-offset-4 hover:text-fg"
                  >
                    I was right — count it
                  </button>
                )}
              </>
            )}
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              {wrong ? (
                <Button variant="ghost" size="sm" icon="spark" onClick={askWhy}>
                  Why did I get this wrong?
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="spark"
                  onClick={() => openAssistant({ subjectId: subject.id, draft: "Give me a harder version of this question." })}
                >
                  Harder version
                </Button>
              )}
              <Button ref={nextRef} onClick={onNext} iconRight="arrow">
                {nextLabel}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
