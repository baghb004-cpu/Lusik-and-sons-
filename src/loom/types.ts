// ============================================================
// LOOM TYPES — the shapes the engine and its callers agree on
// ============================================================
// Separate from LoomStage.tsx so non-React code can import them. The
// poster generator compiles the engine without JSX, and a type import
// reaching into a .tsx file drags the whole component in with it.
// ============================================================

/** The blanket design, as the configurator already holds it. */
export interface LoomDesign {
  /** Letters worked into the cube grid, in order. */
  letters: string[];
  /** The chosen layout — its `preview` array places the cubes. */
  layout: { preview: number[] };
  /** Outline colour of the cubes. */
  blockColor: string;
  /** Thread colour for the letters, or one per letter cycling. */
  letterColor: string;
  letterColors?: string[] | null;
  /** The customer's two personalisation lines. */
  line1?: string;
  line2?: string;
}

/** The bib design: a name, machine embroidered. */
export interface BibDesign {
  name: string;
  threadColor: string;
}

/**
 * The Hye Em Yes bib. Nothing about the lettering is chosen — the three
 * words and the three flag colours ARE the product — so the only thing
 * the customer decides is whether the matching cap comes with it.
 */
export interface HyeEmYesDesign {
  withCap: boolean;
}
