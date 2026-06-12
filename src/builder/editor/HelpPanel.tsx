"use client";

// ============================================================
// Help (roadmap #14 + #17) — the guide + keyboard shortcuts
// ============================================================
// One modal: a short, honest user guide for the Workshop's main
// flows and the full shortcut list. Opened from the "?" toolbar
// button or by pressing ? anywhere outside an input.
// ============================================================

const SHORTCUTS: Array<[string, string]> = [
  ["⌘/Ctrl + S", "Save the open document (runs the schema gate)"],
  ["⌘/Ctrl + Z", "Undo"],
  ["⌘/Ctrl + Y / ⇧⌘Z", "Redo"],
  ["Delete / Backspace", "Delete the selected block"],
  ["Alt + ↑ / ↓", "Move the selected block up / down"],
  ["Esc", "Deselect"],
  ["Click a block (canvas)", "Select it — the form opens on the right"],
  ["Double-click a block", "Select it and jump into its first form field"],
  ["?", "This help"],
];

const GUIDE: Array<[string, string]> = [
  ["Pages", "Documents on the left. “+ New page” starts blank or from a starter template; every save runs the same validators the build uses — invalid documents simply don't save."],
  ["Blocks", "“+ Add block” inserts at the end; drag in the tree to reorder. Select any block and edit it with the generated form — no JSON needed. Money-related blocks bind to the real catalog and can never invent a price."],
  ["Devices", "Desktop edits the base document. Switch to tablet/mobile to add per-device polish — those edits live in a separate layer and can never damage desktop. The Screens button previews dozens of real-world sizes and grades the layout."],
  ["Photos", "The 🖼 Media panel: drag images in, then “+ Insert” or “Use for selected”. Files land in /img/uploads and travel with every export."],
  ["Languages", "Languages live in builder/i18n.json. Translatable fields get a per-language editor (the ✏️ selector); exports write one full site per language with local fonts."],
  ["Look & feel", "The theme document drives colors, type, glass presets and Day/Night/Candlelight. The shared header/footer lives in builder/chrome.json and renders on every page."],
  ["Publishing", "Save → the document gates run. Export (static / PWA / Next / SwiftUI) writes a complete site to exports/. Backup/Restore and History cover mistakes — restores load as drafts and re-run the gates on save."],
];

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Help" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-cream p-5 shadow-float" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl">How the Workshop works</h2>
          <button type="button" onClick={onClose} aria-label="Close help" className="rounded-full border border-ink/20 px-2.5 py-0.5 text-sm hover:bg-white">✕</button>
        </div>
        <div className="space-y-2">
          {GUIDE.map(([title, body]) => (
            <div key={title} className="rounded-xl border border-ink/10 bg-white/60 p-3">
              <h3 className="text-sm font-medium">{title}</h3>
              <p className="mt-0.5 text-xs text-muted">{body}</p>
            </div>
          ))}
        </div>
        <h3 className="mb-1 mt-4 text-sm font-medium">Keyboard shortcuts</h3>
        <table className="w-full text-xs">
          <tbody>
            {SHORTCUTS.map(([keys, what]) => (
              <tr key={keys} className="border-t border-ink/10">
                <td className="whitespace-nowrap py-1 pr-3 font-mono">{keys}</td>
                <td className="py-1 text-muted">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
