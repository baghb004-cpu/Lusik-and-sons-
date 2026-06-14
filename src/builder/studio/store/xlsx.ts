// ============================================================
// Store Manager — minimal XLSX generator (pure, §30 Phase 5)
// ============================================================
// Builds a valid single/multi-sheet .xlsx as a map of archive members
// (the UI zips them with jszip — already a dep — so no new library).
// Uses inline strings + numeric cells. Excel / Numbers / Sheets open it.
// ============================================================

export interface Sheet {
  name: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}

const xesc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** 0 → A, 25 → Z, 26 → AA … (spreadsheet column letters). */
export function colLetter(i: number): string {
  let s = "";
  i += 1;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

function cell(ref: string, v: string | number): string {
  if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xesc(String(v ?? ""))}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const rows: string[] = [];
  const all = [sheet.headers, ...sheet.rows];
  all.forEach((row, r) => {
    const cells = row.map((v, c) => cell(`${colLetter(c)}${r + 1}`, v)).join("");
    rows.push(`<row r="${r + 1}">${cells}</row>`);
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.join("")}</sheetData></worksheet>`;
}

/** Sanitize a sheet name to Excel's rules (≤31 chars, no []:*?/\\). */
const safeName = (s: string, i: number) => (s.replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31) || `Sheet${i + 1}`);

/** Return the .xlsx archive as path → content (feed to jszip). */
export function xlsxParts(sheets: Sheet[]): Record<string, string> {
  const list = sheets.length ? sheets : [{ name: "Sheet1", headers: [], rows: [] }];
  const overrides = list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const sheetTags = list.map((s, i) => `<sheet name="${xesc(safeName(s.name, i))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
  const rels = list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("");

  const files: Record<string, string> = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`,
  };
  list.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s); });
  return files;
}
