"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Flashcard, Subject } from "@/lib/types";
import { useStore } from "@/lib/store";
import { orderCards } from "@/lib/adaptive";
import { cn } from "@/lib/utils";
import { SessionFrame, SessionSummary, useSessionTracker } from "./SessionFrame";
import { Button } from "../ui/Button";
import { Chip, EmptyState } from "../ui/Card";
import { Icon } from "../ui/Icon";

const DECK_SIZE = 20;

const cardVariants = {
  enter: { opacity: 0, y: 24, scale: 0.97 },
  center: { opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 },
  exit: (d: number) => ({ opacity: 0, x: d * 120, rotate: d * 4, transition: { duration: 0.25 } }),
};

export function FlashcardSession({ subject, focus }: { subject: Subject; focus: string[] }) {
  const router = useRouter();
  const recordCard = useStore((s) => s.recordCard);
  const setCtx = useStore((s) => s.setAssistantContext);
  const playerXp = useStore((s) => s.player.xp);
  const { finish, summary, startMastery, progressRef, startXp } = useSessionTracker(subject.id, "flashcards");

  const [deck, setDeck] = useState<Flashcard[]>(() => {
    const all = subject.kit?.flashcards ?? [];
    const pool = focus.length ? all.filter((c) => focus.includes(c.conceptId)) : all;
    return orderCards(subject, pool.length ? pool : all).slice(0, DECK_SIZE);
  });
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [requeued, setRequeued] = useState<Set<string>>(new Set());
  const [tally, setTally] = useState({ known: 0, learning: 0 });
  const [dir, setDir] = useState(0);
  const touched = useMemo(() => Array.from(new Set(deck.map((c) => c.conceptId))), [deck]);

  const card = deck[idx];

  useEffect(() => {
    if (card) setCtx(subject.id, `Flashcard (${subject.kit?.concepts.find((c) => c.id === card.conceptId)?.name}): front "${card.front}" / back "${card.back}"`);
  }, [card, subject, setCtx]);

  const mark = (known: boolean) => {
    if (!card) return;
    recordCard(subject.id, card.id, card.conceptId, known);
    progressRef.current = { ...progressRef.current, any: true };
    setTally((t) => (known ? { ...t, known: t.known + 1 } : { ...t, learning: t.learning + 1 }));
    let nextDeck = deck;
    if (!known && !requeued.has(card.id)) {
      // Still learning: see it again at the end of this round.
      nextDeck = [...deck, card];
      setDeck(nextDeck);
      setRequeued(new Set(requeued).add(card.id));
    }
    setDir(known ? 1 : -1);
    setFlipped(false);
    if (idx + 1 >= nextDeck.length) {
      finish(0, 0);
    } else {
      setIdx(idx + 1);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (summary || !card) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight" || e.key === "2") mark(true);
      else if (e.key === "ArrowLeft" || e.key === "1") mark(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!deck.length) {
    return <EmptyState title="No flashcards yet" body="Generate a study kit or add cards first." />;
  }
  if (summary) {
    return <SessionSummary subject={subject} mode="flashcards" summary={{ ...summary, correct: tally.known, total: tally.known + tally.learning }} startMastery={startMastery} touched={touched} />;
  }

  const concept = subject.kit?.concepts.find((c) => c.id === card.conceptId);

  return (
    <SessionFrame
      subject={subject}
      mode="flashcards"
      progress={idx / deck.length}
      counter={`${idx + 1} / ${deck.length}`}
      xp={playerXp - startXp}
      onEnd={() => (progressRef.current.any ? finish(0, 0) : router.back())}
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-2">
          <Chip>
            <Icon name="check" size={10} /> {tally.known} known
          </Chip>
          <Chip>
            <Icon name="loop" size={10} /> {tally.learning} learning
          </Chip>
        </div>
        {concept && <span className="truncate pl-3 text-xs text-muted">{concept.name}</span>}
      </div>

      <AnimatePresence mode="popLayout" custom={dir}>
        <motion.div
          key={`${card.id}-${idx}`}
          custom={dir}
          variants={cardVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="flip-scene"
        >
          <button
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? "Show front" : "Flip card"}
            className={cn("flip-card relative block h-[340px] w-full sm:h-[380px]", flipped && "flipped")}
          >
            <div className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-[2rem] border border-line-strong bg-surface p-8 text-center">
              <span className="label absolute left-6 top-6">Term</span>
              <p className="max-h-full overflow-y-auto whitespace-pre-line text-2xl font-medium leading-snug tracking-tight sm:text-3xl">{card.front}</p>
              <span className="absolute bottom-6 font-mono text-[10px] text-faint">SPACE TO FLIP</span>
            </div>
            <div className="flip-face flip-back absolute inset-0 flex flex-col items-center justify-center rounded-[2rem] bg-invert p-8 text-center text-invert-fg">
              <span className="label absolute left-6 top-6 !text-invert-fg/50">Definition</span>
              <p className="max-h-full overflow-y-auto whitespace-pre-line text-lg leading-relaxed sm:text-xl">{card.back}</p>
            </div>
          </button>
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" onClick={() => mark(false)} icon="loop">
          Still learning
        </Button>
        <Button size="lg" onClick={() => mark(true)} icon="check">
          Know it
        </Button>
      </div>
      <p className="mt-4 text-center font-mono text-[10px] text-faint">← STILL LEARNING · KNOW IT →</p>
    </SessionFrame>
  );
}
