"use client";

import { useState } from "react";
import type { Difficulty, Flashcard, MCQ, PracticeProblem, ShortAnswer, Subject } from "@/lib/types";
import { useStore } from "@/lib/store";
import { uid, cn } from "@/lib/utils";
import { Button, IconButton, LinkButton } from "../ui/Button";
import { Card, Chip, EmptyState, SectionTitle } from "../ui/Card";
import { Modal } from "../ui/Modal";
import { Textarea, FieldLabel, Input } from "../ui/Field";
import { Icon } from "../ui/Icon";

function ConceptSelect({ subject, value, onChange, id }: { subject: Subject; value: string; onChange: (v: string) => void; id: string }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-2xl border border-line bg-surface-2 px-4 text-sm">
      {subject.kit?.concepts.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

function ConceptFilter({ subject, value, onChange }: { subject: Subject; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {[{ id: "all", name: "All" }, ...(subject.kit?.concepts ?? [])].map((c) => (
        <button
          key={c.id}
          onClick={() => onChange(c.id)}
          className={cn(
            "h-7 shrink-0 rounded-full border px-3 text-[11px] transition",
            value === c.id ? "border-fg bg-fg text-bg" : "border-line text-muted hover:text-fg",
          )}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Flashcards ---------------- */

export function CardsTab({ subject }: { subject: Subject }) {
  const kit = subject.kit!;
  const editKit = useStore((s) => s.editKit);
  const [editing, setEditing] = useState<Flashcard | null>(null);
  const [filter, setFilter] = useState("all");
  const cards = kit.flashcards.filter((c) => filter === "all" || c.conceptId === filter);
  const known = kit.flashcards.filter((c) => subject.cardStatus[c.id] === "known").length;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted">
            <span className="num font-mono text-fg">{known}</span>/{kit.flashcards.length} known
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon="plus" onClick={() => setEditing({ id: uid("card"), front: "", back: "", conceptId: filter !== "all" ? filter : kit.concepts[0]?.id ?? "" })}>
            Add card
          </Button>
          <LinkButton href={`/study/${subject.id}/flashcards`} size="sm" icon="play">
            Study cards
          </LinkButton>
        </div>
      </div>
      <ConceptFilter subject={subject} value={filter} onChange={setFilter} />
      {cards.length === 0 ? (
        <EmptyState className="mt-4" title="No cards here" body="Add one, or regenerate the kit." />
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <button
              key={c.id}
              onClick={() => setEditing(c)}
              className="group flex flex-col rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-line-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-snug">{c.front}</p>
                {subject.cardStatus[c.id] && <Chip active={subject.cardStatus[c.id] === "known"}>{subject.cardStatus[c.id]}</Chip>}
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{c.back}</p>
              <span className="mt-3 flex items-center gap-1 text-[11px] text-faint opacity-0 transition group-hover:opacity-100">
                <Icon name="edit" size={12} /> Edit
              </span>
            </button>
          ))}
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.front ? "Edit flashcard" : "New flashcard"}>
        {editing && (
          <CardEditor
            card={editing}
            subject={subject}
            onClose={() => setEditing(null)}
            onSave={(c) =>
              editKit(subject.id, (k) => ({
                ...k,
                flashcards: k.flashcards.some((x) => x.id === c.id) ? k.flashcards.map((x) => (x.id === c.id ? c : x)) : [c, ...k.flashcards],
              }))
            }
            onDelete={() => editKit(subject.id, (k) => ({ ...k, flashcards: k.flashcards.filter((x) => x.id !== editing.id) }))}
          />
        )}
      </Modal>
    </div>
  );
}

function CardEditor({ card, subject, onClose, onSave, onDelete }: { card: Flashcard; subject: Subject; onClose: () => void; onSave: (c: Flashcard) => void; onDelete: () => void }) {
  const [c, setC] = useState(card);
  const exists = subject.kit?.flashcards.some((x) => x.id === card.id);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel htmlFor="card-front">Front</FieldLabel>
        <Textarea id="card-front" rows={2} value={c.front} onChange={(e) => setC({ ...c, front: e.target.value })} />
      </div>
      <div>
        <FieldLabel htmlFor="card-back">Back</FieldLabel>
        <Textarea id="card-back" rows={4} value={c.back} onChange={(e) => setC({ ...c, back: e.target.value })} />
      </div>
      <div>
        <FieldLabel htmlFor="card-concept">Concept</FieldLabel>
        <ConceptSelect id="card-concept" subject={subject} value={c.conceptId} onChange={(v) => setC({ ...c, conceptId: v })} />
      </div>
      <div className="flex items-center justify-between pt-2">
        {exists ? (
          <Button
            variant="danger"
            size="sm"
            icon="trash"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Delete
          </Button>
        ) : (
          <span />
        )}
        <Button
          icon="check"
          disabled={!c.front.trim() || !c.back.trim()}
          onClick={() => {
            onSave({ ...c, front: c.front.trim(), back: c.back.trim() });
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Questions ---------------- */

const DIFFS: Difficulty[] = ["easy", "medium", "hard"];

export function QuestionsTab({ subject }: { subject: Subject }) {
  const kit = subject.kit!;
  const editKit = useStore((s) => s.editKit);
  const [filter, setFilter] = useState("all");
  const [mcq, setMcq] = useState<MCQ | null>(null);
  const [sa, setSa] = useState<ShortAnswer | null>(null);
  const [prob, setProb] = useState<PracticeProblem | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const f = <T extends { conceptId: string }>(xs: T[]) => xs.filter((x) => filter === "all" || x.conceptId === filter);
  const firstConcept = filter !== "all" ? filter : kit.concepts[0]?.id ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {kit.mcqs.length} multiple choice · {kit.shortAnswers.length} short answer · {kit.problems.length} practice problems
        </p>
        <LinkButton href={`/study/${subject.id}/quiz`} size="sm" icon="play">
          Take a quiz
        </LinkButton>
      </div>
      <ConceptFilter subject={subject} value={filter} onChange={setFilter} />

      <Card>
        <SectionTitle
          action={
            <Button variant="ghost" size="sm" icon="plus" onClick={() => setMcq({ id: uid("q"), question: "", choices: ["", "", "", ""], answerIndex: 0, explanation: "", conceptId: firstConcept, difficulty: "medium" })}>
              Add
            </Button>
          }
        >
          Multiple choice
        </SectionTitle>
        <ul className="flex flex-col divide-y divide-line">
          {f(kit.mcqs).map((q) => (
            <li key={q.id}>
              <button onClick={() => setMcq(q)} className="group flex w-full items-start gap-4 py-3.5 text-left">
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-pre-line text-sm">{q.question}</span>
                  <span className="mt-1 block truncate text-xs text-muted">✓ {q.choices[q.answerIndex]}</span>
                </span>
                <Chip>{q.difficulty}</Chip>
              </button>
            </li>
          ))}
          {f(kit.mcqs).length === 0 && <li className="py-3 text-sm text-muted">No questions for this concept.</li>}
        </ul>
      </Card>

      <Card>
        <SectionTitle
          action={
            <Button variant="ghost" size="sm" icon="plus" onClick={() => setSa({ id: uid("sa"), question: "", answer: "", conceptId: firstConcept, difficulty: "medium" })}>
              Add
            </Button>
          }
        >
          Short answer
        </SectionTitle>
        <ul className="flex flex-col divide-y divide-line">
          {f(kit.shortAnswers).map((q) => (
            <li key={q.id} className="group flex items-start gap-3 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm">{q.question}</p>
                {revealed[q.id] ? (
                  <p className="mt-1.5 text-sm text-muted">{q.answer}</p>
                ) : (
                  <button onClick={() => setRevealed({ ...revealed, [q.id]: true })} className="mt-1.5 text-xs text-faint hover:text-muted">
                    Show model answer
                  </button>
                )}
              </div>
              <IconButton icon="edit" label="Edit question" onClick={() => setSa(q)} />
            </li>
          ))}
          {f(kit.shortAnswers).length === 0 && <li className="py-3 text-sm text-muted">None yet.</li>}
        </ul>
      </Card>

      <Card>
        <SectionTitle
          action={
            <Button variant="ghost" size="sm" icon="plus" onClick={() => setProb({ id: uid("p"), problem: "", solution: "", conceptId: firstConcept })}>
              Add
            </Button>
          }
        >
          Practice problems
        </SectionTitle>
        <ul className="flex flex-col divide-y divide-line">
          {f(kit.problems).map((p, i) => (
            <li key={p.id} className="flex items-start gap-3 py-3.5">
              <span className="num mt-0.5 font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-line text-sm">{p.problem}</p>
                {revealed[p.id] ? (
                  <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm text-muted">{p.solution}</p>
                ) : (
                  <button onClick={() => setRevealed({ ...revealed, [p.id]: true })} className="mt-1.5 text-xs text-faint hover:text-muted">
                    Show worked solution
                  </button>
                )}
              </div>
              <IconButton icon="edit" label="Edit problem" onClick={() => setProb(p)} />
            </li>
          ))}
          {f(kit.problems).length === 0 && <li className="py-3 text-sm text-muted">No practice problems for this material.</li>}
        </ul>
      </Card>

      <Modal open={!!mcq} onClose={() => setMcq(null)} title="Multiple-choice question" className="sm:max-w-xl">
        {mcq && (
          <McqEditor
            q={mcq}
            subject={subject}
            onClose={() => setMcq(null)}
            onSave={(q) => editKit(subject.id, (k) => ({ ...k, mcqs: k.mcqs.some((x) => x.id === q.id) ? k.mcqs.map((x) => (x.id === q.id ? q : x)) : [q, ...k.mcqs] }))}
            onDelete={() => editKit(subject.id, (k) => ({ ...k, mcqs: k.mcqs.filter((x) => x.id !== mcq.id) }))}
          />
        )}
      </Modal>
      <Modal open={!!sa} onClose={() => setSa(null)} title="Short-answer question">
        {sa && (
          <SimpleEditor
            fields={[
              ["question", "Question", 3],
              ["answer", "Model answer", 4],
            ]}
            value={sa}
            subject={subject}
            exists={kit.shortAnswers.some((x) => x.id === sa.id)}
            onClose={() => setSa(null)}
            onSave={(v) => editKit(subject.id, (k) => ({ ...k, shortAnswers: k.shortAnswers.some((x) => x.id === v.id) ? k.shortAnswers.map((x) => (x.id === v.id ? v : x)) : [v, ...k.shortAnswers] }))}
            onDelete={() => editKit(subject.id, (k) => ({ ...k, shortAnswers: k.shortAnswers.filter((x) => x.id !== sa.id) }))}
          />
        )}
      </Modal>
      <Modal open={!!prob} onClose={() => setProb(null)} title="Practice problem">
        {prob && (
          <SimpleEditor
            fields={[
              ["problem", "Problem", 3],
              ["solution", "Worked solution", 5],
            ]}
            value={prob}
            subject={subject}
            exists={kit.problems.some((x) => x.id === prob.id)}
            onClose={() => setProb(null)}
            onSave={(v) => editKit(subject.id, (k) => ({ ...k, problems: k.problems.some((x) => x.id === v.id) ? k.problems.map((x) => (x.id === v.id ? v : x)) : [v, ...k.problems] }))}
            onDelete={() => editKit(subject.id, (k) => ({ ...k, problems: k.problems.filter((x) => x.id !== prob.id) }))}
          />
        )}
      </Modal>
    </div>
  );
}

function McqEditor({ q, subject, onClose, onSave, onDelete }: { q: MCQ; subject: Subject; onClose: () => void; onSave: (q: MCQ) => void; onDelete: () => void }) {
  const [v, setV] = useState(q);
  const exists = subject.kit?.mcqs.some((x) => x.id === q.id);
  const valid = v.question.trim() && v.choices.filter((c) => c.trim()).length >= 2 && v.choices[v.answerIndex]?.trim();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel htmlFor="mcq-q">Question</FieldLabel>
        <Textarea id="mcq-q" rows={3} value={v.question} onChange={(e) => setV({ ...v, question: e.target.value })} />
      </div>
      <fieldset>
        <legend className="label mb-2">Choices — select the correct one</legend>
        <div className="flex flex-col gap-2">
          {v.choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setV({ ...v, answerIndex: i })}
                aria-label={`Mark choice ${i + 1} correct`}
                aria-pressed={v.answerIndex === i}
                className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", v.answerIndex === i ? "border-fg bg-fg text-bg" : "border-line-strong text-faint")}
              >
                <Icon name="check" size={14} />
              </button>
              <Input value={c} onChange={(e) => setV({ ...v, choices: v.choices.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Choice ${i + 1}`} />
            </div>
          ))}
        </div>
      </fieldset>
      <div>
        <FieldLabel htmlFor="mcq-exp">Explanation</FieldLabel>
        <Textarea id="mcq-exp" rows={3} value={v.explanation} onChange={(e) => setV({ ...v, explanation: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor="mcq-concept">Concept</FieldLabel>
          <ConceptSelect id="mcq-concept" subject={subject} value={v.conceptId} onChange={(x) => setV({ ...v, conceptId: x })} />
        </div>
        <div>
          <FieldLabel htmlFor="mcq-diff">Difficulty</FieldLabel>
          <select id="mcq-diff" value={v.difficulty} onChange={(e) => setV({ ...v, difficulty: e.target.value as Difficulty })} className="h-11 w-full rounded-2xl border border-line bg-surface-2 px-4 text-sm">
            {DIFFS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-between pt-2">
        {exists ? (
          <Button variant="danger" size="sm" icon="trash" onClick={() => (onDelete(), onClose())}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <Button
          icon="check"
          disabled={!valid}
          onClick={() => {
            const kept = v.choices.map((c, i) => ({ c: c.trim(), i })).filter((x) => x.c);
            onSave({ ...v, choices: kept.map((x) => x.c), answerIndex: Math.max(0, kept.findIndex((x) => x.i === v.answerIndex)) });
            onClose();
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function SimpleEditor<T extends { id: string; conceptId: string }>({
  fields,
  value,
  subject,
  exists,
  onClose,
  onSave,
  onDelete,
}: {
  fields: [keyof T & string, string, number][];
  value: T;
  subject: Subject;
  exists: boolean;
  onClose: () => void;
  onSave: (v: T) => void;
  onDelete: () => void;
}) {
  const [v, setV] = useState(value);
  const valid = fields.every(([k]) => String(v[k] ?? "").trim());
  return (
    <div className="flex flex-col gap-4">
      {fields.map(([k, label, rows]) => (
        <div key={k}>
          <FieldLabel htmlFor={`f-${k}`}>{label}</FieldLabel>
          <Textarea id={`f-${k}`} rows={rows} value={String(v[k] ?? "")} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
        </div>
      ))}
      <div>
        <FieldLabel htmlFor="f-concept">Concept</FieldLabel>
        <ConceptSelect id="f-concept" subject={subject} value={v.conceptId} onChange={(x) => setV({ ...v, conceptId: x })} />
      </div>
      <div className="flex items-center justify-between pt-2">
        {exists ? (
          <Button variant="danger" size="sm" icon="trash" onClick={() => (onDelete(), onClose())}>
            Delete
          </Button>
        ) : (
          <span />
        )}
        <Button icon="check" disabled={!valid} onClick={() => (onSave(v), onClose())}>
          Save
        </Button>
      </div>
    </div>
  );
}
