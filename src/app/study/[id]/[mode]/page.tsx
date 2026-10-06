"use client";

import { Suspense, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useStore, useSubject } from "@/lib/store";
import { EmptyState } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { FlashcardSession } from "@/components/study/FlashcardSession";
import { QuizSession } from "@/components/study/QuizSession";
import { LearnSession } from "@/components/study/LearnSession";

function SessionInner() {
  const { id, mode } = useParams<{ id: string; mode: string }>();
  const params = useSearchParams();
  const subject = useSubject(id);
  const setCtx = useStore((s) => s.setAssistantContext);
  const focus = (params.get("focus") ?? "").split(",").filter(Boolean);

  useEffect(() => {
    if (subject) setCtx(subject.id, null);
    return () => setCtx(subject?.id ?? null, null);
  }, [subject?.id, setCtx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!subject) {
    return <EmptyState title="Subject not found" action={<LinkButton href="/study" variant="outline" icon="back">Back</LinkButton>} />;
  }
  if (!subject.kit) {
    return (
      <EmptyState
        title="No study kit yet"
        body="Add material and generate a kit to start studying."
        action={<LinkButton href={`/subjects/${subject.id}?tab=materials`}>Add material</LinkButton>}
      />
    );
  }

  // Key on the params so navigating between sessions remounts cleanly.
  const key = `${subject.id}-${mode}-${focus.join(",")}`;
  switch (mode) {
    case "flashcards":
      return <FlashcardSession key={key} subject={subject} focus={focus} />;
    case "learn":
      return <LearnSession key={key} subject={subject} focus={focus} />;
    case "quiz":
    case "review":
    case "challenge":
      return <QuizSession key={key} subject={subject} mode={mode} focus={focus} />;
    default:
      return <EmptyState title="Unknown study mode" action={<LinkButton href="/study" variant="outline">Choose a mode</LinkButton>} />;
  }
}

export default function SessionPage() {
  return (
    <Suspense>
      <SessionInner />
    </Suspense>
  );
}
