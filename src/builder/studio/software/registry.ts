// ============================================================
// Software Creation Mode (§31) — preset registry (pure data)
// ============================================================
// The whole taxonomy as typed rows: six categories + subcategories and every
// preset card. Adding a tool = adding a row here; the shell never changes.
// `status` is the feature flag: "ready" = working codegen, "preview" = partial,
// "planned" = scaffolds a feature + passes health checks but codegen lands in a
// later phase. Validated against schemas.ts at module load (see assertRegistry).
// ============================================================

import { type Category, type Preset, categorySchema, presetSchema } from "./schemas.ts";

export const CATEGORIES: Category[] = [
  { id: "creative", name: "Creative Tools", icon: "🎨", blurb: "Make things to print, label, cook from, or hand out.", subcategories: [{ id: "make", name: "Makers" }, { id: "print", name: "Printables" }] },
  { id: "business", name: "Business Tools", icon: "💼", blurb: "Run and plan a small business, offline.", subcategories: [{ id: "plan", name: "Planning" }, { id: "track", name: "Tracking" }] },
  { id: "games", name: "Game Creation Tools", icon: "🎲", blurb: "Build card games, board games, and the pieces.", subcategories: [{ id: "cards", name: "Cards" }, { id: "board", name: "Boards & pieces" }] },
  { id: "trade", name: "Construction / Trade Tools", icon: "🛠️", blurb: "Specs, schedules, and drafting automation for the trades.", subcategories: [{ id: "docs", name: "Documents" }, { id: "automation", name: "Automation" }] },
  { id: "data", name: "Data / Local Assistant Tools", icon: "🗂️", blurb: "Organize local information into clean, searchable tables.", subcategories: [{ id: "store", name: "Storage" }, { id: "import", name: "Import / fill" }] },
  { id: "export", name: "Export Tools", icon: "📤", blurb: "Turn your project into something you can run or share.", subcategories: [{ id: "run", name: "Runnable" }, { id: "file", name: "Files" }] },
];

// Helper so each row is concise; schema defaults fill the rest.
function p(row: Partial<Preset> & Pick<Preset, "id" | "name" | "blurb" | "categoryId">): Preset {
  return presetSchema.parse(row);
}

export const PRESETS: Preset[] = [
  // 1) Creative ------------------------------------------------------------
  p({ id: "label-maker", name: "Make Labels", icon: "🏷️", blurb: "Pantry, spice, jar, file, shipping — pick a shape, type the words, print.", categoryId: "creative", subcategoryId: "print", status: "ready", exports: ["pdf", "image", "static-site"], creates: ["A label editor screen", "Label-size templates", "A printable sheet layout", "PDF/PNG/SVG export"], questions: [
    { key: "shape", label: "Label shape", type: "choice", required: true, choices: ["round", "square", "rectangle", "oval"], help: "You can change this later.", },
    { key: "title", label: "What goes on the label?", type: "text", required: true, choices: [], help: "" },
  ] }),
  p({ id: "embroidery", name: "Make Embroidery", icon: "🪡", blurb: "Bibs, names, monograms, the Armenian alphabet — design and preview stitches.", categoryId: "creative", subcategoryId: "make", status: "planned", needsData: true, exports: ["image", "pdf", "source"], creates: ["A stitch design canvas", "Thread color palette", "Hoop & density checks", "Stitch preview"] }),
  p({ id: "recipe-card", name: "Make a Recipe Card", icon: "🍳", blurb: "One pretty card: ingredients, steps, times, allergens — print or share.", categoryId: "creative", subcategoryId: "print", status: "ready", exports: ["pdf", "image", "static-site"], creates: ["A recipe form", "A printable card layout", "Allergen & diet tags", "PDF/PNG export"], questions: [
    { key: "dish", label: "Dish name", type: "text", required: true, choices: [], help: "" },
    { key: "servings", label: "Servings", type: "number", required: false, choices: [], help: "" },
  ] }),
  p({ id: "recipe-book", name: "Make a Recipe Book", icon: "📖", blurb: "Collect many recipes into a book with a table of contents.", categoryId: "creative", subcategoryId: "print", status: "planned", dependsOn: ["recipe-card"], exports: ["pdf", "static-site", "web-app"], creates: ["A recipe library", "Chapters / table of contents", "A book PDF"] }),
  p({ id: "manual-creator", name: "Make a Manual", icon: "📘", blurb: "Step-by-step guides with tools, materials, safety notes, and diagrams.", categoryId: "creative", subcategoryId: "make", status: "ready", exports: ["pdf", "static-site", "image"], creates: ["A step editor", "Tool & material lists", "Safety warnings", "A printable manual"], questions: [
    { key: "title", label: "Manual title", type: "text", required: true, choices: [], help: "" },
    { key: "steps", label: "Steps (one per line)", type: "longtext", required: true, choices: [], help: "Each line becomes a numbered step." },
    { key: "tools", label: "Tools (one per line)", type: "longtext", required: false, choices: [], help: "" },
    { key: "materials", label: "Materials (one per line)", type: "longtext", required: false, choices: [], help: "" },
    { key: "safety", label: "Safety warnings (one per line)", type: "longtext", required: false, choices: [], help: "" },
  ] }),
  p({ id: "design-3d", name: "Make a 3D Design", icon: "🧊", blurb: "Simple 3D objects, 3D text, and exploded diagrams you can export.", categoryId: "creative", subcategoryId: "make", status: "planned", pi: true, exports: ["model-3d", "image", "web-app"], creates: ["A 3D scene", "Web preview", "GLB/OBJ/STL export"] }),

  // 2) Business ------------------------------------------------------------
  p({ id: "food-truck", name: "Make a Food Truck Plan", icon: "🚚", blurb: "Menu, costs, prep schedule, checklists — a starter plan for a food business.", categoryId: "business", subcategoryId: "plan", status: "ready", exports: ["pdf", "static-site", "database"], creates: ["A menu table", "Startup checklist", "A local-rules disclaimer (verify permits locally)"], questions: [
    { key: "concept", label: "Concept / truck name", type: "text", required: true, choices: [], help: "" },
    { key: "menu", label: "Menu — one per line: Item | Price", type: "longtext", required: false, choices: [], help: "" },
  ] }),
  p({ id: "small-business-planner", name: "Make a Business Plan", icon: "📊", blurb: "A simple plan: idea, costs, prices, goals, and a checklist.", categoryId: "business", subcategoryId: "plan", status: "ready", exports: ["pdf", "static-site"], creates: ["An idea & goals plan", "A startup checklist", "A printable plan"], questions: [
    { key: "bizName", label: "Business name", type: "text", required: true, choices: [], help: "" },
    { key: "idea", label: "The idea (one point per line)", type: "longtext", required: false, choices: [], help: "" },
    { key: "goals", label: "Goals (one per line)", type: "longtext", required: false, choices: [], help: "" },
  ] }),
  p({ id: "inventory-tracker", name: "Track Inventory", icon: "📦", blurb: "Items, counts, low-stock alerts — a running list you can edit.", categoryId: "business", subcategoryId: "track", status: "ready", exports: ["database", "static-site", "web-app"], creates: ["An items app (item/qty/reorder/notes)", "Search", "CSV export"], questions: [
    { key: "appName", label: "Tracker name", type: "text", required: true, choices: [], help: "" },
  ] }),
  p({ id: "pricing-calculator", name: "Make a Pricing Calculator", icon: "🧮", blurb: "Add up materials, time, and markup to get a fair price.", categoryId: "business", subcategoryId: "plan", status: "ready", exports: ["static-site", "web-app", "pdf"], creates: ["An offline calculator (materials + time + markup)", "A suggested price"], questions: [
    { key: "hourlyRate", label: "Default hourly rate ($)", type: "number", required: false, choices: [], help: "" },
    { key: "markupPct", label: "Default markup (%)", type: "number", required: false, choices: [], help: "" },
  ] }),
  p({ id: "customer-folders", name: "Make a Customer Folder System", icon: "🗃️", blurb: "A tidy place for each customer's notes, orders, and files — local only.", categoryId: "business", subcategoryId: "track", status: "ready", exports: ["database", "web-app"], creates: ["A customers app (name/phone/email/notes)", "Search", "CSV export"], questions: [
    { key: "appName", label: "System name", type: "text", required: true, choices: [], help: "" },
  ] }),
  p({ id: "printable-package", name: "Make a Printable Package", icon: "🖨️", blurb: "Bundle several printables into one ready-to-print set.", categoryId: "business", subcategoryId: "plan", status: "ready", exports: ["pdf", "image"], creates: ["A package cover & index", "A print checklist"], questions: [
    { key: "projectName", label: "Package name", type: "text", required: true, choices: [], help: "" },
    { key: "items", label: "Items — one per line", type: "longtext", required: true, choices: [], help: "" },
  ] }),

  // 3) Games ---------------------------------------------------------------
  p({ id: "tcg-maker", name: "Make a Trading Card Game", icon: "🃏", blurb: "Design cards with stats, build a deck, and get printable sheets.", categoryId: "games", subcategoryId: "cards", status: "ready", exports: ["pdf", "image", "static-site"], creates: ["Print-and-cut card sheets", "Card stats layout"], questions: [
    { key: "gameName", label: "Game name", type: "text", required: false, choices: [], help: "" },
    { key: "cards", label: "Cards — one per line: Name | Type | Stat | Text", type: "longtext", required: true, choices: [], help: "" },
  ] }),
  p({ id: "board-game-maker", name: "Make a Board Game", icon: "🎯", blurb: "Lay out a board, tokens, and rules for a printable board game.", categoryId: "games", subcategoryId: "board", status: "ready", exports: ["pdf", "image"], creates: ["A printable grid board", "A setup to theme"], questions: [
    { key: "gameName", label: "Game name", type: "text", required: false, choices: [], help: "" },
    { key: "gridSize", label: "Board size (squares per side, 3–16)", type: "number", required: false, choices: [], help: "" },
  ] }),
  p({ id: "rulebook-maker", name: "Make a Rule Book", icon: "📕", blurb: "Write clear game rules with sections, examples, and a contents page.", categoryId: "games", subcategoryId: "board", status: "ready", exports: ["pdf", "static-site"], creates: ["A sectioned rule book", "A printable layout"], questions: [
    { key: "gameName", label: "Game name", type: "text", required: false, choices: [], help: "" },
    { key: "sections", label: "Section titles — one per line", type: "longtext", required: true, choices: [], help: "" },
  ] }),
  p({ id: "card-template", name: "Make a Card Template", icon: "🎴", blurb: "Design one reusable card frame for characters, items, or abilities.", categoryId: "games", subcategoryId: "cards", status: "ready", exports: ["image", "pdf", "source"], creates: ["A reusable card frame", "A print sheet"], questions: [
    { key: "gameName", label: "Set name", type: "text", required: false, choices: [], help: "" },
    { key: "cards", label: "Cards — one per line: Name | Type | Stat | Text", type: "longtext", required: true, choices: [], help: "" },
  ] }),
  p({ id: "token-dice", name: "Make Tokens & Dice Tables", icon: "🎰", blurb: "Generate tokens and random tables for any game.", categoryId: "games", subcategoryId: "board", status: "ready", exports: ["pdf", "image"], creates: ["A printable token sheet", "A random table"], questions: [
    { key: "tokens", label: "Tokens — one per line", type: "longtext", required: true, choices: [], help: "" },
    { key: "table", label: "Random table entries — one per line (optional)", type: "longtext", required: false, choices: [], help: "" },
  ] }),

  // 4) Trade ---------------------------------------------------------------
  p({ id: "spec-writer", name: "Write a Spec", icon: "📝", blurb: "Pick a trade and project, answer questions, get a clean draft spec package.", categoryId: "trade", subcategoryId: "docs", status: "ready", exports: ["pdf", "static-site", "source"], creates: ["A trade & project picker", "A guided spec form", "A draft spec document (review with a pro)"], questions: [
    { key: "trade", label: "Trade", type: "choice", required: true, choices: ["plumbing", "mechanical", "electrical", "fire protection", "fire sprinkler", "architecture", "general"], help: "" },
    { key: "projectType", label: "Project name / type", type: "text", required: true, choices: [], help: "" },
    { key: "scope", label: "Scope items (one per line)", type: "longtext", required: false, choices: [], help: "" },
  ] }),
  p({ id: "fixture-schedule", name: "Make a Fixture Schedule", icon: "🚿", blurb: "Build a plumbing/equipment fixture schedule from simple inputs.", categoryId: "trade", subcategoryId: "docs", status: "ready", exports: ["pdf", "database", "source"], creates: ["A fixtures table", "A formatted schedule", "CSV/PDF export"], questions: [
    { key: "trade", label: "Trade (optional)", type: "text", required: false, choices: [], help: "" },
    { key: "rows", label: "Rows — one per line: TAG | Description | Model/Notes", type: "longtext", required: true, choices: [], help: "e.g. P-1 | Water closet | American Standard 2234" },
  ] }),
  p({ id: "equipment-schedule", name: "Make an Equipment Schedule", icon: "🌡️", blurb: "Tag and schedule mechanical/electrical equipment.", categoryId: "trade", subcategoryId: "docs", status: "ready", exports: ["pdf", "database", "source"], creates: ["An equipment table", "A formatted schedule", "CSV/PDF export"], questions: [
    { key: "trade", label: "Trade (optional)", type: "text", required: false, choices: [], help: "" },
    { key: "rows", label: "Rows — one per line: TAG | Description | Model/Notes", type: "longtext", required: true, choices: [], help: "e.g. AHU-1 | Air handler | Trane 25-ton" },
  ] }),
  p({ id: "cut-sheet", name: "Make a Cut Sheet Package", icon: "📎", blurb: "Collect product cut sheets into one ordered submittal-style package.", categoryId: "trade", subcategoryId: "docs", status: "ready", exports: ["pdf", "source"], creates: ["A cut-sheet list", "An ordered package index", "A print checklist"], questions: [
    { key: "projectName", label: "Project name", type: "text", required: true, choices: [], help: "" },
    { key: "items", label: "Items — one per line", type: "longtext", required: true, choices: [], help: "Each product/cut sheet on its own line, in order." },
  ] }),
  p({ id: "submittal-package", name: "Make a Submittal Package", icon: "📦", blurb: "Assemble a trade submittal: cover, index, sections, cut sheets.", categoryId: "trade", subcategoryId: "docs", status: "ready", dependsOn: ["cut-sheet"], exports: ["pdf", "source"], creates: ["A submittal cover & index", "Section organization", "A print checklist"], questions: [
    { key: "projectName", label: "Project name", type: "text", required: true, choices: [], help: "" },
    { key: "items", label: "Items / sections — one per line", type: "longtext", required: true, choices: [], help: "" },
  ] }),
  p({ id: "lisp-creator", name: "Make an AutoCAD Cleanup Routine", icon: "📐", blurb: "Answer a few questions and get a commented AutoCAD LISP routine.", categoryId: "trade", subcategoryId: "automation", status: "ready", pi: false, exports: ["source"], creates: ["A trade & goal picker", "A generated .lsp routine with comments", "Usage instructions & warnings"], questions: [
    { key: "trade", label: "What trade?", type: "choice", required: true, choices: ["plumbing", "mechanical", "electrical", "fire protection", "fire sprinkler", "architecture"], help: "" },
    { key: "goal", label: "What do you want it to do?", type: "choice", required: true, choices: ["clean drawing", "hide background", "freeze layers", "tag fixtures", "prep for export"], help: "" },
    { key: "layers", label: "Layers to freeze (comma-separated)", type: "text", required: false, choices: [], help: "Only used for 'hide background' / 'freeze layers'." },
  ] }),
  p({ id: "dynamo-creator", name: "Make a Revit/Dynamo Automation", icon: "🧩", blurb: "Get a beginner-friendly Dynamo node plan for a trade task.", categoryId: "trade", subcategoryId: "automation", status: "ready", pi: false, exports: ["source"], creates: ["A task picker", "A Dynamo node plan / outline", "A plain-English explanation of what it does"], questions: [
    { key: "trade", label: "What trade?", type: "choice", required: true, choices: ["plumbing", "mechanical", "electrical", "fire protection", "fire sprinkler", "architecture"], help: "" },
    { key: "task", label: "What task?", type: "choice", required: true, choices: ["auto-generate schedules", "clean views", "filter backgrounds", "create fixture schedules", "organize sheets"], help: "" },
  ] }),

  // 5) Data ----------------------------------------------------------------
  p({ id: "database-builder", name: "Make an Offline Database", icon: "🛢️", blurb: "Design tables and fields, then add records — all stored locally.", categoryId: "data", subcategoryId: "store", status: "ready", exports: ["database", "web-app"], creates: ["A record screen", "Search", "CSV export", "Saved on this device (localStorage)"], questions: [
    { key: "appName", label: "Database name", type: "text", required: true, choices: [], help: "" },
    { key: "columns", label: "Columns (comma-separated)", type: "text", required: true, choices: [], help: "e.g. name, phone, notes" },
  ] }),
  p({ id: "lookup-table", name: "Make a Lookup Table", icon: "🔎", blurb: "A searchable key→value table other tools can read.", categoryId: "data", subcategoryId: "store", status: "ready", exports: ["database", "source"], creates: ["A searchable key/value app", "CSV export"], questions: [
    { key: "tableName", label: "Table name", type: "text", required: true, choices: [], help: "" },
    { key: "pairs", label: "Entries — one per line: key | value", type: "longtext", required: false, choices: [], help: "e.g. PVC | Polyvinyl chloride" },
  ] }),
  p({ id: "qa-generator", name: "Make a Q&A Pack", icon: "💬", blurb: "Turn notes into question/statement/answer pairs for a local assistant.", categoryId: "data", subcategoryId: "store", status: "ready", exports: ["database", "source"], creates: ["A Q&A app (question/answer/tags)", "Search", "CSV export"], questions: [
    { key: "title", label: "Pack name", type: "text", required: true, choices: [], help: "" },
  ] }),
  p({ id: "knowledge-pack", name: "Make a Knowledge Pack", icon: "📚", blurb: "Bundle tables, examples, and Q&A into one searchable local pack.", categoryId: "data", subcategoryId: "store", status: "planned", needsData: true, dependsOn: ["qa-generator"], exports: ["database", "source"], creates: ["A combined dataset", "Search index", "A portable pack file"] }),
  p({ id: "csv-json-importer", name: "Import CSV / JSON", icon: "📥", blurb: "Bring an existing CSV or JSON file in as a local table.", categoryId: "data", subcategoryId: "import", status: "ready", exports: ["database", "web-app"], creates: ["A file open screen", "A table view", "Files never leave your device"], questions: [
    { key: "title", label: "Tool title (optional)", type: "text", required: false, choices: [], help: "" },
  ] }),
  p({ id: "template-filler", name: "Make a Template Filler", icon: "🧾", blurb: "Merge a table of data into a template to mass-produce documents.", categoryId: "data", subcategoryId: "import", status: "ready", exports: ["web-app", "source"], creates: ["A template editor", "A data → document merge", "Batch output"], questions: [
    { key: "title", label: "Tool title (optional)", type: "text", required: false, choices: [], help: "" },
    { key: "template", label: "Template (use {{field}} placeholders)", type: "longtext", required: false, choices: [], help: "" },
  ] }),

  // 6) Export --------------------------------------------------------------
  p({ id: "export-thumb-drive", name: "Export: Thumb-Drive Runnable", icon: "💾", blurb: "Package the project so it runs straight from a USB drive, offline.", categoryId: "export", subcategoryId: "run", status: "planned", exports: ["thumb-drive"], creates: ["A portable runnable folder", "A start file", "A README"] }),
  p({ id: "export-static-site", name: "Export: Static Website", icon: "🌐", blurb: "A plain website you can host anywhere or open from a file.", categoryId: "export", subcategoryId: "run", status: "planned", exports: ["static-site"], creates: ["HTML/CSS/JS files", "A ZIP"] }),
  p({ id: "export-web-app", name: "Export: Web App", icon: "🕸️", blurb: "An offline-capable web app version of the project.", categoryId: "export", subcategoryId: "run", status: "planned", exports: ["web-app"], creates: ["A web app bundle", "An offline manifest"] }),
  p({ id: "export-desktop", name: "Export: Desktop App", icon: "🖥️", blurb: "A desktop app where the platform allows it.", categoryId: "export", subcategoryId: "run", status: "planned", pi: false, exports: ["desktop"], creates: ["A desktop package outline", "Build instructions"] }),
  p({ id: "export-mobile", name: "Export: Mobile App", icon: "📱", blurb: "A mobile app version where the platform allows it.", categoryId: "export", subcategoryId: "run", status: "planned", exports: ["mobile"], creates: ["A mobile package outline", "Build instructions"] }),
  p({ id: "export-raspberry-pi", name: "Make a Raspberry Pi 5 Package", icon: "🍓", blurb: "Lightweight, touchscreen, kiosk-ready build for a Raspberry Pi 5.", categoryId: "export", subcategoryId: "run", status: "planned", exports: ["raspberry-pi"], creates: ["A Pi-optimized build", "A start script", "Kiosk & touchscreen options", "A README with limits"] }),
  p({ id: "export-source", name: "Export: Source Code", icon: "💽", blurb: "All the generated source so you own it completely.", categoryId: "export", subcategoryId: "file", status: "planned", exports: ["source"], creates: ["A source ZIP", "A README"] }),
  p({ id: "export-pdf", name: "Export: PDF", icon: "📄", blurb: "Print-ready PDF of the printable parts of your project.", categoryId: "export", subcategoryId: "file", status: "planned", exports: ["pdf"], creates: ["A combined PDF"] }),
  p({ id: "export-image", name: "Export: Images", icon: "🖼️", blurb: "PNG/SVG images of cards, labels, or designs.", categoryId: "export", subcategoryId: "file", status: "planned", exports: ["image"], creates: ["Image files", "A ZIP"] }),
  p({ id: "export-3d", name: "Export: 3D Model", icon: "🧱", blurb: "GLB/OBJ/STL files from your 3D designs.", categoryId: "export", subcategoryId: "file", status: "planned", pi: true, exports: ["model-3d"], creates: ["3D model files"] }),
  p({ id: "export-database", name: "Export: Database", icon: "🗄️", blurb: "Your local tables as CSV/JSON (and SQLite where possible).", categoryId: "export", subcategoryId: "file", status: "planned", exports: ["database"], creates: ["CSV/JSON files", "A data backup"] }),
];

const PRESET_BY_ID = new Map(PRESETS.map((x) => [x.id, x]));
const CATEGORY_BY_ID = new Map(CATEGORIES.map((x) => [x.id, x]));

export function getPreset(id: string): Preset | undefined { return PRESET_BY_ID.get(id); }
export function getCategory(id: string): Category | undefined { return CATEGORY_BY_ID.get(id); }
export function presetsInCategory(categoryId: string): Preset[] { return PRESETS.filter((x) => x.categoryId === categoryId); }

// Validate the whole registry at module load: every preset points at a real
// category/subcategory, every dependsOn id exists. Throws (fails the build /
// the test) if a row is malformed — the registry can't silently drift.
export function assertRegistry(): true {
  for (const c of CATEGORIES) categorySchema.parse(c);
  for (const p2 of PRESETS) {
    presetSchema.parse(p2);
    const cat = CATEGORY_BY_ID.get(p2.categoryId);
    if (!cat) throw new Error(`preset ${p2.id}: unknown categoryId ${p2.categoryId}`);
    if (p2.subcategoryId && !cat.subcategories.some((s) => s.id === p2.subcategoryId))
      throw new Error(`preset ${p2.id}: unknown subcategoryId ${p2.subcategoryId} in ${p2.categoryId}`);
    for (const dep of p2.dependsOn)
      if (!PRESET_BY_ID.has(dep)) throw new Error(`preset ${p2.id}: dependsOn unknown preset ${dep}`);
  }
  return true;
}

assertRegistry();
