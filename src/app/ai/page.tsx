"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { subjectMastery } from "@/lib/adaptive";
import { Chat } from "@/components/assistant/Chat";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/utils";
import { useAI } from "@/components/shell/Providers";

export default function AIPage() {
  const subjects = useStore((s) => s.subjects);
  const sessions = useStore((s) => s.sessions);
  const subjectId = useStore((s) => s.assistantSubjectId);
  const setCtx = useStore((s) => s.setAssistantContext);
  const closeAssistant = useStore((s) => s.closeAssistant);
  const { ai, model } = useAI();
  const subject = subjects.find((s) => s.id === subjectId) ?? null;

  useEffect(() => {
    closeAssistant();
  }, [closeAssistant]);

  const sees = subject?.kit
    ? [
        ["Current course", subject.name],
        ["Study guide", `${subject.kit.guide.length} sections`],
        ["Flashcards", `${subject.kit.flashcards.length} cards`],
        ["Mastery levels", `${subject.kit.concepts.length} concepts`],
        ["Incorrect answers", `${subject.mistakes.filter((m) => !m.resolved).length} open`],
        ["Quiz history", `${sessions.filter((s) => s.subjectId === subject.id).length} sessions`],
      ]
    : [
        ["Subjects", `${subjects.length}`],
        ["Mastery levels", "All subjects"],
        ["Previous sessions", `${sessions.length}`],
      ];

  return (
    <div className="grid h-[calc(100vh_-_11rem_-_var(--tb))] gap-4 lg:h-[calc(100vh_-_5rem_-_var(--tb))] lg:grid-cols-[280px_1fr]">
      <aside className="hidden flex-col gap-4 lg:flex">
        <div>
          <p className="label mb-2">AI</p>
          <h1 className="text-3xl font-semibold tracking-tight">Synapse tutor</h1>
          <p className="mt-2 text-sm text-muted">Explanations, examples, and quizzes tailored to how you&apos;re actually doing.</p>
        </div>
        <div className="rounded-3xl border border-line bg-surface p-3">
          <p className="label px-2 pb-2 pt-1">Context</p>
          <button
            onClick={() => setCtx(null, null)}
            className={cn("flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition", !subjectId ? "bg-surface-3" : "text-muted hover:text-fg")}
          >
            All subjects
          </button>
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setCtx(s.id, null)}
              className={cn("flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition", subjectId === s.id ? "bg-surface-3" : "text-muted hover:text-fg")}
            >
              <span className="truncate">{s.name}</span>
              <span className="font-mono text-[10px] text-faint">{s.kit ? `${subjectMastery(s)}%` : "—"}</span>
            </button>
          ))}
        </div>
        <div className="rounded-3xl border border-line bg-surface p-5">
          <p className="label mb-3">What the tutor can see</p>
          <ul className="flex flex-col gap-2">
            {sees.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-2">
                  <Icon name="check" size={12} className="text-muted" /> {k}
                </span>
                <span className="truncate font-mono text-faint">{v}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 font-mono text-[10px] text-faint">
            <span className={cn("h-1.5 w-1.5 rounded-full", ai ? "bg-fg pulse-dot" : "bg-faint")} />
            {ai ? model : "offline"}
          </p>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-line bg-surface">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 lg:hidden">
          <span className="text-sm font-medium">Synapse tutor</span>
          <select
            value={subjectId ?? ""}
            onChange={(e) => setCtx(e.target.value || null, null)}
            aria-label="Context"
            className="h-8 rounded-full border border-line bg-surface-2 px-3 text-xs"
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </header>
        <Chat key={subjectId ?? "global"} subjectId={subjectId} className="flex-1" />
      </section>
    </div>
  );
}
