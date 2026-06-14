// Page-weight estimate (INSPIRATION_ROADMAP P2): which media files a
// page references, what they sum to, and an honest verdict. Pure —
// the Audit panel feeds it the media list from the API.
export interface MediaFileInfo { name: string; path: string; size?: number }

export const PAGE_WEIGHT_BUDGET_BYTES = 1.5 * 1024 * 1024;

export function pageWeight(pageJson: unknown, files: MediaFileInfo[]): { bytes: number; refs: MediaFileInfo[]; over: boolean } {
  const text = JSON.stringify(pageJson);
  const refs = files.filter((f) => text.includes(f.path));
  const bytes = refs.reduce((sum, f) => sum + (f.size ?? 0), 0);
  return { bytes, refs, over: bytes > PAGE_WEIGHT_BUDGET_BYTES };
}
