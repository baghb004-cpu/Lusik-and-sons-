"use client";

// ============================================================
// Local AI panel (Phase 14) — settings + tasks, honestly framed
// ============================================================
// Top: runner/model status (auto-detected), tier advice with the
// license-vetted catalog and real speed expectations. Bottom:
// the task box. Block proposals arrive PRE-GATED (server ran
// blockSchema + commerce checks); Insert hands them to the
// normal edit path, and Save runs the server gates again. Text
// results are copy-out only. The model never touches storage.
// ============================================================

import { useEffect, useState } from "react";
import type { Block } from "../schema/index.ts";
import { AI_TASKS, aiSettingsSchema, type AiSettings } from "../ai/index.ts";

type Api = (input: string, init?: RequestInit) => Promise<Response>;

interface RunnerRow {
  id: string;
  available: boolean;
  models: string[];
  detail: string;
}

interface StatusBody {
  runners: RunnerRow[];
  advice: { tier: string; reason: string; warning?: string };
  ramGB: number;
  catalogTags: Array<{ id: string; label: string; tier: string; license: string; ollamaTag: string; disk: number; notes: string }>;
}

const inputClass =
  "w-full rounded-lg border border-ink/15 bg-white/80 px-2 py-1.5 text-xs focus:border-accent focus:outline-none";

export function AiPanel({
  api,
  canInsertBlocks,
  onInsertBlocks,
  setStatus,
}: {
  api: Api;
  canInsertBlocks: boolean;
  onInsertBlocks: (blocks: Block[]) => void;
  setStatus: (s: string) => void;
}) {
  const [status, setLocal] = useState<StatusBody | null>(null);
  const [statusError, setStatusError] = useState("");
  const [settings, setSettings] = useState<AiSettings>(aiSettingsSchema.parse({}));
  const [task, setTask] = useState(AI_TASKS[0].id);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [textResult, setTextResult] = useState("");
  const [proposal, setProposal] = useState<{ ok: boolean; blocks: Block[]; issues: Array<{ level: string; message: string }> } | null>(null);

  useEffect(() => {
    api("/api/builder/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status" }) })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) return setStatusError(body.error || "AI status unavailable");
        setLocal(body);
        const firstUp = (body.runners as RunnerRow[]).find((r) => r.available);
        if (firstUp) {
          setSettings((s) => ({ ...s, runner: firstUp.id as AiSettings["runner"], model: firstUp.models[0] ?? s.model }));
        }
      })
      .catch((e) => setStatusError(String(e.message || e)));
  }, [api]);

  const activeRunner = status?.runners.find((r) => r.id === settings.runner);

  const run = async () => {
    setBusy(true);
    setTextResult("");
    setProposal(null);
    try {
      const res = await api("/api/builder/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run", task, input, settings }),
      });
      const body = await res.json();
      if (!res.ok) return setStatus(body.error || "AI task failed");
      if (body.kind === "blocks") {
        setProposal(body.proposal);
        setStatus(body.proposal.ok ? `Proposal ready (${body.tookMs} ms, ${body.model}) — review, then Insert` : "The model's output failed the gates — see issues");
      } else {
        setTextResult(body.text);
        setStatus(`Done in ${body.tookMs} ms (${body.model})`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-ink/10 p-3 text-xs">
      <h3 className="font-medium uppercase tracking-wide text-muted">Local AI (offline)</h3>

      {statusError ? <p className="text-accent">{statusError}</p> : null}
      {status ? (
        <>
          <div className="space-y-1">
            {status.runners.map((r) => (
              <p key={r.id}>
                {r.available ? "🟢" : "⚪"} <span className="font-medium">{r.id}</span>{" "}
                <span className="text-muted">{r.available ? `${r.models.length} model(s) · ${r.detail}` : r.detail}</span>
              </p>
            ))}
          </div>
          {!status.runners.some((r) => r.available) ? (
            <div className="rounded-lg bg-cream/80 p-2">
              <p className="font-medium">No local runner found.</p>
              <p className="mt-1 text-muted">
                Install <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline">Ollama</a> (free, runs on your machine), then e.g.{" "}
                <code className="rounded bg-white px-1">ollama pull qwen3:4b</code> (Apache-2.0, ~2.5 GB). Your machine: {status.ramGB} GB RAM → {status.advice.tier} tier. {status.advice.warning ?? ""}
              </p>
            </div>
          ) : null}
          <details>
            <summary className="cursor-pointer text-muted">Settings & model catalog</summary>
            <div className="mt-2 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Runner</span>
                  <select value={settings.runner} onChange={(e) => setSettings({ ...settings, runner: e.target.value as AiSettings["runner"] })} className={inputClass}>
                    <option value="ollama">ollama</option>
                    <option value="llamacpp">llama.cpp</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Model</span>
                  {activeRunner && activeRunner.models.length > 0 ? (
                    <select value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })} className={inputClass}>
                      {activeRunner.models.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input type="text" value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })} className={`${inputClass} font-mono`} />
                  )}
                </label>
              </div>
              {(
                [
                  { key: "temperature", label: "Temperature", min: 0, max: 2, step: 0.05 },
                  { key: "maxTokens", label: "Max tokens", min: 64, max: 8192, step: 64 },
                ] as const
              ).map((s) => (
                <label key={s.key} className="block">
                  <span className="flex justify-between"><span>{s.label}</span><span className="font-mono text-muted">{settings[s.key]}</span></span>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={settings[s.key]} onChange={(e) => setSettings({ ...settings, [s.key]: Number(e.target.value) })} className="w-full accent-ink" />
                </label>
              ))}
              <div className="max-h-32 overflow-y-auto rounded-lg bg-cream/60 p-2">
                {status.catalogTags.map((m) => (
                  <p key={m.id} className="mb-1">
                    <span className="font-medium">{m.label}</span> <span className="text-muted">({m.tier} tier · {m.license} · ~{m.disk} GB · <code>ollama pull {m.ollamaTag}</code>)</span>
                    <span className="block text-[11px] text-muted">{m.notes}</span>
                  </p>
                ))}
              </div>
            </div>
          </details>
        </>
      ) : statusError ? null : (
        <p className="text-muted">Checking runners…</p>
      )}

      {/* the task box */}
      <div className="space-y-1.5 border-t border-ink/10 pt-2">
        <select value={task} onChange={(e) => setTask(e.target.value)} className={inputClass} aria-label="AI task">
          {AI_TASKS.filter((t) => t.kind !== "blocks" || canInsertBlocks).map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="Describe what you want…" className={inputClass} aria-label="AI input" />
        <button type="button" disabled={busy || !input.trim()} onClick={run} className="rounded-full bg-ink px-4 py-1.5 text-cream disabled:opacity-40">
          {busy ? "Thinking… (local models take a moment)" : "Run"}
        </button>
      </div>

      {textResult ? (
        <div className="rounded-lg bg-white/70 p-2">
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-body">{textResult}</pre>
          <button type="button" onClick={() => navigator.clipboard.writeText(textResult)} className="mt-1 rounded-full border border-ink/20 px-2.5 py-0.5 text-[11px] hover:bg-cream">Copy</button>
        </div>
      ) : null}

      {proposal ? (
        <div className="rounded-lg bg-white/70 p-2">
          {proposal.ok ? (
            <>
              <p className="font-medium">✓ {proposal.blocks.length} block(s) passed the gates</p>
              <p className="text-muted">{proposal.blocks.map((b) => b.type).join(", ")}</p>
              <button
                type="button"
                onClick={() => {
                  onInsertBlocks(proposal.blocks);
                  setProposal(null);
                  setStatus("Inserted as a draft — review in the preview, then Save (gates run again)");
                }}
                className="mt-1 rounded-full bg-ink px-3 py-1 text-cream"
              >
                Insert into page
              </button>
            </>
          ) : (
            <>
              <p className="font-medium text-red-700">The gates refused this output:</p>
              <ul className="mt-1 space-y-0.5">
                {proposal.issues.map((i, n) => (
                  <li key={n} className={i.level === "error" ? "text-red-700" : "text-accent"}>{i.message}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
