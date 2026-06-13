// ============================================================
// Software Creation Mode (§31, Phase 2/3) — codegen + project build
// ============================================================
// Turns a SoftwareProject into a real file map you can export and run offline.
// Each "ready" preset has a generator that emits self-contained, CDN-free
// HTML/CSS (print-ready). Presets without a generator yet are listed honestly
// in the README as "preview — not buildable yet". Pure: no IO, no network.
// The UI ZIPs `buildProject(project).files` via a dynamic jszip import.
// ============================================================

import { getPreset } from "./registry.ts";
import type { FeatureInstance, SoftwareProject } from "./schemas.ts";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
function slug(s: string): string {
  return s.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "feature";
}
// Split a multiline/comma textarea answer into clean items.
function lines(v: unknown): string[] {
  return String(v ?? "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
}
function csvList(v: unknown): string[] {
  return String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}
const PAGE_CSS =
  "*{box-sizing:border-box}body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f5efe3;color:#1a1612}" +
  "main{max-width:760px;margin:0 auto;padding:24px}h1{font-size:1.6rem}@media print{body{background:#fff}.no-print{display:none}}";
// Self-contained HTML document — no external requests, ever.
function doc(title: string, body: string, extraCss = ""): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${PAGE_CSS}${extraCss}</style></head><body><main>${body}</main></body></html>`;
}

// Embed JSON in an inline <script> without letting "</script>" or "<" break out.
function embed(v: unknown): string {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}
// Self-contained HTML *app* (adds an inline script). No external requests.
function appDoc(title: string, body: string, js: string, extraCss = ""): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${PAGE_CSS}${extraCss}</style></head><body><main>${body}</main><script>${js}</script></body></html>`;
}

type Generator = (f: FeatureInstance) => Record<string, string>;

// --- per-preset generators -------------------------------------------------

const labelMaker: Generator = (f) => {
  const shape = String(f.options.shape ?? "rectangle");
  const title = esc(f.options.title ?? "Label");
  const radius = shape === "round" || shape === "oval" ? "50%" : shape === "square" ? "8px" : "10px";
  const wh = shape === "round" || shape === "square" ? "180px;height:180px" : "260px;height:150px";
  const label = `<div style="display:inline-flex;align-items:center;justify-content:center;text-align:center;border:2px solid #1a1612;border-radius:${radius};width:${wh};margin:8px;padding:10px;font-weight:600">${title}</div>`;
  const sheet = Array.from({ length: 8 }, () => label).join("");
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — labels</title><style>${PAGE_CSS}</style></head>` +
    `<body><main><h1 class="no-print">${title} — printable labels</h1><p class="no-print">Press Ctrl/Cmd+P to print or save as PDF. Edit the text in the source if you like — everything is offline.</p><div>${sheet}</div></main></body></html>`;
  return { [`${slug(f.label)}/index.html`]: html };
};

const recipeCard: Generator = (f) => {
  const dish = esc(f.options.dish ?? f.label);
  const servings = esc(f.options.servings ?? "");
  const html =
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${dish} — recipe card</title><style>${PAGE_CSS}.card{background:#fff;border:1px solid #e3d9c4;border-radius:16px;padding:24px}ul,ol{padding-left:20px}</style></head>` +
    `<body><main><div class="card"><h1>${dish}</h1>${servings ? `<p><strong>Servings:</strong> ${servings}</p>` : ""}` +
    `<h2>Ingredients</h2><ul><li>Add your ingredients here</li></ul>` +
    `<h2>Steps</h2><ol><li>Add your steps here</li></ol>` +
    `<p class="no-print" style="color:#7a7367">Edit this file to fill in ingredients and steps — it works offline and prints to PDF.</p></div></main></body></html>`;
  return { [`${slug(f.label)}/index.html`]: html };
};

const manualCreator: Generator = (f) => {
  const title = esc(f.options.title ?? f.label);
  const tools = lines(f.options.tools);
  const materials = lines(f.options.materials);
  const safety = lines(f.options.safety);
  const steps = lines(f.options.steps);
  const list = (items: string[]) => items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p><em>None listed.</em></p>";
  const body =
    `<h1>${title}</h1>` +
    (safety.length ? `<section class="warn"><h2>⚠️ Safety</h2><ul>${safety.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>` : "") +
    `<h2>Tools</h2>${list(tools)}` +
    `<h2>Materials</h2>${list(materials)}` +
    `<h2>Steps</h2>${steps.length ? `<ol>${steps.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : "<p><em>Add one step per line.</em></p>"}` +
    `<p class="no-print" style="color:#7a7367">Offline manual — edit this file freely; Ctrl/Cmd+P saves a PDF.</p>`;
  return { [`${slug(f.label)}/index.html`]: doc(`${title} — manual`, body, ".warn{background:#fff4e5;border:1px solid #f0c986;border-radius:12px;padding:12px 16px;margin:12px 0}ol li{margin:6px 0}") };
};

// CSI-style 3-part draft. Honest: it's a starting draft, not a stamped spec.
const specWriter: Generator = (f) => {
  const trade = esc(f.options.trade ?? "general");
  const project = esc(f.options.projectType ?? "Project");
  const scope = lines(f.options.scope);
  const sectionNo = ({ plumbing: "22 00 00", mechanical: "23 00 00", electrical: "26 00 00", "fire protection": "21 00 00", "fire sprinkler": "21 13 00", architecture: "09 00 00" } as Record<string, string>)[String(f.options.trade ?? "")] ?? "01 00 00";
  const body =
    `<h1 class="no-print">${trade} spec draft — ${project}</h1>` +
    `<p class="no-print warn">DRAFT ONLY. Verify every requirement against current codes and have a licensed professional review before use.</p>` +
    `<h2>Section ${sectionNo} — ${trade.toUpperCase()}</h2>` +
    `<h3>Part 1 — General</h3><p>1.1 Summary: Work of this section for ${project}.</p>` +
    (scope.length ? `<p>1.2 Scope:</p><ul>${scope.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p>1.2 Scope: [describe scope].</p>") +
    `<p>1.3 Submittals: Product data, shop drawings, and O&amp;M manuals as required.</p>` +
    `<h3>Part 2 — Products</h3><p>2.1 Acceptable manufacturers: [list]. 2.2 Materials: [specify per project requirements].</p>` +
    `<h3>Part 3 — Execution</h3><p>3.1 Installation per manufacturer instructions and applicable codes. 3.2 Testing and commissioning as required.</p>`;
  return {
    [`${slug(f.label)}/index.html`]: doc(`${project} — ${trade} spec`, body, ".warn{background:#fff4e5;border:1px solid #f0c986;border-radius:12px;padding:10px 14px}"),
    [`${slug(f.label)}/NOTES.md`]: `# ${project} — ${trade} spec draft\n\nThis is an auto-generated **draft** to start from. It is not a code-compliant or stamped specification. Review with a licensed professional and current local codes before issuing.\n`,
  };
};

const TRADE_PREFIX: Record<string, string> = { plumbing: "PLB", mechanical: "MEC", electrical: "ELE", "fire protection": "FP", "fire sprinkler": "FS", architecture: "ARC" };
const GOAL_CODE: Record<string, string> = { "clean drawing": "CLEAN", "hide background": "HIDEBG", "freeze layers": "FREEZE", "tag fixtures": "TAG", "prep for export": "PREP" };

// AutoCAD LISP routine. Generates real, commented .lsp you load with APPLOAD.
const lispCreator: Generator = (f) => {
  const trade = String(f.options.trade ?? "plumbing");
  const goal = String(f.options.goal ?? "clean drawing");
  const cmd = `${TRADE_PREFIX[trade] ?? "GEN"}${GOAL_CODE[goal] ?? "RUN"}`;
  const layers = csvList(f.options.layers);
  const layerLisp = layers.length ? `'(${layers.map((l) => `"${l.replace(/"/g, "")}"`).join(" ")})` : `'("A-WALL" "A-DOOR" "A-GLAZ" "A-FLOR")`;

  let bodyLisp: string;
  if (goal === "freeze layers" || goal === "hide background") {
    bodyLisp =
`  ;; Freeze the listed background layers so only your trade shows.
  (setq lays ${layerLisp})
  (foreach lay lays
    (if (tblsearch "LAYER" lay)
      (command "._-LAYER" "_Freeze" lay "")
      (princ (strcat "\\nLayer not found: " lay))
    )
  )
  (princ "\\nBackground layers frozen. UNDO to restore.")`;
  } else if (goal === "clean drawing") {
    bodyLisp =
`  ;; Purge unused items twice (nested), then audit & fix errors.
  (command "._-PURGE" "_All" "*" "_No")
  (command "._-PURGE" "_All" "*" "_No")
  (command "._AUDIT" "_Yes")
  (princ "\\nDrawing purged and audited.")`;
  } else if (goal === "prep for export") {
    bodyLisp =
`  ;; Set layer 0 current, purge, zoom extents — ready to export/plot.
  (command "._-LAYER" "_Set" "0" "")
  (command "._-PURGE" "_All" "*" "_No")
  (command "._ZOOM" "_Extents")
  (princ "\\nDrawing prepped for export.")`;
  } else {
    bodyLisp =
`  ;; TEMPLATE: fixture tagging is project-specific. Replace the block name
  ;; and attribute below with your title block / fixture tag, then extend.
  (alert "Fixture tagging is a template. Open routine.lsp and customize the block name and attributes for your project.")
  (princ "\\nReview routine.lsp to finish the fixture-tagging logic.")`;
  }

  const lisp =
`;;; ============================================================
;;; ${trade.toUpperCase()} — ${goal} routine
;;; Generated by Software Creation Mode (offline). REVIEW before running.
;;; Load: type APPLOAD, pick this file. Then type ${cmd} to run.
;;; Safety: run on a COPY first. UNDO reverses most actions.
;;; ============================================================
(defun c:${cmd} ( / lays lay )
${bodyLisp}
  (princ)
)
(princ "\\n${trade} ${goal} routine loaded — type ${cmd} to run.")
(princ)
`;
  const readme = `# ${trade} — ${goal} (AutoCAD LISP)\n\n1. In AutoCAD, type \`APPLOAD\` and select \`routine.lsp\`.\n2. Type \`${cmd}\` and press Enter.\n3. Always test on a **copy** of your drawing first. \`UNDO\` reverses most actions.\n\n_This routine is auto-generated. Read it before running on production drawings._\n`;
  return { [`${slug(f.label)}/routine.lsp`]: lisp, [`${slug(f.label)}/README.md`]: readme };
};

// Dynamo/Revit: an honest node-by-node PLAN you build in Dynamo (not a .dyn).
const dynamoCreator: Generator = (f) => {
  const trade = String(f.options.trade ?? "plumbing");
  const task = String(f.options.task ?? "auto-generate schedules");
  const PLANS: Record<string, string[]> = {
    "auto-generate schedules": ["Categories — pick the trade category (e.g. Plumbing Fixtures)", "All Elements of Category", "Element.GetParameterValueByName (Mark, Type, etc.)", "List.Create → Data.ExportExcel (or write to a Revit Schedule)"],
    "clean views": ["Views — select target views", "View.SetFilterOverrides / View.HideElements", "Categories → Element.OverrideColorInView (mute backgrounds)"],
    "filter backgrounds": ["Categories — link/background categories", "All Elements of Category in Active View", "Element.SetParameterByName 'Halftone' = true (or hide)"],
    "create fixture schedules": ["Category = your fixtures", "All Elements of Category", "GetParameterValueByName ×N → List.Transpose", "Data.ExportExcel / populate a Schedule"],
    "organize sheets": ["Sheets — collect all", "Sheet.SheetNumber / SheetName → sort", "Renumber via Sheet.SetParameterByName"],
  };
  const steps = PLANS[task] ?? ["Define inputs", "Collect elements", "Transform / read parameters", "Output to schedule or Excel"];
  const md =
`# Dynamo plan — ${trade}: ${task}\n\n**What this does (plain English):** automates "${task}" for ${trade} so you don't do it by hand. Build these nodes in Dynamo, left to right:\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n## Notes\n- This is a **node plan**, not a binary \`.dyn\` — Dynamo graphs are tied to your Revit version, so build it from these steps in Dynamo.\n- Test on a detached copy of the model first.\n- Save your graph and document the inputs for your team.\n`;
  return { [`${slug(f.label)}/dynamo-plan.md`]: md };
};

// Shared schedule builder: rows entered as "TAG | Description | Model/Notes".
function scheduleFiles(f: FeatureInstance, kind: string): Record<string, string> {
  const trade = esc(f.options.trade ?? "");
  const rows = lines(f.options.rows).map((r) => r.split("|").map((c) => c.trim()));
  const headers = ["Tag", "Description", "Model / Notes"];
  const thead = `<tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${headers.map((_, i) => `<td>${esc(r[i] ?? "")}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="3"><em>Add rows: TAG | Description | Model</em></td></tr>`;
  const html = doc(`${kind} schedule`, `<h1>${kind} schedule${trade ? ` — ${trade}` : ""}</h1><table>${thead}${tbody}</table><p class="no-print" style="color:#7a7367">Ctrl/Cmd+P to print. CSV included for spreadsheets.</p>`, "table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9bfa6;padding:6px 10px;text-align:left;font-size:.9rem}th{background:#efe7d4}");
  const csv = [headers.join(","), ...rows.map((r) => headers.map((_, i) => `"${String(r[i] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  return { [`${slug(f.label)}/schedule.html`]: html, [`${slug(f.label)}/schedule.csv`]: csv };
}

// Ordered submittal/cut-sheet package: cover + index + checklist.
const packageBuilder = (kind: string): Generator => (f) => {
  const project = esc(f.options.projectName ?? f.label);
  const items = lines(f.options.items);
  const idx = items.length ? `<ol>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : "<p><em>List one item per line (e.g. each product cut sheet).</em></p>";
  const body =
    `<h1>${kind}: ${project}</h1>` +
    `<p class="no-print">Cover + index for your ${kind.toLowerCase()}. Combine with the actual cut-sheet PDFs in this order.</p>` +
    `<h2>Index</h2>${idx}` +
    `<h2>Checklist</h2><ul>${["Cover sheet", "Index (this page)", "Product data / cut sheets in order", "Shop drawings (if any)", "Closeout / O&M (if required)"].map((c) => `<li>☐ ${c}</li>`).join("")}</ul>`;
  return { [`${slug(f.label)}/index.html`]: doc(`${project} — ${kind}`, body, "ol li,ul li{margin:4px 0}") };
};

// A standalone offline CRUD table app: add/delete rows, search, CSV export,
// persisted to the browser's localStorage. Used for the database + lookup
// presets. The runtime JS is plain ES5-ish so it runs anywhere offline.
const TABLE_APP_JS =
  "(function(){var COLS=__COLS__,KEY=__KEY__,rows;try{rows=JSON.parse(localStorage.getItem(KEY))||__SEED__;}catch(e){rows=__SEED__;}if(!Array.isArray(rows))rows=[];" +
  "function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}" +
  "function save(){try{localStorage.setItem(KEY,JSON.stringify(rows));}catch(e){}}" +
  "function render(){var q=(document.getElementById('q').value||'').toLowerCase();var th='<tr>'+COLS.map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'<th></th></tr>';" +
  "var body=rows.map(function(r,i){return{r:r,i:i};}).filter(function(o){return !q||COLS.some(function(c){return String(o.r[c]||'').toLowerCase().indexOf(q)>=0;});})" +
  ".map(function(o){return '<tr>'+COLS.map(function(c){return '<td>'+esc(o.r[c])+'</td>';}).join('')+'<td><button data-del=\"'+o.i+'\">remove</button></td></tr>';}).join('');" +
  "document.getElementById('tbl').innerHTML=th+body;}" +
  "function add(){var r={};COLS.forEach(function(c){r[c]=(document.getElementById('f_'+c).value||'');document.getElementById('f_'+c).value='';});rows.push(r);save();render();}" +
  "function exportCsv(){var lines=[COLS.join(',')].concat(rows.map(function(r){return COLS.map(function(c){return '\"'+String(r[c]||'').replace(/\"/g,'\"\"')+'\"';}).join(',');}));" +
  "var blob=new Blob([lines.join('\\n')],{type:'text/csv'});var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='data.csv';a.click();}" +
  "document.getElementById('add').onclick=add;document.getElementById('q').oninput=render;document.getElementById('csv').onclick=exportCsv;" +
  "document.getElementById('tbl').onclick=function(e){var d=e.target.getAttribute('data-del');if(d!=null){rows.splice(+d,1);save();render();}};render();})();";

function tableApp(title: string, cols: string[], seed: Array<Record<string, unknown>>, key: string): string {
  const form = cols.map((c) => `<input id="f_${esc(c)}" placeholder="${esc(c)}" style="margin:2px;padding:6px;border:1px solid #c9bfa6;border-radius:8px">`).join("");
  const body = `<h1>${esc(title)}</h1><p class="no-print">Runs offline in your browser. Data is saved on this device only.</p><div>${form}<button id="add">Add</button> <input id="q" placeholder="Search…" style="padding:6px"> <button id="csv">Export CSV</button></div><table id="tbl"></table>`;
  const js = TABLE_APP_JS.replace("__COLS__", embed(cols)).replace(/__KEY__/g, embed(key)).replace(/__SEED__/g, embed(seed));
  return appDoc(title, body, js, "table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #c9bfa6;padding:6px 10px;text-align:left;font-size:.9rem}th{background:#efe7d4}button{cursor:pointer;border:1px solid #1a1612;background:#1a1612;color:#f5efe3;border-radius:8px;padding:6px 10px}td button{background:none;color:#a33;border-color:#a33;padding:2px 6px;font-size:.75rem}");
}

const databaseBuilder: Generator = (f) => {
  const cols = csvList(f.options.columns);
  const real = cols.length ? cols : ["name", "notes"];
  return { [`${slug(f.label)}/index.html`]: tableApp(String(f.options.appName ?? f.label), real, [], `scm_db_${slug(f.label)}`) };
};

const lookupTable: Generator = (f) => {
  const seed = lines(f.options.pairs).map((ln) => { const [k, ...v] = ln.split("|"); return { key: (k ?? "").trim(), value: v.join("|").trim() }; });
  return { [`${slug(f.label)}/index.html`]: tableApp(String(f.options.tableName ?? f.label), ["key", "value"], seed, `scm_lookup_${slug(f.label)}`) };
};

// CSV/JSON importer: a standalone offline tool to open a file and view it.
const csvJsonImporter: Generator = (f) => {
  const js =
    "(function(){function esc(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];});}" +
    "function parseCsv(t){return t.split(/\\r?\\n/).filter(function(l){return l.length;}).map(function(l){return l.split(',').map(function(c){return c.replace(/^\"|\"$/g,'');});});}" +
    "function show(rows){var h=rows.length?('<tr>'+rows[0].map(function(c){return '<th>'+esc(c)+'</th>';}).join('')+'</tr>'):'';" +
    "var b=rows.slice(1).map(function(r){return '<tr>'+r.map(function(c){return '<td>'+esc(c)+'</td>';}).join('')+'</tr>';}).join('');document.getElementById('tbl').innerHTML=h+b;}" +
    "document.getElementById('file').onchange=function(e){var fl=e.target.files[0];if(!fl)return;var rd=new FileReader();rd.onload=function(){var t=rd.result;try{if(fl.name.match(/json$/i)){var d=JSON.parse(t);var arr=Array.isArray(d)?d:[d];var cols=Object.keys(arr[0]||{});show([cols].concat(arr.map(function(o){return cols.map(function(c){return o[c];});})));}else{show(parseCsv(t));}}catch(err){document.getElementById('tbl').innerHTML='<tr><td>Could not read file: '+esc(err.message)+'</td></tr>';}};rd.readAsText(fl);};})();";
  const body = `<h1>${esc(f.options.title ?? "CSV / JSON Importer")}</h1><p class="no-print">Open a .csv or .json file to view it as a table. Files never leave your device.</p><input type="file" id="file" accept=".csv,.json"><table id="tbl"></table>`;
  return { [`${slug(f.label)}/index.html`]: appDoc("CSV / JSON Importer", body, js, "table{border-collapse:collapse;width:100%;margin-top:12px}th,td{border:1px solid #c9bfa6;padding:6px 10px;text-align:left;font-size:.85rem}th{background:#efe7d4}") };
};

// Template filler: merge {{fields}} in a template with pasted rows (mail-merge).
const templateFiller: Generator = (f) => {
  const tpl = String(f.options.template ?? "Dear {{name}},\n\nThank you.\n");
  const js =
    "(function(){function esc(s){return String(s==null?'':s).replace(/[&<>]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}" +
    "document.getElementById('go').onclick=function(){var tpl=document.getElementById('tpl').value;var rows=document.getElementById('data').value.split(/\\r?\\n/).filter(function(l){return l.length;});" +
    "if(!rows.length){document.getElementById('out').textContent='Paste data: first line = field names (comma separated), then one row per line.';return;}" +
    "var cols=rows[0].split(',').map(function(c){return c.trim();});var out=rows.slice(1).map(function(line){var vals=line.split(',');var t=tpl;cols.forEach(function(c,i){t=t.split('{{'+c+'}}').join((vals[i]||'').trim());});return t;}).join('\\n\\n----------\\n\\n');" +
    "document.getElementById('out').textContent=out;};})();";
  const body = `<h1>${esc(f.options.title ?? "Template Filler")}</h1><p class="no-print">Merge a template with your data — all offline.</p>` +
    `<p>Template (use {{field}} placeholders):</p><textarea id="tpl" rows="6" style="width:100%">${esc(tpl)}</textarea>` +
    `<p>Data (first line = field names):</p><textarea id="data" rows="5" style="width:100%" placeholder="name,city&#10;Ana,LA&#10;Bo,NY"></textarea>` +
    `<p><button id="go">Fill template</button></p><pre id="out" style="white-space:pre-wrap;background:#fff;border:1px solid #e3d9c4;border-radius:12px;padding:12px"></pre>`;
  return { [`${slug(f.label)}/index.html`]: appDoc("Template Filler", body, js, "textarea{border:1px solid #c9bfa6;border-radius:8px;padding:8px;font-family:inherit}button{cursor:pointer;border:1px solid #1a1612;background:#1a1612;color:#f5efe3;border-radius:8px;padding:8px 14px}") };
};

// --- Business -------------------------------------------------------------

const pricingCalculator: Generator = (f) => {
  const rate = Number(f.options.hourlyRate ?? 25) || 25;
  const markup = Number(f.options.markupPct ?? 40) || 40;
  const js =
    "(function(){var R=__RATE__,M=__MARK__;function n(id){return +document.getElementById(id).value||0;}" +
    "function calc(){var mat=n('mat'),hrs=n('hrs'),rate=n('rate')||R,mk=n('mk');var cost=mat+hrs*rate;var price=cost*(1+mk/100);" +
    "document.getElementById('out').textContent='Cost: $'+cost.toFixed(2)+'   →   Suggested price: $'+price.toFixed(2);}" +
    "document.getElementById('rate').value=R;document.getElementById('mk').value=M;['mat','hrs','rate','mk'].forEach(function(id){document.getElementById(id).oninput=calc;});calc();})();";
  const row = (id: string, label: string) => `<label style="display:block;margin:6px 0">${label}<br><input id="${id}" type="number" step="0.01" style="padding:6px;border:1px solid #c9bfa6;border-radius:8px;width:160px"></label>`;
  const body = `<h1>${esc(f.options.title ?? "Pricing Calculator")}</h1>${row("mat", "Material cost ($)")}${row("hrs", "Labor hours")}${row("rate", "Hourly rate ($)")}${row("mk", "Markup (%)")}<p id="out" style="font-weight:600;font-size:1.1rem;margin-top:12px"></p><p class="no-print" style="color:#7a7367">Runs offline. Edit the file to change defaults.</p>`;
  return { [`${slug(f.label)}/index.html`]: appDoc("Pricing Calculator", body, js.replace("__RATE__", String(rate)).replace("__MARK__", String(markup))) };
};

const businessPlanner: Generator = (f) => {
  const name = esc(f.options.bizName ?? f.label);
  const idea = lines(f.options.idea);
  const goals = lines(f.options.goals);
  const sec = (h: string, items: string[], ph: string) => `<h2>${h}</h2>${items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p><em>${ph}</em></p>`}`;
  const body = `<h1>${name} — business plan</h1>` + sec("The idea", idea, "Describe what you sell and to whom.") + sec("Goals", goals, "What does success look like in 6–12 months?") +
    `<h2>Startup checklist</h2><ul>${["Name & branding", "Costs & pricing", "Suppliers", "Sales channels", "Licenses/permits (verify locally)", "First customers"].map((c) => `<li>☐ ${c}</li>`).join("")}</ul>`;
  return { [`${slug(f.label)}/index.html`]: doc(`${name} — plan`, body, "li{margin:4px 0}") };
};

const foodTruck: Generator = (f) => {
  const concept = esc(f.options.concept ?? f.label);
  const menu = lines(f.options.menu).map((l) => l.split("|").map((c) => c.trim()));
  const rows = menu.map((m) => `<tr><td>${esc(m[0] ?? "")}</td><td>${esc(m[1] ?? "")}</td></tr>`).join("") || "<tr><td colspan=2><em>Add: Item | Price</em></td></tr>";
  const body = `<h1>${concept} — food truck plan</h1>` +
    `<p class="no-print warn">Permits, health-department rules, taxes, insurance, and business licenses vary by location — verify all of these locally before operating.</p>` +
    `<h2>Menu</h2><table><tr><th>Item</th><th>Price</th></tr>${rows}</table>` +
    `<h2>Startup checklist</h2><ul>${["Truck / equipment", "Commissary kitchen", "Health permit (verify locally)", "Business license (verify locally)", "Insurance", "POS & payments (official processor only)", "Suppliers & prep schedule"].map((c) => `<li>☐ ${c}</li>`).join("")}</ul>`;
  return { [`${slug(f.label)}/index.html`]: doc(`${concept} — food truck`, body, "table{border-collapse:collapse;width:100%}th,td{border:1px solid #c9bfa6;padding:6px 10px;text-align:left}th{background:#efe7d4}.warn{background:#fff4e5;border:1px solid #f0c986;border-radius:12px;padding:10px 14px}li{margin:4px 0}") };
};

// --- Games ----------------------------------------------------------------

// Printable card sheet: "Name | Type | Stat | Text" rows → cut-and-print cards.
const cardSheet: Generator = (f) => {
  const cards = lines(f.options.cards).map((l) => l.split("|").map((c) => c.trim()));
  const cardHtml = cards.map((c) =>
    `<div class="card"><div class="ct">${esc(c[0] ?? "Card")}</div><div class="cs">${esc(c[1] ?? "")}${c[2] ? ` · ${esc(c[2])}` : ""}</div><div class="cb">${esc(c[3] ?? "")}</div></div>`,
  ).join("") || '<div class="card"><div class="ct">Add cards</div><div class="cb">One per line: Name | Type | Stat | Text</div></div>';
  const css = ".sheet{display:flex;flex-wrap:wrap;gap:8px}.card{width:180px;height:250px;border:2px solid #1a1612;border-radius:12px;padding:10px;display:flex;flex-direction:column}.ct{font-weight:700;font-size:1.05rem}.cs{font-size:.75rem;color:#7a7367;margin:2px 0 8px}.cb{font-size:.85rem;flex:1}";
  const body = `<h1 class="no-print">${esc(f.options.gameName ?? "Trading cards")}</h1><p class="no-print">Print on cardstock and cut. Offline.</p><div class="sheet">${cardHtml}</div>`;
  return { [`${slug(f.label)}/index.html`]: doc(`${esc(f.options.gameName ?? "Cards")} — print sheet`, body, css) };
};

const rulebook: Generator = (f) => {
  const name = esc(f.options.gameName ?? f.label);
  const secs = lines(f.options.sections);
  const body = `<h1>${name} — rule book</h1>` + (secs.length ? secs.map((s, i) => `<h2>${i + 1}. ${esc(s)}</h2><p>[Write this section.]</p>`).join("") : "<p><em>List one section title per line.</em></p>");
  return { [`${slug(f.label)}/index.html`]: doc(`${name} — rules`, body) };
};

// --- 3D design / export (real OBJ + ASCII STL, offline) -------------------

type Mesh = { verts: number[][]; tris: number[][] };
function boxMesh(w: number, h: number, d: number): Mesh {
  const x = w / 2, y = h / 2, z = d / 2;
  const verts = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
  const quads = [[4, 5, 6, 7], [1, 0, 3, 2], [0, 4, 7, 3], [5, 1, 2, 6], [3, 7, 6, 2], [0, 1, 5, 4]];
  const tris: number[][] = [];
  for (const q of quads) { tris.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]); }
  return { verts, tris };
}
function cylinderMesh(r: number, h: number, seg = 24): Mesh {
  const y = h / 2; const verts: number[][] = []; const tris: number[][] = [];
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; verts.push([Math.cos(a) * r, -y, Math.sin(a) * r], [Math.cos(a) * r, y, Math.sin(a) * r]); }
  const top = verts.push([0, y, 0]) - 1; const bot = verts.push([0, -y, 0]) - 1;
  for (let i = 0; i < seg; i++) { const a = (i * 2) % (seg * 2), b = ((i + 1) % seg) * 2; tris.push([a, b, a + 1], [b, b + 1, a + 1], [top, b + 1, a + 1], [bot, a, b]); }
  return { verts, tris };
}
function sphereMesh(r: number, st = 12, sl = 18): Mesh {
  const verts: number[][] = []; const tris: number[][] = [];
  for (let i = 0; i <= st; i++) { const phi = (i / st) * Math.PI; for (let j = 0; j <= sl; j++) { const th = (j / sl) * Math.PI * 2; verts.push([r * Math.sin(phi) * Math.cos(th), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(th)]); } }
  const row = sl + 1;
  for (let i = 0; i < st; i++) for (let j = 0; j < sl; j++) { const a = i * row + j; tris.push([a, a + 1, a + row], [a + 1, a + row + 1, a + row]); }
  return { verts, tris };
}
function meshFor(shape: string, dims: number[]): Mesh {
  if (shape === "cylinder") return cylinderMesh(dims[0] / 2, dims[1]);
  if (shape === "sphere") return sphereMesh(dims[0] / 2);
  return boxMesh(dims[0], dims[1], dims[2]);
}
function toObj(m: Mesh, name: string): string {
  return `# ${name} — generated offline by Software Creation Mode\n` +
    m.verts.map((v) => `v ${v[0]} ${v[1]} ${v[2]}`).join("\n") + "\n" +
    m.tris.map((t) => `f ${t[0] + 1} ${t[1] + 1} ${t[2] + 1}`).join("\n") + "\n";
}
function toStl(m: Mesh, name: string): string {
  const norm = (a: number[], b: number[], c: number[]) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / len, n[1] / len, n[2] / len];
  };
  let s = `solid ${name}\n`;
  for (const t of m.tris) {
    const a = m.verts[t[0]], b = m.verts[t[1]], c = m.verts[t[2]], n = norm(a, b, c);
    s += ` facet normal ${n[0]} ${n[1]} ${n[2]}\n  outer loop\n   vertex ${a.join(" ")}\n   vertex ${b.join(" ")}\n   vertex ${c.join(" ")}\n  endloop\n endfacet\n`;
  }
  return s + `endsolid ${name}\n`;
}
const design3d: Generator = (f) => {
  const shape = String(f.options.shape ?? "box");
  const dims = [Number(f.options.w ?? 40) || 40, Number(f.options.h ?? 40) || 40, Number(f.options.d ?? 40) || 40];
  const m = meshFor(shape, dims);
  const name = slug(f.label);
  const js =
    "(function(){var V=__V__,T=__T__;var cv=document.getElementById('cv'),ctx=cv.getContext('2d');var a=0.6,b=0.4,m=0.0001;" +
    "V.forEach(function(p){p.forEach(function(c){m=Math.max(m,Math.abs(c));});});" +
    "function R(p){var x=p[0],y=p[1],z=p[2];var cy=Math.cos(a),sy=Math.sin(a);var x1=x*cy-z*sy,z1=x*sy+z*cy;var cx=Math.cos(b),sx=Math.sin(b);return [x1,y*cx-z1*sx];}" +
    "function draw(){ctx.clearRect(0,0,cv.width,cv.height);var s=cv.width/2.6/m,ox=cv.width/2,oy=cv.height/2;ctx.strokeStyle='#1a1612';ctx.lineWidth=0.5;ctx.beginPath();" +
    "T.forEach(function(t){for(var i=0;i<3;i++){var p1=R(V[t[i]]),p2=R(V[t[(i+1)%3]]);ctx.moveTo(ox+p1[0]*s,oy-p1[1]*s);ctx.lineTo(ox+p2[0]*s,oy-p2[1]*s);}});ctx.stroke();}" +
    "cv.onpointermove=function(e){if(e.buttons){a+=e.movementX*0.01;b+=e.movementY*0.01;draw();}};setInterval(function(){a+=0.008;draw();},50);draw();})();";
  const body = `<h1 class="no-print">${esc(f.label)} — 3D preview</h1><p class="no-print">Drag to rotate. Files: <code>model.obj</code> and <code>model.stl</code> (open in any 3D/slicer app). Offline.</p><canvas id="cv" width="400" height="400" style="background:#fff;border:1px solid #e3d9c4;border-radius:12px;touch-action:none"></canvas>`;
  return {
    [`${name}/index.html`]: appDoc(`${esc(f.label)} — 3D`, body, js.replace("__V__", embed(m.verts)).replace("__T__", embed(m.tris))),
    [`${name}/model.obj`]: toObj(m, name),
    [`${name}/model.stl`]: toStl(m, name),
  };
};

// --- Embroidery (beginner cross-stitch chart; honest about machine files) --
const embroidery: Generator = (f) => {
  const title = esc(f.options.title ?? f.label);
  const w = Math.min(Math.max(Number(f.options.gridW ?? 30) || 30, 5), 120);
  const h = Math.min(Math.max(Number(f.options.gridH ?? 30) || 30, 5), 120);
  const count = Math.max(Number(f.options.count ?? 14) || 14, 6); // Aida count (holes/inch)
  let grid = "";
  for (let r = 0; r < h; r++) { let row = ""; for (let c = 0; c < w; c++) { const bold = (c % 10 === 0 ? " bl" : "") + (r % 10 === 0 ? " bt" : ""); row += `<td class="cell${bold}"></td>`; } grid += `<tr>${row}</tr>`; }
  const inW = (w / count).toFixed(1), inH = (h / count).toFixed(1);
  const body =
    `<h1 class="no-print">${title} — cross-stitch chart</h1>` +
    `<p class="no-print">A blank counted chart (${w}×${h}, bold lines every 10). Color in cells by hand or in any editor, then stitch. Ctrl/Cmd+P to print.</p>` +
    `<div class="info"><strong>Finished size</strong> on ${count}-count Aida: ~${inW}" × ${inH}". <strong>Max stitches:</strong> ${w * h}.</div>` +
    `<table class="chart">${grid}</table>` +
    `<h2 class="no-print">Thread list</h2><table class="threads"><tr><th>Symbol</th><th>Color / DMC #</th><th>Skeins</th></tr>${[1, 2, 3].map(() => "<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>").join("")}</table>` +
    `<div class="warn"><strong>Honest notes (read me):</strong><ul>` +
    `<li>This is a printable <em>counted cross-stitch chart</em> and planning sheet — a visual design, not a machine embroidery file.</li>` +
    `<li>Machine formats (PES/DST/EXP/JEF…) are version- and machine-specific and are <strong>not</strong> generated yet — that's a later phase.</li>` +
    `<li>Watch stitch density and hoop size: keep your design inside your hoop's stitchable area, and avoid very dense fills on thin fabric.</li>` +
    `</ul></div>`;
  const css = ".chart{border-collapse:collapse}.chart .cell{width:14px;height:14px;border:1px solid #d9cfb6}.chart .bl{border-left:2px solid #1a1612}.chart .bt{border-top:2px solid #1a1612}" +
    ".threads{border-collapse:collapse;margin-top:6px}.threads th,.threads td{border:1px solid #c9bfa6;padding:4px 10px}.threads th{background:#efe7d4}" +
    ".info{background:#eef5ee;border:1px solid #bcd6bc;border-radius:10px;padding:8px 12px;margin:8px 0}.warn{background:#fff4e5;border:1px solid #f0c986;border-radius:12px;padding:10px 14px;margin-top:12px}.warn li{margin:4px 0}";
  return { [`${slug(f.label)}/index.html`]: doc(`${title} — cross-stitch`, body, css) };
};

const boardGame: Generator = (f) => {
  const name = esc(f.options.gameName ?? f.label);
  const n = Math.min(Math.max(Number(f.options.gridSize ?? 8) || 8, 3), 16);
  let cells = "";
  for (let i = 0; i < n * n; i++) cells += `<div class="sq">${i + 1}</div>`;
  const css = `.board{display:grid;grid-template-columns:repeat(${n},1fr);gap:2px;max-width:600px;border:2px solid #1a1612}.sq{aspect-ratio:1;border:1px solid #c9bfa6;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:#7a7367}`;
  const body = `<h1 class="no-print">${name} — board</h1><p class="no-print">A ${n}×${n} printable board. Edit the file to theme it.</p><div class="board">${cells}</div>`;
  return { [`${slug(f.label)}/index.html`]: doc(`${name} — board`, body, css) };
};

const tokenDice: Generator = (f) => {
  const tokens = lines(f.options.tokens);
  const tHtml = tokens.map((t) => `<div class="tok">${esc(t)}</div>`).join("") || '<div class="tok">Token</div>';
  const table = lines(f.options.table);
  const tableHtml = table.length ? `<h2>Random table (d${table.length})</h2><ol>${table.map((x) => `<li>${esc(x)}</li>`).join("")}</ol>` : "";
  const body = `<h1 class="no-print">${esc(f.label)}</h1><p class="no-print">Print &amp; cut tokens.</p><div class="sheet">${tHtml}</div>${tableHtml}`;
  return { [`${slug(f.label)}/index.html`]: doc("Tokens & tables", body, ".sheet{display:flex;flex-wrap:wrap;gap:8px}.tok{width:70px;height:70px;border:2px solid #1a1612;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;font-size:.7rem}") };
};

const recipeBook: Generator = (f) => {
  const title = esc(f.options.bookTitle ?? f.label);
  const recipes = lines(f.options.recipes);
  const toc = recipes.length ? `<ol>${recipes.map((r, i) => `<li><a href="#r${i}">${esc(r)}</a></li>`).join("")}</ol>` : "<p><em>List one recipe title per line.</em></p>";
  const pages = recipes.map((r, i) => `<section id="r${i}" style="page-break-before:always"><h2>${esc(r)}</h2><h3>Ingredients</h3><ul><li>…</li></ul><h3>Steps</h3><ol><li>…</li></ol></section>`).join("");
  return { [`${slug(f.label)}/index.html`]: doc(`${title} — recipe book`, `<h1>${title}</h1><h2>Contents</h2>${toc}${pages}`) };
};

const GENERATORS: Record<string, Generator> = {
  "label-maker": labelMaker,
  "recipe-card": recipeCard,
  "recipe-book": recipeBook,
  "manual-creator": manualCreator,
  "spec-writer": specWriter,
  "lisp-creator": lispCreator,
  "dynamo-creator": dynamoCreator,
  "fixture-schedule": (f) => scheduleFiles(f, "Fixture"),
  "equipment-schedule": (f) => scheduleFiles(f, "Equipment"),
  "cut-sheet": packageBuilder("Cut Sheet Package"),
  "submittal-package": packageBuilder("Submittal Package"),
  "database-builder": databaseBuilder,
  "lookup-table": lookupTable,
  "csv-json-importer": csvJsonImporter,
  "template-filler": templateFiller,
  "pricing-calculator": pricingCalculator,
  "small-business-planner": businessPlanner,
  "inventory-tracker": (f) => ({ [`${slug(f.label)}/index.html`]: tableApp(String(f.options.appName ?? f.label), ["item", "quantity", "reorder at", "notes"], [], `scm_inv_${slug(f.label)}`) }),
  "customer-folders": (f) => ({ [`${slug(f.label)}/index.html`]: tableApp(String(f.options.appName ?? f.label), ["name", "phone", "email", "notes"], [], `scm_cust_${slug(f.label)}`) }),
  "printable-package": packageBuilder("Printable Package"),
  "food-truck": foodTruck,
  "tcg-maker": cardSheet,
  "card-template": cardSheet,
  "rulebook-maker": rulebook,
  "board-game-maker": boardGame,
  "token-dice": tokenDice,
  "qa-generator": (f) => ({ [`${slug(f.label)}/index.html`]: tableApp(String(f.options.title ?? f.label), ["question", "answer", "tags"], [], `scm_qa_${slug(f.label)}`) }),
  "knowledge-pack": (f) => ({ [`${slug(f.label)}/index.html`]: tableApp(String(f.options.title ?? f.label), ["topic", "content", "tags"], [], `scm_kp_${slug(f.label)}`) }),
  "design-3d": design3d,
  "embroidery": embroidery,
};

export function hasGenerator(presetId: string): boolean {
  return presetId in GENERATORS;
}

export function generateFeature(feature: FeatureInstance): Record<string, string> {
  const gen = GENERATORS[feature.presetId];
  return gen ? gen(feature) : {};
}

// --- whole-project build (the export manifest lives here) -------------------

export interface ProjectBuild {
  files: Record<string, string>;
  manifest: { name: string; generatedAt: string; features: Array<{ id: string; preset: string; built: boolean }>; exportTargets: string[] };
  warnings: string[];
}

export function buildProject(project: SoftwareProject): ProjectBuild {
  const files: Record<string, string> = {};
  const warnings: string[] = [];
  const manifestFeatures: ProjectBuild["manifest"]["features"] = [];
  const entries: Array<{ label: string; path: string }> = [];

  for (const f of project.features) {
    const preset = getPreset(f.presetId);
    // Export-category presets are packaging toggles — handled below, never warned.
    if (preset && preset.categoryId === "export") {
      manifestFeatures.push({ id: f.instanceId, preset: f.presetId, built: true });
      continue;
    }
    const built = hasGenerator(f.presetId);
    manifestFeatures.push({ id: f.instanceId, preset: f.presetId, built });
    if (built) {
      const out = generateFeature(f);
      Object.assign(files, out);
      const entry = Object.keys(out).find((p) => p.endsWith(".html")) ?? Object.keys(out)[0];
      if (entry) entries.push({ label: f.label, path: entry });
    } else {
      warnings.push(`"${f.label}" is preview-stage — it isn't buildable yet, so it was skipped.`);
    }
  }

  // --- packaging from selected export targets ---
  const targets = project.exportTargets;
  if (targets.includes("static-site") || targets.includes("thumb-drive")) {
    files["index.html"] = launcherHtml(project, entries);
    if (targets.includes("thumb-drive")) files["START-HERE.txt"] = "Open index.html in any web browser. Everything runs offline — no internet needed.\n";
  }
  if (targets.includes("web-app")) files["manifest.webmanifest"] = webManifest(project);
  if (targets.includes("raspberry-pi")) {
    files["raspberry-pi/start.sh"] = PI_START;
    files["raspberry-pi/README.md"] = PI_README;
  }

  const manifest = {
    name: project.name,
    generatedAt: new Date().toISOString(),
    features: manifestFeatures,
    exportTargets: project.exportTargets,
  };
  files["manifest.json"] = JSON.stringify(manifest, null, 2);
  files["README.md"] = readme(project, manifestFeatures, warnings);
  return { files, manifest, warnings };
}

function launcherHtml(project: SoftwareProject, entries: Array<{ label: string; path: string }>): string {
  const links = entries.length
    ? entries.map((e) => `<li><a href="${esc(e.path)}">${esc(e.label)}</a></li>`).join("")
    : "<li><em>No buildable tools yet — add some features and build again.</em></li>";
  return doc(project.name, `<h1>${esc(project.name)}</h1><p>Everything here runs offline. Open a tool:</p><ul class="menu">${links}</ul>`, ".menu{list-style:none;padding:0}.menu li{margin:8px 0}.menu a{display:block;padding:12px 16px;background:#fff;border:1px solid #e3d9c4;border-radius:12px;text-decoration:none;color:#1a1612;font-weight:600}");
}

function webManifest(project: SoftwareProject): string {
  return JSON.stringify({ name: project.name, short_name: project.name.slice(0, 12), start_url: "./index.html", display: "standalone", background_color: "#f5efe3", theme_color: "#1a1612", icons: [] }, null, 2);
}

const PI_START =
`#!/usr/bin/env bash
# Raspberry Pi 5 launcher — opens this project full-screen (kiosk) in Chromium.
# Make executable: chmod +x raspberry-pi/start.sh   Then run: ./raspberry-pi/start.sh
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
URL="file://$DIR/index.html"
if command -v chromium-browser >/dev/null 2>&1; then
  exec chromium-browser --kiosk --noerrdialogs --disable-infobars "$URL"
elif command -v chromium >/dev/null 2>&1; then
  exec chromium --kiosk --noerrdialogs --disable-infobars "$URL"
else
  echo "Install Chromium:  sudo apt install -y chromium-browser"
  exit 1
fi
`;

const PI_README =
`# Run on Raspberry Pi 5

This project is a set of offline web pages — perfect for a Pi 5 with a touchscreen.

## Quick start
1. Copy this whole folder onto the Pi (USB drive or \`scp\`).
2. \`chmod +x raspberry-pi/start.sh\`
3. \`./raspberry-pi/start.sh\` — opens full-screen in Chromium (kiosk mode).

## Auto-start on boot (optional)
Add the script to \`~/.config/lxsession/LXDE-pi/autostart\` or a systemd user service.

## Notes & limits
- 100% offline — no internet required.
- Touchscreen friendly; works on Pi OS (ARM64).
- Lightweight: plain HTML/CSS/JS, no heavy runtime. Storage: a few MB. RAM: minimal.
- Not for Pi: features needing desktop CAD (AutoCAD LISP / Revit-Dynamo) — those
  exports are meant for a Windows CAD workstation, not the Pi itself.
`;

function readme(project: SoftwareProject, feats: ProjectBuild["manifest"]["features"], warnings: string[]): string {
  const builtList = feats.filter((f) => f.built).map((f) => `- ${getPreset(f.preset)?.name ?? f.preset} → \`${slug(project.features.find((x) => x.instanceId === f.id)!.label)}/index.html\``);
  const skipped = feats.filter((f) => !f.built).map((f) => `- ${getPreset(f.preset)?.name ?? f.preset} (preview — not buildable yet)`);
  return [
    `# ${project.name}`,
    "",
    "Built offline with Software Creation Mode. Everything here runs locally — open the HTML files in any browser, no internet needed.",
    "",
    "## Included",
    builtList.length ? builtList.join("\n") : "_Nothing buildable yet._",
    skipped.length ? `\n## Coming later\n${skipped.join("\n")}` : "",
    warnings.length ? `\n## Notes\n${warnings.map((w) => `- ${w}`).join("\n")}` : "",
    "",
    `Export targets selected: ${project.exportTargets.join(", ") || "none"}.`,
    "",
    "_Never stores payment card data. For payments, use an official processor (Square/Clover/Stripe)._",
  ].filter(Boolean).join("\n");
}
