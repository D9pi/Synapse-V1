"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Chat, SubjectPicker } from "./Chat";
import { IconButton } from "../ui/Button";
import { Icon } from "../ui/Icon";

export function AssistantDrawer() {
  const open = useStore((s) => s.assistantOpen);
  const close = useStore((s) => s.closeAssistant);
  const subjectId = useStore((s) => s.assistantSubjectId);
  const focus = useStore((s) => s.assistantFocus);
  const draft = useStore((s) => s.assistantDraft);
  const setCtx = useStore((s) => s.setAssistantContext);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:bg-transparent lg:backdrop-blur-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
          <motion.aside
            role="dialog"
            aria-label="AI study assistant"
            className="fixed inset-x-0 bottom-0 top-[calc(3rem_+_var(--tb))] z-50 flex flex-col overflow-hidden rounded-t-3xl border border-line-strong bg-surface shadow-2xl sm:inset-x-auto sm:bottom-4 sm:right-4 sm:top-[calc(1rem_+_var(--tb))] sm:w-[440px] sm:rounded-3xl"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Icon name="spark" size={16} />
                <span className="text-sm font-medium">Synapse AI</span>
              </div>
              <div className="flex items-center gap-1">
                <SubjectPicker value={subjectId} onChange={(v) => setCtx(v, null)} />
                <Link href="/ai" onClick={close} aria-label="Open full screen" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg">
                  <Icon name="expand" size={16} />
                </Link>
                <IconButton icon="close" label="Close assistant" onClick={close} />
              </div>
            </header>
            {focus && (
              <div className="flex items-start gap-2 border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted">
                <Icon name="target" size={14} className="mt-0.5 shrink-0" />
                <span className="line-clamp-2">Context: {focus.split("\n")[0]}</span>
              </div>
            )}
            <Chat
              key={subjectId ?? "global"}
              subjectId={subjectId}
              focus={focus}
              draft={draft}
              onDraftConsumed={() => useStore.setState({ assistantDraft: null })}
              className="flex-1"
            />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
