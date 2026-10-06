"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useStore, useSubject } from "@/lib/store";
import { subjectLevel } from "@/lib/levels";
import { REGIONS, regionById } from "@/lib/regions";
import { subjectMastery } from "@/lib/adaptive";
import type { RegionId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Tabs } from "@/components/ui/Tabs";
import { Button, LinkButton, IconButton } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/Progress";
import { EmptyState } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input, FieldLabel } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { MaterialsTab } from "@/components/subjects/MaterialsTab";
import { GuideTab } from "@/components/subjects/GuideTab";
import { CardsTab, QuestionsTab } from "@/components/subjects/ContentTabs";
import { OverviewTab } from "@/components/subjects/OverviewTab";

type Tab = "overview" | "guide" | "cards" | "questions" | "materials";

function SettingsModal({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const subject = useSubject(id);
  const update = useStore((s) => s.updateSubject);
  const del = useStore((s) => s.deleteSubject);
  const router = useRouter();
  const [name, setName] = useState(subject?.name ?? "");
  const [region, setRegion] = useState<RegionId>(subject?.region ?? "creative");
  if (!subject) return null;
  return (
    <Modal open={open} onClose={onClose} title="Subject settings">
      <div className="flex flex-col gap-5">
        <div>
          <FieldLabel htmlFor="s-name">Name</FieldLabel>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor="s-region">Brain region</FieldLabel>
          <select id="s-region" value={region} onChange={(e) => setRegion(e.target.value as RegionId)} className="h-11 w-full rounded-2xl border border-line bg-surface-2 px-4 text-sm">
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.subjects}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="danger"
            size="sm"
            icon="trash"
            onClick={() => {
              if (confirm(`Delete ${subject.name}? Its study kit, progress, and XP will be removed. Your overall player XP is kept.`)) {
                router.push("/subjects");
                del(subject.id);
              }
            }}
          >
            Delete subject
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              update(subject.id, { name: name.trim(), region });
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SubjectInner() {
  const { id } = useParams<{ id: string }>();
  const subject = useSubject(id);
  const params = useSearchParams();
  const router = useRouter();
  const setCtx = useStore((s) => s.setAssistantContext);
  const sessions = useStore((s) => s.sessions.filter((x) => x.subjectId === id).length);
  const tab: Tab = (params.get("tab") as Tab) || (subject?.kit ? "overview" : "materials");
  const [settings, setSettings] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const autogen = params.get("autogen") === "1";

  useEffect(() => {
    if (subject) setCtx(subject.id, null);
  }, [subject?.id, setCtx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!subject) {
    return (
      <EmptyState
        title="Subject not found"
        body="It may have been deleted."
        action={<LinkButton href="/subjects" variant="outline" icon="back">All subjects</LinkButton>}
      />
    );
  }

  const lv = subjectLevel(subject.xp);
  const region = regionById(subject.region);
  const mastery = subjectMastery(subject);
  const kit = subject.kit;

  const changeTab = (t: Tab) => {
    router.replace(`/subjects/${subject.id}?tab=${t}`, { scroll: false });
  };

  const tabs: { id: Tab; label: string; count?: number }[] = kit
    ? [
        { id: "overview", label: "Overview" },
        { id: "guide", label: "Study guide", count: kit.guide.length },
        { id: "cards", label: "Flashcards", count: kit.flashcards.length },
        { id: "questions", label: "Questions", count: kit.mcqs.length + kit.shortAnswers.length },
        { id: "materials", label: "Materials", count: subject.materials.length },
      ]
    : [{ id: "materials", label: "Materials", count: subject.materials.length }];

  const activeTab = kit ? tab : "materials";

  return (
    <div>
      <Link href="/subjects" className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted hover:text-fg">
        <Icon name="back" size={14} /> Subjects
      </Link>

      <header className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="label">{region.name}</p>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{subject.name}</h1>
            <IconButton icon="dots" label="Subject settings" onClick={() => setSettings(true)} />
          </div>
          <div className="mt-5 grid max-w-xl grid-cols-3 gap-6">
            <div>
              <p className="label">Level</p>
              <p className="num mt-1 text-2xl font-semibold">{lv.level}</p>
            </div>
            <div>
              <p className="label">Mastery</p>
              <p className="num mt-1 text-2xl font-semibold">{kit ? `${mastery}%` : "—"}</p>
            </div>
            <div>
              <p className="label">Sessions</p>
              <p className="num mt-1 text-2xl font-semibold">{sessions}</p>
            </div>
          </div>
          <div className="mt-5 max-w-xl">
            <div className="mb-1.5 flex justify-between font-mono text-[11px] text-muted">
              <span>LV {lv.level}</span>
              <span>
                {lv.current}/{lv.needed} XP
              </span>
              <span>LV {lv.level + 1}</span>
            </div>
            <ProgressBar value={lv.progress} label="Subject level progress" />
          </div>
        </div>
        {kit && (
          <div className="flex gap-2">
            <LinkButton href={`/study?subject=${subject.id}`} size="lg" icon="play">
              Study
            </LinkButton>
          </div>
        )}
      </header>

      {notice && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-dashed border-line px-4 py-3 text-xs text-muted">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="hover:text-fg">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      <Tabs tabs={tabs} value={activeTab} onChange={changeTab} className={cn("mb-6 w-fit max-w-full")} layoutId="subject-tabs" />

      {activeTab === "overview" && kit && <OverviewTab subject={subject} />}
      {activeTab === "guide" && kit && <GuideTab subject={subject} />}
      {activeTab === "cards" && kit && <CardsTab subject={subject} />}
      {activeTab === "questions" && kit && <QuestionsTab subject={subject} />}
      {activeTab === "materials" && (
        <MaterialsTab
          subject={subject}
          autogen={autogen}
          onGenerated={(n) => {
            setNotice(n ?? null);
            changeTab("guide");
          }}
        />
      )}

      <SettingsModal key={String(settings)} id={subject.id} open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}

export default function SubjectPage() {
  return (
    <Suspense>
      <SubjectInner />
    </Suspense>
  );
}
