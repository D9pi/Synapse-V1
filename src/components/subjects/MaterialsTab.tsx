"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { MaterialKind, Subject } from "@/lib/types";
import { useStore } from "@/lib/store";
import { api, fileToBase64 } from "@/lib/client-api";
import { combineForOffline, combineMaterials, reconcileKit } from "@/lib/kit-utils";
import { parseFlashcards } from "@/lib/offline";
import { cn, timeAgo } from "@/lib/utils";
import { Card, SectionTitle } from "../ui/Card";
import { Button, IconButton } from "../ui/Button";
import { Input, Textarea } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { useAI } from "../shell/Providers";

const KINDS: { id: MaterialKind; label: string; hint: string; placeholder: string }[] = [
  {
    id: "notes",
    label: "Notes",
    hint: "Typed or pasted class notes. Messy is fine.",
    placeholder: "Paste or type your notes…\n\nQuadratic equations\n- standard form ax² + bx + c = 0\n- discriminant b² − 4ac tells you the number of roots…",
  },
  {
    id: "document",
    label: "Textbook",
    hint: "Text copied from a textbook, article, or handout.",
    placeholder: "Paste a section of your textbook…",
  },
  {
    id: "flashcards",
    label: "Flashcards",
    hint: "One per line: term – definition, term: definition, or tab-separated (Quizlet export).",
    placeholder: "Mitochondria\tPowerhouse of the cell\nOsmosis – diffusion of water across a membrane\nATP: the cell's energy currency",
  },
  {
    id: "topics",
    label: "Topics",
    hint: "Just a list of what you need to study. The AI fills in the content.",
    placeholder: "Unit 3 test topics:\n- Photosynthesis light reactions\n- Calvin cycle\n- Cellular respiration\n- Fermentation",
  },
];

const STAGES = [
  "Reading your material",
  "Identifying key concepts",
  "Structuring the study guide",
  "Extracting definitions & formulas",
  "Writing flashcards",
  "Building adaptive quizzes",
  "Planning your sessions",
];

export function MaterialsTab({ subject, autogen, onGenerated }: { subject: Subject; autogen?: boolean; onGenerated: (notice?: string) => void }) {
  const addMaterial = useStore((s) => s.addMaterial);
  const removeMaterial = useStore((s) => s.removeMaterial);
  const setKit = useStore((s) => s.setKit);
  const { ai, provider, model } = useAI();

  const [kind, setKind] = useState<MaterialKind>("notes");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoRan = useRef(false);

  const meta = KINDS.find((k) => k.id === kind)!;
  const cardPreview = kind === "flashcards" && text.trim() ? parseFlashcards(text).length : null;

  useEffect(() => {
    if (!generating) return;
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), !ai ? 500 : provider === "ollama" ? 25000 : 6000);
    return () => clearInterval(t);
  }, [generating, ai, provider]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const save = () => {
    if (!text.trim()) return;
    addMaterial(subject.id, {
      kind,
      title: title.trim() || `${meta.label} ${subject.materials.filter((m) => m.kind === kind).length + 1}`,
      text: text.trim(),
    });
    setTitle("");
    setText("");
    setError(null);
  };

  const onFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const base = file.name.replace(/\.[^.]+$/, "");
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        if (file.size > 20 * 1024 * 1024) throw new Error("That PDF is larger than 20 MB. Try a smaller section.");
        const data = await fileToBase64(file);
        const { text } = await api.extract(file.name, data);
        addMaterial(subject.id, { kind: "document", title: base, text });
      } else if (/\.(txt|md|markdown|csv|tsv|json|rtf)$/i.test(file.name) || file.type.startsWith("text/")) {
        if (file.size > 2 * 1024 * 1024) throw new Error("That file is too large (max 2 MB of text).");
        const content = await file.text();
        const isCards = /\.(csv|tsv)$/i.test(file.name) || parseFlashcards(content).length > content.split("\n").length * 0.7;
        addMaterial(subject.id, { kind: isCards ? "flashcards" : "notes", title: base, text: content });
      } else {
        throw new Error("Unsupported file type. Upload a PDF, .txt, .md, .csv, or .tsv file — or paste the text.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const generate = async () => {
    const s = useStore.getState().subjects.find((x) => x.id === subject.id);
    if (!s || !s.materials.length) return;
    setGenerating(true);
    setStage(0);
    setError(null);
    setNotice(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await api.generate(s.name, combineMaterials(s.materials), combineForOffline(s.materials), ctrl.signal);
      const fresh = useStore.getState().subjects.find((x) => x.id === subject.id);
      if (!fresh) return;
      setKit(subject.id, reconcileKit(fresh, res.kit));
      if (res.notice) setNotice(res.notice);
      onGenerated(res.notice);
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError((err as Error).message);
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  useEffect(() => {
    if (autogen && !autoRan.current && subject.materials.length && !subject.kit) {
      autoRan.current = true;
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autogen]);

  const totalChars = subject.materials.reduce((a, m) => a + m.text.length, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <SectionTitle>Add material</SectionTitle>
        <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="Material type">
          {KINDS.map((k) => (
            <button
              key={k.id}
              role="radio"
              aria-checked={kind === k.id}
              onClick={() => setKind(k.id)}
              className={cn(
                "h-8 rounded-full border px-3.5 text-xs transition",
                kind === k.id ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="mb-4 text-xs text-muted">{meta.hint}</p>
        <div className="flex flex-col gap-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional) — e.g. Chapter 4 notes" aria-label="Material title" />
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={meta.placeholder}
            rows={11}
            aria-label="Material text"
            className="font-mono text-[13px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md,.markdown,.csv,.tsv,application/pdf,text/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
              <Button variant="outline" size="sm" icon="upload" loading={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? "Reading…" : "Upload file"}
              </Button>
              {cardPreview !== null && <span className="font-mono text-[11px] text-muted">{cardPreview} cards detected</span>}
            </div>
            <Button size="sm" icon="plus" onClick={save} disabled={!text.trim()}>
              Add to {subject.name}
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle>
            Materials · {subject.materials.length}
          </SectionTitle>
          {subject.materials.length === 0 ? (
            <p className="text-sm text-muted">Nothing added yet. Paste notes, upload a file, or list the topics you need to learn.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {subject.materials.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-muted">
                    <Icon name={m.kind === "flashcards" ? "cards" : m.kind === "topics" ? "target" : "file"} size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{m.title}</span>
                    <span className="block font-mono text-[11px] text-faint">
                      {m.kind} · {m.text.length.toLocaleString()} chars · {timeAgo(m.addedAt)}
                    </span>
                  </span>
                  <IconButton icon="trash" label={`Remove ${m.title}`} onClick={() => removeMaterial(subject.id, m.id)} disabled={generating} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className={cn("relative overflow-hidden", generating && "border-line-strong")}>
          {generating && <div className="sheen pointer-events-none absolute inset-0" />}
          <div className="relative">
            <SectionTitle>
              <span className="flex items-center gap-2">
                <Icon name="spark" size={12} /> {subject.kit ? "Regenerate study kit" : "Generate study kit"}
              </span>
            </SectionTitle>
            <AnimatePresence mode="wait">
              {generating ? (
                <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ol className="flex flex-col gap-2.5" aria-live="polite">
                    {STAGES.map((s, i) => (
                      <li key={s} className={cn("flex items-center gap-3 text-sm transition", i < stage ? "text-muted" : i === stage ? "text-fg" : "text-faint")}>
                        <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", i < stage ? "border-muted bg-muted text-bg" : i === stage ? "border-fg" : "border-faint")}>
                          {i < stage ? <Icon name="check" size={10} /> : i === stage ? <span className="h-1.5 w-1.5 rounded-full bg-fg pulse-dot" /> : null}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                  <Button variant="ghost" size="sm" className="mt-4" onClick={() => abortRef.current?.abort()}>
                    Cancel
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-sm text-muted">
                    {subject.kit
                      ? "Rebuild everything from your current materials. Mastery carries over for concepts that still exist; manual edits will be replaced."
                      : "The AI will reorganize your material into a study guide, key concepts, definitions, formulas, flashcards, quizzes, practice problems, and a study plan."}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-faint">
                    {totalChars.toLocaleString()} chars · {!ai ? "offline generator (AI is off)" : provider === "ollama" ? `Local AI (${model}) — may take a few minutes` : "Claude"}
                  </p>
                  <Button className="mt-4 w-full" size="lg" icon="spark" onClick={generate} disabled={!subject.materials.length}>
                    {subject.kit ? "Regenerate" : "Generate study kit"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <p role="alert" className="mt-4 rounded-xl border border-line-strong bg-surface-2 px-3 py-2 text-xs">
                {error}
              </p>
            )}
            {notice && !error && <p className="mt-4 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted">{notice}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
