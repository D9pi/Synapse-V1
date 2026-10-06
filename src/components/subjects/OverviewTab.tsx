"use client";

import Link from "next/link";
import { useState } from "react";
import type { Subject } from "@/lib/types";
import { useStore } from "@/lib/store";
import { statFor } from "@/lib/adaptive";
import { uid } from "@/lib/utils";
import { Card, SectionTitle } from "../ui/Card";
import { Button, IconButton, LinkButton } from "../ui/Button";
import { Input, Textarea } from "../ui/Field";
import { Meter } from "../ui/Progress";
import { Icon } from "../ui/Icon";
import { MODE_META } from "../common/bits";

/** Two-field inline editor row used for concepts, definitions, and formulas. */
function EditableRow({
  a,
  b,
  aLabel,
  bLabel,
  mono,
  onSave,
  onDelete,
  startEditing = false,
  extra,
}: {
  a: string;
  b: string;
  aLabel: string;
  bLabel: string;
  mono?: boolean;
  onSave: (a: string, b: string) => void;
  onDelete?: () => void;
  startEditing?: boolean;
  extra?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(startEditing);
  const [va, setVa] = useState(a);
  const [vb, setVb] = useState(b);
  if (editing) {
    return (
      <div className="flex flex-col gap-2 py-3">
        <Input value={va} onChange={(e) => setVa(e.target.value)} aria-label={aLabel} placeholder={aLabel} className={mono ? "font-mono" : undefined} />
        <Textarea value={vb} onChange={(e) => setVb(e.target.value)} aria-label={bLabel} placeholder={bLabel} rows={2} />
        <div className="flex justify-end gap-2">
          {onDelete && (
            <Button variant="ghost" size="sm" icon="trash" onClick={onDelete}>
              Delete
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => (setEditing(false), setVa(a), setVb(b))}>
            Cancel
          </Button>
          <Button size="sm" disabled={!va.trim()} onClick={() => (onSave(va.trim(), vb.trim()), setEditing(false))}>
            Save
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="group flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className={mono ? "font-mono text-sm" : "text-sm font-medium"}>{a}</p>
        {b && <p className="mt-0.5 text-sm leading-relaxed text-muted">{b}</p>}
      </div>
      {extra}
      <IconButton icon="edit" label={`Edit ${a}`} onClick={() => setEditing(true)} className="opacity-60 group-hover:opacity-100" />
    </div>
  );
}

export function OverviewTab({ subject }: { subject: Subject }) {
  const kit = subject.kit!;
  const editKit = useStore((s) => s.editKit);
  const [newDef, setNewDef] = useState<string | null>(null);
  const [newFormula, setNewFormula] = useState<string | null>(null);
  const mistakes = subject.mistakes.filter((m) => !m.resolved);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle>Concept mastery</SectionTitle>
          <ul className="flex flex-col divide-y divide-line">
            {kit.concepts.map((c) => {
              const st = statFor(subject, c.id);
              return (
                <li key={c.id}>
                  <EditableRow
                    a={c.name}
                    b={c.summary}
                    aLabel="Concept name"
                    bLabel="Summary"
                    onSave={(name, summary) => editKit(subject.id, (k) => ({ ...k, concepts: k.concepts.map((x) => (x.id === c.id ? { ...x, name, summary } : x)) }))}
                    extra={
                      <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5">
                        <div className="flex items-center gap-2">
                          <span className="num w-9 text-right font-mono text-xs">{Math.round(st.mastery)}%</span>
                          <Meter value={st.mastery} />
                        </div>
                        <Link href={`/study/${subject.id}/${st.attempts ? "quiz" : "learn"}?focus=${c.id}`} className="text-[11px] text-muted hover:text-fg">
                          {st.attempts ? `Practice · ${st.correct}/${st.attempts}` : "Learn →"}
                        </Link>
                      </div>
                    }
                  />
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <SectionTitle action={<Button variant="ghost" size="sm" icon="plus" onClick={() => setNewDef(uid("d"))}>Add</Button>}>
            Definitions · {kit.definitions.length}
          </SectionTitle>
          <div className="flex flex-col divide-y divide-line">
            {newDef && (
              <EditableRow
                key={newDef}
                a=""
                b=""
                aLabel="Term"
                bLabel="Definition"
                startEditing
                onSave={(term, definition) => {
                  editKit(subject.id, (k) => ({ ...k, definitions: [{ id: newDef, term, definition, conceptId: k.concepts[0]?.id ?? "" }, ...k.definitions] }));
                  setNewDef(null);
                }}
                onDelete={() => setNewDef(null)}
              />
            )}
            {kit.definitions.map((d) => (
              <EditableRow
                key={d.id}
                a={d.term}
                b={d.definition}
                aLabel="Term"
                bLabel="Definition"
                onSave={(term, definition) => editKit(subject.id, (k) => ({ ...k, definitions: k.definitions.map((x) => (x.id === d.id ? { ...x, term, definition } : x)) }))}
                onDelete={() => editKit(subject.id, (k) => ({ ...k, definitions: k.definitions.filter((x) => x.id !== d.id) }))}
              />
            ))}
            {!kit.definitions.length && !newDef && <p className="py-2 text-sm text-muted">No definitions extracted.</p>}
          </div>
        </Card>

        {(kit.formulas.length > 0 || newFormula) && (
          <Card>
            <SectionTitle action={<Button variant="ghost" size="sm" icon="plus" onClick={() => setNewFormula(uid("f"))}>Add</Button>}>
              Key formulas · {kit.formulas.length}
            </SectionTitle>
            <div className="flex flex-col divide-y divide-line">
              {newFormula && (
                <EditableRow
                  key={newFormula}
                  a=""
                  b=""
                  mono
                  aLabel="Expression"
                  bLabel="What it means"
                  startEditing
                  onSave={(expression, explanation) => {
                    editKit(subject.id, (k) => ({ ...k, formulas: [{ id: newFormula, name: explanation.split(".")[0] || "Formula", expression, explanation, conceptId: k.concepts[0]?.id ?? "" }, ...k.formulas] }));
                    setNewFormula(null);
                  }}
                  onDelete={() => setNewFormula(null)}
                />
              )}
              {kit.formulas.map((f) => (
                <EditableRow
                  key={f.id}
                  a={f.expression}
                  b={`${f.name}${f.explanation && f.explanation !== f.name ? ` — ${f.explanation}` : ""}`}
                  mono
                  aLabel="Expression"
                  bLabel="Explanation"
                  onSave={(expression, explanation) => editKit(subject.id, (k) => ({ ...k, formulas: k.formulas.map((x) => (x.id === f.id ? { ...x, expression, explanation } : x)) }))}
                  onDelete={() => editKit(subject.id, (k) => ({ ...k, formulas: k.formulas.filter((x) => x.id !== f.id) }))}
                />
              ))}
            </div>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <SectionTitle>Recommended study plan</SectionTitle>
          <ol className="relative flex flex-col gap-1">
            {kit.plan.map((p, i) => {
              const meta = MODE_META[p.mode];
              const href = p.mode === "guide" ? `/subjects/${subject.id}?tab=guide` : `/study/${subject.id}/${p.mode}`;
              return (
                <li key={p.id}>
                  <Link href={href} className="group flex gap-4 rounded-2xl p-2 transition hover:bg-surface-2">
                    <span className="flex flex-col items-center">
                      <span className="num flex h-8 w-8 items-center justify-center rounded-full border border-line-strong font-mono text-[11px]">{i + 1}</span>
                      {i < kit.plan.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                    </span>
                    <span className="min-w-0 flex-1 pb-2">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{p.title}</span>
                        <span className="font-mono text-[10px] text-faint">{p.minutes}m</span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">{p.description}</span>
                      <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-faint group-hover:text-fg">
                        <Icon name={meta.icon} size={11} /> {meta.label}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card>
          <SectionTitle action={mistakes.length > 0 && <LinkButton href={`/study/${subject.id}/review`} size="sm" variant="outline">Review all</LinkButton>}>
            Open mistakes · {mistakes.length}
          </SectionTitle>
          {mistakes.length ? (
            <ul className="flex flex-col gap-3">
              {mistakes.slice(0, 5).map((m) => (
                <li key={m.id} className="rounded-2xl border border-line p-3">
                  <p className="line-clamp-2 whitespace-pre-line text-sm">{m.question}</p>
                  <p className="mt-1.5 text-xs text-muted">
                    <span className="line-through decoration-faint">{m.given || "blank"}</span> → <span className="text-fg">{m.correct}</span>
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing to fix. Questions you miss land here for Review mode.</p>
          )}
        </Card>

        <Card>
          <SectionTitle>Summary</SectionTitle>
          <p className="text-sm leading-relaxed text-muted">{kit.summary}</p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-faint">
            {kit.source === "ai" ? "AI generated" : "Offline generated"} · {new Date(kit.generatedAt).toLocaleDateString()}
          </p>
        </Card>
      </div>
    </div>
  );
}
