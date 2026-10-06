"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { desktop } from "@/lib/desktop";
import { AISettings } from "@/components/settings/AISettings";
import { dayKey } from "@/lib/utils";
import { PageHeader } from "@/components/common/bits";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAI } from "@/components/shell/Providers";

function DataSettings() {
  const resetAll = useStore((s) => s.resetAll);
  const { isDesktop } = useAI();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const exportData = () => {
    const s = useStore.getState();
    const blob = new Blob([JSON.stringify({ app: "synapse", version: 1, player: s.player, subjects: s.subjects, sessions: s.sessions, activity: s.activity }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `synapse-backup-${dayKey()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object" || !data.player || !Array.isArray(data.subjects)) throw new Error("bad");
      if (!confirm("Replace your current progress with this backup?")) return;
      useStore.setState({
        player: data.player,
        subjects: data.subjects,
        sessions: Array.isArray(data.sessions) ? data.sessions : [],
        activity: Array.isArray(data.activity) ? data.activity : [],
      });
      setMessage(`Imported ${data.subjects.length} subject${data.subjects.length === 1 ? "" : "s"}.`);
    } catch {
      setMessage("That file isn't a Synapse backup.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card>
      <SectionTitle>Data</SectionTitle>
      <p className="max-w-xl text-sm text-muted">
        {isDesktop ? "Your progress is saved automatically to a file on this computer." : "Your progress is saved in this browser."} Export a backup to move it to another device.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" icon="upload" onClick={exportData}>
          Export backup
        </Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        <Button variant="outline" size="sm" icon="file" onClick={() => fileRef.current?.click()}>
          Import backup
        </Button>
        {isDesktop && (
          <Button variant="ghost" size="sm" icon="layers" onClick={() => desktop()?.openDataFolder()}>
            Open data folder
          </Button>
        )}
        <Button
          variant="danger"
          size="sm"
          icon="trash"
          onClick={() => {
            if (confirm("Reset all progress, subjects, and XP? This cannot be undone.")) resetAll();
          }}
        >
          Reset everything
        </Button>
      </div>
      {message && <p className="mt-3 text-xs text-muted">{message}</p>}
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader eyebrow="Settings" title="Settings" />
      <div className="flex max-w-3xl flex-col gap-4">
        <AISettings />
        <DataSettings />
      </div>
    </div>
  );
}
