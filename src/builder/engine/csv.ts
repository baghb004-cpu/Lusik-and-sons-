// CSV parsing for the csvTable block (INSPIRATION_ROADMAP P2) — the
// honest subset: commas, quoted fields with "" escapes, CRLF. Pure.
export function parseCsv(text: string, maxRows = 200, maxCols = 12): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const pushField = () => {
    if (row.length < maxCols) row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.some((c) => c.trim() !== "") && rows.length < maxRows) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") pushField();
    else if (c === "\n") pushRow();
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) pushRow();
  return rows;
}
