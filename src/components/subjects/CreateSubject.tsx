"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "../ui/Modal";
import { Input, FieldLabel } from "../ui/Field";
import { Button } from "../ui/Button";
import { useStore } from "@/lib/store";
import { REGIONS, guessRegion } from "@/lib/regions";
import type { RegionId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SAMPLE_NOTES, SAMPLE_SUBJECT } from "@/lib/sample";

export function CreateSubjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState<RegionId | null>(null);
  const createSubject = useStore((s) => s.createSubject);
  const addMaterial = useStore((s) => s.addMaterial);
  const router = useRouter();
  const effective = region ?? (name.trim() ? guessRegion(name) : null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = createSubject(name, effective ?? undefined);
    onClose();
    setName("");
    setRegion(null);
    router.push(`/subjects/${id}?tab=materials`);
  };

  const sample = () => {
    const id = createSubject(SAMPLE_SUBJECT, "analytical");
    addMaterial(id, { kind: "notes", title: "Unit review notes", text: SAMPLE_NOTES });
    onClose();
    router.push(`/subjects/${id}?tab=materials&autogen=1`);
  };

  return (
    <Modal open={open} onClose={onClose} title="New subject">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <div>
          <FieldLabel htmlFor="subject-name">Course name</FieldLabel>
          <Input
            id="subject-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. AP Biology, Spanish II, Linear Algebra"
            maxLength={80}
            autoComplete="off"
          />
        </div>
        <div>
          <FieldLabel>Brain region</FieldLabel>
          <p className="-mt-1 mb-3 text-xs text-muted">
            Each subject grows one region of your brain map. It&apos;s a game mechanic inspired by different skills — not neuroscience.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {REGIONS.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => setRegion(r.id)}
                aria-pressed={effective === r.id}
                className={cn(
                  "rounded-2xl border p-3 text-left transition",
                  effective === r.id ? "border-fg bg-fg text-bg" : "border-line hover:border-line-strong",
                )}
              >
                <span className="block text-sm font-medium">{r.name}</span>
                <span className={cn("block text-[11px]", effective === r.id ? "text-bg/70" : "text-muted")}>{r.subjects}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={sample} className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
            Or try a sample subject
          </button>
          <Button type="submit" disabled={!name.trim()} iconRight="arrow">
            Create subject
          </Button>
        </div>
      </form>
    </Modal>
  );
}
