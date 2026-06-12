"use client";

// ============================================================
// Media panel (plan §20) — drag a photo in, use it anywhere
// ============================================================
// The library view over /api/builder/media: a dropzone + file
// picker on top, a thumbnail grid below. Each item can be
// inserted as a new image block, set as the SELECTED image
// block's photo, copied as a path, or deleted. The server is the
// gate (sniffing, size cap, generated names) — this panel only
// reads bytes and reports honestly what the API said.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { newId, type Block } from "../schema/index.ts";
import { MAX_MEDIA_BYTES } from "../media/sniff.ts";

type Api = (input: string, init?: RequestInit) => Promise<Response>;

interface MediaFile {
  name: string;
  path: string;
  size?: number;
}

export interface MediaPanelProps {
  api: Api;
  /** True when a builder page is open (insert lands at its end). */
  canInsert: boolean;
  onInsertBlock: (block: Block) => void;
  /** Non-null when the currently selected block is an image: clicking
   *  "Use for selected" swaps that block's src. */
  onUseForSelected: ((path: string) => void) | null;
  setStatus: (s: string) => void;
}

function humanSize(bytes?: number): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** "moms-photo-1-abc123.jpg" → "moms photo 1" (a humane default alt). */
function defaultAlt(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/-[a-z0-9]{8,}$/, "") // drop the stamp+nonce tail
    .replace(/-/g, " ")
    .trim() || "photo";
}

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  // btoa in 32k chunks — large strings choke String.fromCharCode otherwise
  let bin = "";
  for (let i = 0; i < buf.length; i += 32768) {
    bin += String.fromCharCode(...buf.subarray(i, i + 32768));
  }
  return btoa(bin);
}

export function MediaPanel({ api, canInsert, onInsertBlock, onUseForSelected, setStatus }: MediaPanelProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [backend, setBackend] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const res = await api("/api/builder/media");
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || "Could not list media");
    const body = (await res.json()) as { backend: string; files: MediaFile[] };
    setFiles(body.files);
    setBackend(body.backend);
  }, [api]);

  useEffect(() => {
    refresh().catch((e) => setStatus(`Media: ${e.message}`));
  }, [refresh, setStatus]);

  const upload = async (picked: FileList | File[]) => {
    setBusy(true);
    let ok = 0;
    try {
      for (const file of Array.from(picked)) {
        if (file.size > MAX_MEDIA_BYTES) {
          setStatus(`"${file.name}" is over the ${MAX_MEDIA_BYTES / 1024 / 1024} MB cap — resize it first`);
          continue;
        }
        const res = await api("/api/builder/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: file.name, dataBase64: await fileToBase64(file) }),
        });
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          setStatus(`"${file.name}": ${body?.error || `upload failed (${res.status})`}`);
          continue;
        }
        ok++;
      }
      await refresh();
      if (ok > 0) setStatus(`Uploaded ${ok} photo${ok === 1 ? "" : "s"}${backend === "github" ? " — committed; it serves after the next deploy" : ""}`);
    } finally {
      setBusy(false);
    }
  };

  const removeFile = async (f: MediaFile) => {
    if (!window.confirm(`Delete ${f.name}? Pages that reference it will show a broken image.`)) return;
    const res = await api(`/api/builder/media?name=${encodeURIComponent(f.name)}`, { method: "DELETE" });
    if (!res.ok) {
      setStatus((await res.json().catch(() => null))?.error || "Delete failed");
      return;
    }
    setStatus(`Deleted ${f.name}`);
    await refresh();
  };

  return (
    <div className="space-y-3 rounded-xl border border-ink/10 p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Media library</h3>
        <span className="text-[11px] text-muted">{files.length} file{files.length === 1 ? "" : "s"}</span>
      </div>

      {/* dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void upload(e.dataTransfer.files);
        }}
        className={
          dragOver
            ? "rounded-xl border-2 border-dashed border-accent bg-accent/10 p-4 text-center text-xs"
            : "rounded-xl border-2 border-dashed border-ink/20 p-4 text-center text-xs text-muted"
        }
      >
        {busy ? (
          "Uploading…"
        ) : (
          <>
            Drag photos here, or{" "}
            <button type="button" onClick={() => inputRef.current?.click()} className="font-medium text-accent underline underline-offset-2">
              browse
            </button>
            <span className="mt-1 block text-[10px]">JPEG · PNG · GIF · WebP — up to {MAX_MEDIA_BYTES / 1024 / 1024} MB each</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {backend === "github" ? (
        <p className="rounded bg-accent/10 px-2 py-1 text-[11px]">
          Hosted mode: uploads commit to the repo and appear on the site after the next deploy — thumbnails below may 404 until then.
        </p>
      ) : null}

      {/* grid */}
      {files.length === 0 ? (
        <p className="text-xs text-muted">No photos yet — the first one you drop in lands in <code className="font-mono">/img/uploads/</code>.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {files.map((f) => (
            <li key={f.name} className="overflow-hidden rounded-lg border border-ink/10">
              <img src={f.path} alt={defaultAlt(f.name)} loading="lazy" className="aspect-square w-full bg-cream object-cover" />
              <div className="space-y-1 p-1.5">
                <p className="truncate text-[10px] text-muted" title={f.name}>
                  {f.name} {humanSize(f.size)}
                </p>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    disabled={!canInsert}
                    onClick={() =>
                      onInsertBlock({ id: newId(), type: "image", props: { src: f.path, alt: defaultAlt(f.name) } })
                    }
                    className="rounded-full border border-ink/20 px-2 py-0.5 text-[10px] hover:bg-cream disabled:opacity-40"
                    title={canInsert ? "Add an image block at the end of the page" : "Open a builder page first"}
                  >
                    + Insert
                  </button>
                  {onUseForSelected ? (
                    <button
                      type="button"
                      onClick={() => onUseForSelected(f.path)}
                      className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-cream"
                      title="Set this photo on the selected image block"
                    >
                      Use for selected
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(f.path);
                      setStatus(`Copied ${f.path}`);
                    }}
                    className="rounded-full border border-ink/20 px-2 py-0.5 text-[10px] hover:bg-cream"
                  >
                    Copy path
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeFile(f)}
                    className="rounded-full border border-red-300 px-2 py-0.5 text-[10px] text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
