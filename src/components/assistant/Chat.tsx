"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { buildAssistantContext } from "@/lib/context";
import { streamAssistant } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Markdown } from "../ui/Markdown";
import { Icon } from "../ui/Icon";
import { IconButton } from "../ui/Button";
import { useAI } from "../shell/Providers";

const SUBJECT_PROMPTS = [
  "What should I study next?",
  "Explain my weakest concept in simpler terms.",
  "Why did I get my last question wrong?",
  "Quiz me on my weakest topic.",
  "Give me another example.",
  "Give me a harder version.",
  "Explain this like I'm completely new to it.",
];
const GLOBAL_PROMPTS = [
  "What should I study right now?",
  "Which subject am I weakest in?",
  "Make me a study plan for this week.",
];

export function Chat({ subjectId, focus, draft, onDraftConsumed, className }: {
  subjectId: string | null;
  focus?: string | null;
  draft?: string | null;
  onDraftConsumed?: () => void;
  className?: string;
}) {
  const key = subjectId ?? "global";
  const messages = useStore((s) => s.chats[key]) ?? [];
  const addChat = useStore((s) => s.addChat);
  const patchChat = useStore((s) => s.patchChat);
  const clearChat = useStore((s) => s.clearChat);
  const subject = useStore((s) => s.subjects.find((x) => x.id === subjectId) ?? null);
  const { ai } = useAI();

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<{ id: string; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, streaming?.text]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    setInput("");
    const s = useStore.getState();
    const history = [...(s.chats[key] ?? []), { role: "user" as const, content }]
      .filter((m) => m.content.trim())
      .slice(-30)
      .map((m) => ({ role: m.role, content: m.content }));
    addChat(key, { role: "user", content });
    const replyId = addChat(key, { role: "assistant", content: "" });
    setStreaming({ id: replyId, text: "" });

    const context = buildAssistantContext({
      subject: s.subjects.find((x) => x.id === subjectId) ?? null,
      subjects: s.subjects,
      player: s.player,
      sessions: s.sessions,
      focus: focus ?? null,
    });
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let final = "";
    let latest = "";
    try {
      final = await streamAssistant(
        context,
        history,
        (t) => {
          latest = t;
          setStreaming({ id: replyId, text: t });
        },
        ctrl.signal,
      );
    } catch (err) {
      final = (err as Error).name === "AbortError" ? latest || "_Stopped._" : `${latest ? latest + "\n\n" : ""}⚠ ${(err as Error).message}`;
    } finally {
      patchChat(key, replyId, final || "_No response._");
      setStreaming(null);
      abortRef.current = null;
    }
  };

  // Auto-send drafts from elsewhere in the app (e.g. "Ask why I got this wrong").
  const consumed = useRef<string | null>(null);
  useEffect(() => {
    if (draft && consumed.current !== draft && !streaming) {
      consumed.current = draft;
      onDraftConsumed?.();
      void send(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const prompts = subjectId ? SUBJECT_PROMPTS : GLOBAL_PROMPTS;
  const empty = messages.length === 0;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
        {empty ? (
          <div className="flex h-full flex-col justify-end">
            <div className="mb-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-line-strong">
                <Icon name="spark" />
              </div>
              <p className="text-xl font-semibold tracking-tight">
                {subject ? `Studying ${subject.name}.` : "Your personal tutor."}
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                {subject
                  ? "I can see your study guide, flashcards, mastery, and every question you've missed."
                  : "I can see all your subjects, mastery levels, and recent sessions."}
              </p>
              {!ai && (
                <p className="mt-3 max-w-sm rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">
                  AI is offline.{" "}
                  <Link href="/settings" className="text-fg underline underline-offset-4">
                    Add your API key in Settings
                  </Link>{" "}
                  to enable live tutoring.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="rounded-full border border-line px-3 py-1.5 text-left text-xs text-muted transition hover:border-line-strong hover:text-fg"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <AnimatePresence initial={false}>
              {messages.map((m) => {
                const text = streaming?.id === m.id ? streaming.text : m.content;
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    {m.role === "user" ? (
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-fg px-4 py-2.5 text-sm text-bg">{m.content}</div>
                    ) : (
                      <div className="max-w-[92%] text-sm text-fg">
                        {text ? (
                          <Markdown text={text} />
                        ) : (
                          <span className="flex items-center gap-1.5 py-2" aria-label="Thinking">
                            {[0, 1, 2].map((i) => (
                              <span key={i} className="h-1.5 w-1.5 rounded-full bg-fg pulse-dot" style={{ animationDelay: `${i * 0.2}s` }} />
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {!empty && !streaming && (
        <div className="flex gap-2 overflow-x-auto px-5 pb-2">
          {prompts.slice(0, 5).map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="shrink-0 rounded-full border border-line px-3 py-1 text-[11px] text-muted transition hover:text-fg"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-2 p-1.5 pl-4 focus-within:border-line-strong">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder={subject ? `Ask about ${subject.name}…` : "Ask anything…"}
            aria-label="Message the assistant"
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm placeholder:text-faint focus:outline-none focus-visible:outline-none"
          />
          {streaming ? (
            <IconButton icon="stop" label="Stop" type="button" onClick={() => abortRef.current?.abort()} className="bg-surface-3 text-fg" />
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-fg text-bg transition disabled:opacity-30"
            >
              <Icon name="arrow" size={16} />
            </button>
          )}
        </div>
        {!empty && (
          <div className="mt-2 flex justify-end">
            <button type="button" onClick={() => clearChat(key)} className="text-[11px] text-faint hover:text-muted">
              Clear conversation
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export function SubjectPicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const subjects = useStore((s) => s.subjects);
  return (
    <div className="relative">
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label="Assistant context"
        className="h-8 appearance-none rounded-full border border-line bg-surface-2 pl-3 pr-8 text-xs text-fg focus:outline-none"
      >
        <option value="">All subjects</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Icon name="down" size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}
