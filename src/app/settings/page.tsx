"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { desktop, type DesktopSettings } from "@/lib/desktop";
import { dayKey } from "@/lib/utils";
import { PageHeader } from "@/components/common/bits";
import { Card, SectionTitle, Chip } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useAI } from "@/components/shell/Providers";

function AISettings() {
  const { ai, model, isDesktop } = useAI();
  const [settings, setSettings] = useState<DesktopSettings | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    desktop()?.getSettings().then(setSettings);
  }, []);

  const save = async (value: string | null) => {
    const d = desktop();
    if (!d) return;
    if (value && !/^sk-ant-/.test(value.trim())) {
      setError("That doesn't look like an Anthropic API key (they start with “sk-ant-”).");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // The app restarts its local server with the new key and reloads this window.
      await d.setApiKey(value);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Card>
      <SectionTitle
        action={
          <Chip active={ai}>
            <span className={ai ? "h-1.5 w-1.5 rounded-full bg-bg" : "h-1.5 w-1.5 rounded-full bg-faint"} />
            {ai ? "AI on" : "AI off"}
          </Chip>
        }
      >
        AI
      </SectionTitle>
      <p className="max-w-xl text-sm leading-relaxed text-muted">
        With an Anthropic API key, Synapse uses Claude to build study kits, run the tutor, write Challenge questions, grade short answers, and read PDFs. Without one, everything still works using the offline generator.
      </p>

      {isDesktop ? (
        <div className="mt-6 max-w-xl">
          {settings?.hasKey && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3">
              <span className="flex items-center gap-3 text-sm">
                <Icon name="key" size={16} />
                Key saved <span className="font-mono text-muted">{settings.keyHint}</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => save(null)} disabled={saving}>
                Remove
              </Button>
            </div>
          )}
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (key.trim()) void save(key.trim());
            }}
          >
            <Input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={settings?.hasKey ? "Replace with a new key…" : "sk-ant-…"}
              aria-label="Anthropic API key"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
            <Button type="submit" loading={saving} disabled={!key.trim()}>
              {saving ? "Restarting…" : "Save key"}
            </Button>
          </form>
          {error && (
            <p role="alert" className="mt-3 text-xs">
              {error}
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-faint">
            Get a key at{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-muted underline underline-offset-4 hover:text-fg">
              console.anthropic.com
            </a>
            . Usage is billed to that account. {settings?.encrypted ? "Your key is encrypted with your system keychain and only used on this computer." : "Your key is stored only on this computer."}
          </p>
          {ai && model && <p className="mt-2 font-mono text-[11px] text-faint">Model: {model}</p>}
        </div>
      ) : (
        <div className="mt-6 max-w-xl rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
          Running in a browser: add <code className="font-mono text-fg">ANTHROPIC_API_KEY=sk-ant-…</code> to <code className="font-mono text-fg">.env.local</code> and restart the server. In the desktop app you can paste the key here instead.
        </div>
      )}
    </Card>
  );
}

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
