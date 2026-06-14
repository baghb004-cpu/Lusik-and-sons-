// Zip packaging for backups + export downloads (Phase 12). jszip (MIT).

import JSZip from "jszip";

export interface ZipEntry {
  path: string;
  content: string;
}

export async function zipFiles(files: ZipEntry[]): Promise<Buffer> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.content);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export async function unzipFiles(buffer: Buffer | ArrayBuffer): Promise<ZipEntry[]> {
  const zip = await JSZip.loadAsync(buffer);
  const out: ZipEntry[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    out.push({ path, content: await entry.async("string") });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
