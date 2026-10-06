"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { PageHeader, SubjectCard } from "@/components/common/bits";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { CreateSubjectModal } from "@/components/subjects/CreateSubject";

function SubjectsInner() {
  const subjects = useStore((s) => s.subjects);
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(() => !!params.get("new"));

  useEffect(() => {
    if (params.get("new")) router.replace("/subjects");
  }, [params, router]);

  return (
    <div>
      <PageHeader
        eyebrow="Subjects"
        title="Your courses"
        sub="Each subject has its own study kit, level, and region of your brain map."
        action={
          <Button icon="plus" onClick={() => setOpen(true)}>
            New subject
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((s, i) => (
          <SubjectCard key={s.id} subject={s} index={i} />
        ))}
        <button
          onClick={() => setOpen(true)}
          className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-line text-muted transition hover:border-line-strong hover:text-fg"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong">
            <Icon name="plus" />
          </span>
          <span className="text-sm">Add a subject</span>
        </button>
      </div>
      <CreateSubjectModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export default function SubjectsPage() {
  return (
    <Suspense>
      <SubjectsInner />
    </Suspense>
  );
}
