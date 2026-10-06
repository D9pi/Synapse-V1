"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { GuideSection, Subject } from "@/lib/types";
import { useStore } from "@/lib/store";
import { statFor } from "@/lib/adaptive";
import { uid, cn } from "@/lib/utils";
import { Button, IconButton, LinkButton } from "../ui/Button";
import { Card, Chip, EmptyState } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { Input, Textarea, FieldLabel } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { Meter } from "../ui/Progress";
import { XP } from "@/lib/xp";

const toLines = (a: string[]) => a.join("\n");
const fromLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h4 className="label mb-2.5">{title}</h4>
      {children}
    </div>
  );
}

export function GuideSectionView({ section }: { section: GuideSection }) {
  const [showSolution, setShowSolution] = useState(false);
  return (
    <div>
      <p className="text-[15px] leading-relaxed">{section.overview}</p>
      {section.keyPoints.length > 0 && (
        <Block title="Key points">
          <ul className="flex flex-col gap-2">
            {section.keyPoints.map((p, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
                {p}
              </li>
            ))}
          </ul>
        </Block>
      )}
      {section.formulas.length > 0 && (
        <Block title="Important formulas">
          <div className="flex flex-col gap-2">
            {section.formulas.map((f, i) => (
              <div key={i} className="rounded-2xl border border-line bg-surface-2 px-4 py-3">
                <p className="font-mono text-[15px]">{f.expression}</p>
                {f.meaning && <p className="mt-1 text-xs text-muted">{f.meaning}</p>}
              </div>
            ))}
          </div>
        </Block>
      )}
      {section.steps.length > 0 && (
        <Block title="How to solve">
          <ol className="flex flex-col gap-2.5">
            {section.steps.map((s, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[11px]">{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </Block>
      )}
      {section.example && (
        <Block title="Example">
          <div className="rounded-2xl border border-line p-4">
            <p className="text-sm leading-relaxed">{section.example.problem}</p>
            {showSolution ? (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 border-t border-line pt-3">
                <p className="label mb-1.5">Solution</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{section.example.solution}</p>
              </motion.div>
            ) : (
              <button onClick={() => setShowSolution(true)} className="mt-3 text-xs text-muted underline underline-offset-4 hover:text-fg">
                Reveal solution
              </button>
            )}
          </div>
        </Block>
      )}
      {section.commonMistakes.length > 0 && (
        <Block title="Common mistakes">
          <ul className="flex flex-col gap-2">
            {section.commonMistakes.map((m, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <Icon name="x" size={14} className="mt-0.5 shrink-0 text-muted" />
                {m}
              </li>
            ))}
          </ul>
        </Block>
      )}
      {section.quickReview.length > 0 && (
        <Block title="Quick review">
          <div className="rounded-2xl bg-surface-2 p-4">
            <ul className="flex flex-col gap-1.5">
              {section.quickReview.map((m, i) => (
                <li key={i} className="font-mono text-[12.5px] leading-relaxed">
                  → {m}
                </li>
              ))}
            </ul>
          </div>
        </Block>
      )}
    </div>
  );
}

function SectionEditor({ section, subject, onClose }: { section: GuideSection; subject: Subject; onClose: () => void }) {
  const editKit = useStore((s) => s.editKit);
  const [f, setF] = useState({
    title: section.title,
    overview: section.overview,
    keyPoints: toLines(section.keyPoints),
    formulas: section.formulas.map((x) => `${x.expression}${x.meaning ? ` | ${x.meaning}` : ""}`).join("\n"),
    steps: toLines(section.steps),
    problem: section.example?.problem ?? "",
    solution: section.example?.solution ?? "",
    mistakes: toLines(section.commonMistakes),
    review: toLines(section.quickReview),
    conceptId: section.conceptId,
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const save = () => {
    const next: GuideSection = {
      ...section,
      title: f.title.trim() || "Untitled",
      overview: f.overview.trim(),
      keyPoints: fromLines(f.keyPoints),
      formulas: fromLines(f.formulas).map((l) => {
        const [expression, ...rest] = l.split("|");
        return { expression: expression.trim(), meaning: rest.join("|").trim() };
      }),
      steps: fromLines(f.steps),
      example: f.problem.trim() ? { problem: f.problem.trim(), solution: f.solution.trim() } : null,
      commonMistakes: fromLines(f.mistakes),
      quickReview: fromLines(f.review),
      conceptId: f.conceptId,
    };
    editKit(subject.id, (k) => {
      const exists = k.guide.some((g) => g.id === section.id);
      return { ...k, guide: exists ? k.guide.map((g) => (g.id === section.id ? next : g)) : [...k.guide, next] };
    });
    onClose();
  };

  const rows: [keyof typeof f, string, number, string?][] = [
    ["overview", "What is it?", 4],
    ["keyPoints", "Key points (one per line)", 5],
    ["formulas", "Formulas (one per line: expression | meaning)", 3],
    ["steps", "How to solve (one step per line)", 4],
    ["problem", "Example problem", 2],
    ["solution", "Example solution", 3],
    ["mistakes", "Common mistakes (one per line)", 3],
    ["review", "Quick review (one per line)", 3],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel htmlFor="sec-title">Title</FieldLabel>
        <Input id="sec-title" value={f.title} onChange={set("title")} />
      </div>
      <div>
        <FieldLabel htmlFor="sec-concept">Concept</FieldLabel>
        <select id="sec-concept" value={f.conceptId} onChange={set("conceptId")} className="h-11 w-full rounded-2xl border border-line bg-surface-2 px-4 text-sm">
          {subject.kit?.concepts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {rows.map(([k, label, r]) => (
        <div key={k}>
          <FieldLabel htmlFor={`sec-${k}`}>{label}</FieldLabel>
          <Textarea id={`sec-${k}`} value={f[k]} onChange={set(k)} rows={r} />
        </div>
      ))}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={save} icon="check">
          Save section
        </Button>
      </div>
    </div>
  );
}

export function GuideTab({ subject }: { subject: Subject }) {
  const kit = subject.kit!;
  const read = useStore((s) => s.readGuideSection);
  const editKit = useStore((s) => s.editKit);
  const openAssistant = useStore((s) => s.openAssistant);
  const [editing, setEditing] = useState<GuideSection | null>(null);
  const [active, setActive] = useState<string | null>(kit.guide[0]?.id ?? null);

  const readCount = kit.guide.filter((g) => subject.guideRead.includes(g.id)).length;

  const addSection = () =>
    setEditing({
      id: uid("g"),
      conceptId: kit.concepts[0]?.id ?? "",
      title: "",
      overview: "",
      keyPoints: [],
      formulas: [],
      steps: [],
      example: null,
      commonMistakes: [],
      quickReview: [],
    });

  if (!kit.guide.length)
    return <EmptyState title="No guide sections" body="Add a section manually or regenerate the kit." action={<Button icon="plus" onClick={addSection}>Add section</Button>} />;

  const current = kit.guide.find((g) => g.id === active) ?? kit.guide[0];
  const isRead = subject.guideRead.includes(current.id);
  const idx = kit.guide.indexOf(current);
  const stat = statFor(subject, current.conceptId);

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <nav aria-label="Guide sections" className="flex flex-col gap-1 lg:sticky lg:top-[calc(1.5rem_+_var(--tb))] lg:self-start">
        <div className="mb-2 flex items-center justify-between px-3">
          <span className="label">
            {readCount}/{kit.guide.length} read
          </span>
          <button onClick={addSection} className="text-xs text-muted hover:text-fg">
            + Add
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {kit.guide.map((g, i) => (
            <button
              key={g.id}
              onClick={() => setActive(g.id)}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition",
                g.id === current.id ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[9px]",
                  subject.guideRead.includes(g.id) ? "border-fg bg-fg text-bg" : "border-line-strong",
                )}
              >
                {subject.guideRead.includes(g.id) ? <Icon name="check" size={10} /> : i + 1}
              </span>
              <span className="truncate">{g.title}</span>
            </button>
          ))}
        </div>
      </nav>

      <motion.div key={current.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="label">
                Section {idx + 1} · {kit.concepts.find((c) => c.id === current.conceptId)?.name}
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">{current.title}</h3>
              <div className="mt-3 flex items-center gap-3">
                <Meter value={stat.mastery} />
                <span className="font-mono text-[11px] text-muted">{Math.round(stat.mastery)}% mastery</span>
              </div>
            </div>
            <div className="flex shrink-0">
              <IconButton icon="edit" label="Edit section" onClick={() => setEditing(current)} />
              <IconButton
                icon="trash"
                label="Delete section"
                onClick={() => {
                  if (confirm(`Delete “${current.title}”?`)) editKit(subject.id, (k) => ({ ...k, guide: k.guide.filter((g) => g.id !== current.id) }));
                }}
              />
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-6">
            <GuideSectionView section={current} />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-line pt-6">
            {isRead ? (
              <Chip active>
                <Icon name="check" size={11} /> Read
              </Chip>
            ) : (
              <Button
                icon="check"
                onClick={() => {
                  read(subject.id, current.id);
                  const next = kit.guide[idx + 1];
                  if (next) setActive(next.id);
                }}
              >
                Mark as read · +{XP.guideSection} XP
              </Button>
            )}
            <LinkButton href={`/study/${subject.id}/learn?focus=${current.conceptId}`} variant="outline" icon="target">
              Learn & test
            </LinkButton>
            <Button
              variant="ghost"
              icon="spark"
              onClick={() =>
                openAssistant({
                  subjectId: subject.id,
                  focus: `Study guide section: ${current.title}\n${current.overview}`,
                  draft: `Explain "${current.title}" in simpler terms, with an everyday analogy.`,
                })
              }
            >
              Explain simpler
            </Button>
          </div>
        </Card>
      </motion.div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.title ? "Edit section" : "New section"} className="sm:max-w-2xl">
        {editing && <SectionEditor section={editing} subject={subject} onClose={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
